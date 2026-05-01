import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { fetchStockMetrics, fetchPriceHistory } from '@/lib/yahoo';
import {
  saveMetrics,
  getLatestMetrics,
  savePriceHistory,
  getPriceHistory,
  touchStockView,
  getLatestAiReview,
} from '@/lib/db';
import { processStock, PRESETS, DEFAULT_WEIGHTS, DEFAULT_METRICS } from '@/lib/processor';
import { getServiceClient } from '@/lib/supabase';
import type { StockMetrics, LogicConfig, AiReview } from '@/types';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const preset = request.nextUrl.searchParams.get('preset') ?? 'Overall';
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();

  try {
    let metrics: StockMetrics | null = null;

    if (!forceRefresh) {
      metrics = await getLatestMetrics(upperTicker);
      if (metrics) {
        const fetchTime = new Date(metrics.fetch_timestamp ?? '').getTime();
        const hoursSince = (Date.now() - fetchTime) / (1000 * 60 * 60);
        if (hoursSince > 24) {
          metrics = null;
        }
      }
    }

    if (!metrics) {
      const fetched = await fetchStockMetrics(upperTicker);
      if (!fetched) {
        return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 404 });
      }

      const sb = getServiceClient();
      await sb.from('stocks').upsert(
        {
          ticker: upperTicker,
          company_name: fetched['Company Name'] ?? 'N/A',
          industry: fetched.Industry ?? 'N/A',
          sector: fetched.Sector ?? 'N/A',
          quote_type: fetched.quoteType ?? 'EQUITY',
        },
        { onConflict: 'ticker' }
      );

      await saveMetrics(fetched);
      metrics = fetched;
    }

    const logic: LogicConfig = PRESETS[preset] ?? PRESETS.Overall;
    const processed = processStock(metrics, DEFAULT_WEIGHTS, DEFAULT_METRICS, logic);

    let history = await getPriceHistory(upperTicker);
    if (!history) {
      history = await fetchPriceHistory(upperTicker);
      if (history && history.length > 0) {
        await savePriceHistory(upperTicker, history);
      }
    }

    // Mark this ticker as recently viewed so the background cron prioritizes
    // keeping its metrics fresh. Don't fail the request if this fails.
    try {
      await touchStockView(upperTicker);
    } catch {
      /* ignore */
    }

    let aiReview: AiReview | null = null;
    try {
      aiReview = await getLatestAiReview(upperTicker, 30);
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      processed,
      history: history ?? [],
      aiReview,
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
