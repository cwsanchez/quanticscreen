import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import {
  getLatestMetrics,
  getLatestStockNews,
  saveMetrics,
  saveStockNews,
} from '@/lib/db';
import { fetchStockMetrics } from '@/lib/yahoo';
import { generateStockNews } from '@/lib/news';
import type { StockMetrics } from '@/types';

// News is cached for 24h (a little longer than the homepage refresh cadence).
const CACHE_MAX_AGE_HOURS = 24;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;
  const ticker = symbol?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  try {
    if (!forceRefresh) {
      const cached = await getLatestStockNews(ticker, CACHE_MAX_AGE_HOURS);
      if (cached) {
        return NextResponse.json({ news: cached, cached: true });
      }
    }

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'XAI_API_KEY is not configured on the server.',
          code: 'missing_api_key',
        },
        { status: 503 }
      );
    }

    let metrics: StockMetrics | null = await getLatestMetrics(ticker);
    if (!metrics) {
      const fetched = await fetchStockMetrics(ticker);
      if (fetched) {
        try {
          await saveMetrics(fetched);
        } catch {
          /* ignore */
        }
        metrics = fetched;
      }
    }
    const companyName = metrics?.['Company Name'];

    const generated = await generateStockNews(ticker, typeof companyName === 'string' ? companyName : undefined);
    if (!generated) {
      return NextResponse.json(
        { error: 'xAI returned an unparseable news response.' },
        { status: 502 }
      );
    }

    const saved = await saveStockNews({
      ticker,
      summary: generated.payload.summary,
      headlines: generated.payload.headlines,
      model: generated.model,
    });

    return NextResponse.json({
      news:
        saved ?? {
          ticker,
          generated_at: new Date().toISOString(),
          summary: generated.payload.summary,
          headlines: generated.payload.headlines,
          model: generated.model,
        },
      cached: false,
    });
  } catch (err) {
    console.error('Stock news error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
