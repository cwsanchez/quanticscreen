import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchStockMetrics } from '@/lib/yahoo';
import { saveMetrics, getStaleTickers, getLatestMetrics, pruneOldMetrics, setMetadata } from '@/lib/db';
import { sleep, randomInt } from '@/lib/utils';
import { getServiceClient } from '@/lib/supabase';
import { DEFAULT_TICKERS } from '@/lib/tickers';

export const maxDuration = 300;

const SEED_BATCH_SIZE = 100;
const FETCH_CHUNK_SIZE = 50;
const AI_REVIEW_BATCH_SIZE = 10;

function getLastCloseDate(): Date {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  while (et.getDay() === 0 || et.getDay() === 6 || et.getHours() < 16) {
    et.setDate(et.getDate() - 1);
  }
  et.setHours(16, 0, 0, 0);
  return et;
}

async function seedMissingTickers(): Promise<number> {
  const sb = getServiceClient();
  const { data: existing } = await sb.from('stocks').select('ticker');
  const existingSet = new Set(existing?.map((s) => s.ticker) ?? []);

  const missing = DEFAULT_TICKERS.filter((t) => !existingSet.has(t));
  if (missing.length === 0) return 0;

  const batch = missing.slice(0, SEED_BATCH_SIZE).map((ticker) => ({
    ticker,
    company_name: 'N/A',
    industry: 'N/A',
    sector: 'N/A',
  }));

  const { error } = await sb.from('stocks').upsert(batch, { onConflict: 'ticker' });
  if (error) {
    console.error('Seed batch error:', error);
    return 0;
  }
  return batch.length;
}

async function generateAiReviews(): Promise<number> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return 0;

  const sb = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentReviews } = await sb
    .from('ai_reviews')
    .select('ticker')
    .gte('generated_at', weekAgo);
  const reviewedSet = new Set(recentReviews?.map((r) => r.ticker) ?? []);

  const { data: topStocks } = await sb
    .from('stocks')
    .select('ticker')
    .order('ticker');

  if (!topStocks) return 0;

  const needsReview = topStocks
    .map((s) => s.ticker)
    .filter((t) => !reviewedSet.has(t))
    .slice(0, AI_REVIEW_BATCH_SIZE);

  if (needsReview.length === 0) return 0;

  let generated = 0;
  for (const ticker of needsReview) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/ai/review/${ticker}`, {
        method: 'GET',
        headers: { 'x-internal-cron': 'true' },
      });
      if (res.ok) generated++;
    } catch (e) {
      console.error(`AI review generation error for ${ticker}:`, e);
    }
    await sleep(randomInt(2000, 5000));
  }
  return generated;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const seeded = await seedMissingTickers();

    const staleTickers = await getStaleTickers();
    const lastCloseDate = getLastCloseDate();

    const toFetch: Array<{ ticker: string; type: string }> = [];

    for (const t of staleTickers) {
      const metrics = await getLatestMetrics(t);
      if (!metrics) {
        toFetch.push({ ticker: t, type: 'initial' });
      } else {
        const fetchDate = new Date(metrics.fetch_timestamp ?? '');
        if (fetchDate < lastCloseDate) {
          toFetch.push({ ticker: t, type: 'refresh' });
        }
      }
    }

    let fetched = 0;

    if (toFetch.length > 0) {
      const prioritized = toFetch.sort((a, b) => {
        if (a.type === 'initial' && b.type !== 'initial') return -1;
        if (a.type !== 'initial' && b.type === 'initial') return 1;
        return 0;
      });

      for (let i = 0; i < Math.min(prioritized.length, FETCH_CHUNK_SIZE); i++) {
        const { ticker } = prioritized[i];
        try {
          const metrics = await fetchStockMetrics(ticker);
          if (metrics) {
            await saveMetrics(metrics);
            fetched++;
          }
        } catch (e) {
          console.error(`Cron fetch error for ${ticker}:`, e);
        }
        await sleep(randomInt(5000, 15000));
      }

      await pruneOldMetrics();
    }

    await setMetadata('last_fetch_time', new Date().toISOString());

    let aiGenerated = 0;
    try {
      aiGenerated = await generateAiReviews();
    } catch (e) {
      console.error('AI review generation failed:', e);
    }

    return NextResponse.json({
      message: `Fetched ${fetched}/${toFetch.length} tickers. Seeded ${seeded} new tickers. AI reviews: ${aiGenerated}.`,
      fetched,
      total: toFetch.length,
      seeded,
      aiGenerated,
    });
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
