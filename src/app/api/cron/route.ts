import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchStockMetrics } from '@/lib/yahoo';
import { saveMetrics, getStaleTickers, getLatestMetrics, pruneOldMetrics, getMetadata, setMetadata } from '@/lib/db';
import { sleep, randomInt } from '@/lib/utils';
import { getServiceClient } from '@/lib/supabase';
import { DEFAULT_TICKERS } from '@/lib/tickers';

export const maxDuration = 300;

const SEED_BATCH_SIZE = 50;
const FETCH_CHUNK_SIZE = 30;

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

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const seeded = await seedMissingTickers();

    const lastFetchStr = await getMetadata('last_fetch_time');
    const lastFetch = lastFetchStr ? new Date(lastFetchStr) : null;

    const now = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    if (lastFetch && lastFetch >= todayMidnight) {
      return NextResponse.json({
        message: 'Already fetched today.',
        fetched: 0,
        seeded,
      });
    }

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

    if (toFetch.length === 0) {
      return NextResponse.json({
        message: 'No tickers to fetch.',
        fetched: 0,
        seeded,
      });
    }

    let fetched = 0;

    for (let i = 0; i < Math.min(toFetch.length, FETCH_CHUNK_SIZE); i++) {
      const { ticker } = toFetch[i];
      try {
        const metrics = await fetchStockMetrics(ticker);
        if (metrics) {
          await saveMetrics(metrics);
          fetched++;
        }
      } catch (e) {
        console.error(`Cron fetch error for ${ticker}:`, e);
      }
      await sleep(randomInt(10000, 30000));
    }

    await pruneOldMetrics();
    await setMetadata('last_fetch_time', new Date().toISOString());

    return NextResponse.json({
      message: `Fetched ${fetched}/${toFetch.length} tickers. Seeded ${seeded} new tickers.`,
      fetched,
      total: toFetch.length,
      seeded,
    });
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
