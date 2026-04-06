import { NextRequest, NextResponse } from 'next/server';
import { fetchStockMetrics, fetchPriceHistory } from '@/lib/yahoo';
import { saveMetrics, getLatestMetrics, savePriceHistory, getPriceHistory } from '@/lib/db';
import { processStock, PRESETS, DEFAULT_WEIGHTS, DEFAULT_METRICS } from '@/lib/processor';
import type { StockMetrics, LogicConfig } from '@/types';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const preset = request.nextUrl.searchParams.get('preset') ?? 'Overall';
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
  }

  try {
    let metrics: StockMetrics | null = null;

    if (!forceRefresh) {
      metrics = await getLatestMetrics(ticker.toUpperCase());
      if (metrics) {
        const fetchTime = new Date(metrics.fetch_timestamp ?? '').getTime();
        const hoursSince = (Date.now() - fetchTime) / (1000 * 60 * 60);
        if (hoursSince > 24) {
          metrics = null;
        }
      }
    }

    if (!metrics) {
      const fetched = await fetchStockMetrics(ticker.toUpperCase());
      if (!fetched) {
        return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 404 });
      }
      await saveMetrics(fetched);
      metrics = fetched;
    }

    const logic: LogicConfig = PRESETS[preset] ?? PRESETS.Overall;
    const processed = processStock(metrics, DEFAULT_WEIGHTS, DEFAULT_METRICS, logic);

    let history = await getPriceHistory(ticker.toUpperCase());
    if (!history) {
      history = await fetchPriceHistory(ticker.toUpperCase());
      if (history && history.length > 0) {
        await savePriceHistory(ticker.toUpperCase(), history);
      }
    }

    return NextResponse.json({
      processed,
      history: history ?? [],
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
