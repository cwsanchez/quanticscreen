import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchStockMetrics } from '@/lib/yahoo';
import {
  saveMetrics,
  getLatestMetrics,
  pruneOldMetrics,
  setMetadata,
  getRecentlyViewedTickers,
  getTickersWithStaleAiReviews,
  saveAiReview,
} from '@/lib/db';
import { sleep, randomInt } from '@/lib/utils';
import { getServiceClient } from '@/lib/supabase';
import { PRIORITIZED_TICKERS } from '@/lib/tickers';
import { processStock, PRESETS, DEFAULT_WEIGHTS, DEFAULT_METRICS } from '@/lib/processor';
import { generateAiReview } from '@/lib/xai';
import type { StockMetrics } from '@/types';

export const maxDuration = 300;

// Per-run budgets, tuned to fit within Vercel's 300s maxDuration while still
// growing the database meaningfully. At the default schedule (every 4h → 6
// runs/day) this means ~90-120 newly populated + refreshed tickers/day and
// up to 60 AI reviews/day.
const POPULATE_BUDGET = 15;
const REFRESH_BUDGET = 10;
const AI_REVIEW_BUDGET = 10;
const WATCHED_RECENT_LIMIT = 40;
const YAHOO_SLEEP_MIN_MS = 3000;
const YAHOO_SLEEP_MAX_MS = 8000;
const AI_SLEEP_MIN_MS = 1000;
const AI_SLEEP_MAX_MS = 3000;
// Stop starting new fetches after this much wall-time has elapsed so the
// handler always returns before Vercel's maxDuration kills it.
const SOFT_TIME_BUDGET_MS = 270_000;

function getLastCloseDate(): Date {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  while (et.getDay() === 0 || et.getDay() === 6 || et.getHours() < 16) {
    et.setDate(et.getDate() - 1);
  }
  et.setHours(16, 0, 0, 0);
  return et;
}

async function listExistingTickers(): Promise<Set<string>> {
  const sb = getServiceClient();
  const { data } = await sb.from('stocks').select('ticker');
  return new Set((data ?? []).map((s) => s.ticker));
}

async function fetchAndStore(ticker: string): Promise<StockMetrics | null> {
  try {
    const metrics = await fetchStockMetrics(ticker);
    if (metrics) {
      await saveMetrics(metrics);
      return metrics;
    }
  } catch (e) {
    console.error(`Cron fetch error for ${ticker}:`, e);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const timeLeft = () => SOFT_TIME_BUDGET_MS - (Date.now() - startedAt);

  try {
    const existing = await listExistingTickers();
    const lastClose = getLastCloseDate();

    // 1. Populate missing priority tickers with full metrics fetches.
    const missing = PRIORITIZED_TICKERS.filter((t) => !existing.has(t)).slice(0, POPULATE_BUDGET);
    let populated = 0;
    for (const ticker of missing) {
      if (timeLeft() <= 0) break;
      const saved = await fetchAndStore(ticker);
      if (saved) populated += 1;
      await sleep(randomInt(YAHOO_SLEEP_MIN_MS, YAHOO_SLEEP_MAX_MS));
    }

    // 2. Pick stocks to refresh: union of priority list (already in DB) + recently viewed.
    const recent = await getRecentlyViewedTickers(WATCHED_RECENT_LIMIT);
    const refreshCandidateSet = new Set<string>();
    for (const t of recent) refreshCandidateSet.add(t);
    for (const t of PRIORITIZED_TICKERS) {
      if (existing.has(t) || missing.includes(t)) refreshCandidateSet.add(t);
    }

    // Keep only tickers present in DB (we don't refresh what wasn't populated).
    const candidates: string[] = [];
    const nowExisting = await listExistingTickers();
    for (const t of refreshCandidateSet) {
      if (nowExisting.has(t)) candidates.push(t);
    }

    // Prioritize: recently viewed first, then priority list.
    candidates.sort((a, b) => {
      const ai = recent.indexOf(a);
      const bi = recent.indexOf(b);
      const arank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const brank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      return arank - brank;
    });

    // Pick stale ones: no metrics, or metrics older than last close.
    const refreshQueue: string[] = [];
    for (const t of candidates) {
      const m = await getLatestMetrics(t);
      if (!m) {
        refreshQueue.push(t);
      } else {
        const fetchDate = new Date(m.fetch_timestamp ?? '');
        if (fetchDate < lastClose) refreshQueue.push(t);
      }
      if (refreshQueue.length >= REFRESH_BUDGET) break;
    }

    let refreshed = 0;
    for (const ticker of refreshQueue) {
      if (timeLeft() <= 0) break;
      const saved = await fetchAndStore(ticker);
      if (saved) refreshed += 1;
      await sleep(randomInt(YAHOO_SLEEP_MIN_MS, YAHOO_SLEEP_MAX_MS));
    }

    // 3. Throttled AI review generation for recently viewed stocks.
    let aiGenerated = 0;
    const aiErrors: string[] = [];
    if (process.env.XAI_API_KEY) {
      // Prefer recently viewed tickers that don't have a fresh (< 7d) review.
      const aiCandidates = recent.length > 0 ? recent : PRIORITIZED_TICKERS.slice(0, 40);
      const stale = await getTickersWithStaleAiReviews(aiCandidates, 7);
      const aiQueue = stale.slice(0, AI_REVIEW_BUDGET);

      for (const ticker of aiQueue) {
        if (timeLeft() <= 0) break;
        try {
          const metrics = await getLatestMetrics(ticker);
          if (!metrics) continue;
          const processed = processStock(
            metrics,
            DEFAULT_WEIGHTS,
            DEFAULT_METRICS,
            PRESETS.Overall
          );
          const generated = await generateAiReview({
            ticker,
            metrics,
            factorBoosts: processed.factor_boosts,
            finalScore: processed.final_score,
          });
          if (generated) {
            await saveAiReview({
              ticker,
              bull_case: generated.payload.bull_case,
              bear_case: generated.payload.bear_case,
              institutional_sentiment: generated.payload.institutional_sentiment,
              retail_sentiment: generated.payload.retail_sentiment,
              key_metrics: generated.payload.key_metrics,
              verdict: generated.payload.verdict,
              confidence: generated.payload.confidence,
              model: generated.model,
            });
            aiGenerated += 1;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'unknown';
          console.error(`AI review error for ${ticker}:`, msg);
          aiErrors.push(`${ticker}: ${msg}`);
        }
        await sleep(randomInt(AI_SLEEP_MIN_MS, AI_SLEEP_MAX_MS));
      }
    }

    await pruneOldMetrics();
    await setMetadata('last_fetch_time', new Date().toISOString());

    return NextResponse.json({
      populated,
      refreshed,
      ai_generated: aiGenerated,
      ai_errors: aiErrors.slice(0, 5),
      missing_remaining: Math.max(0, PRIORITIZED_TICKERS.filter((t) => !nowExisting.has(t)).length - populated),
      message: `Populated ${populated} new, refreshed ${refreshed}, generated ${aiGenerated} AI reviews.`,
    });
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
