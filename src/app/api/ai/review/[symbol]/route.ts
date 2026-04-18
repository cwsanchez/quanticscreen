import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { fetchStockMetrics } from '@/lib/yahoo';
import {
  getLatestAiReview,
  getLatestMetrics,
  saveAiReview,
  saveMetrics,
} from '@/lib/db';
import { processStock, PRESETS, DEFAULT_WEIGHTS, DEFAULT_METRICS } from '@/lib/processor';
import { generateAiReview } from '@/lib/xai';
import type { StockMetrics } from '@/types';

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
      const cached = await getLatestAiReview(ticker, 7);
      if (cached) {
        return NextResponse.json({ review: cached, cached: true });
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
      if (!fetched) {
        return NextResponse.json(
          { error: `Could not fetch metrics for ${ticker}` },
          { status: 404 }
        );
      }
      await saveMetrics(fetched);
      metrics = fetched;
    }

    const processed = processStock(metrics, DEFAULT_WEIGHTS, DEFAULT_METRICS, PRESETS.Overall);

    const generated = await generateAiReview({
      ticker,
      metrics,
      factorBoosts: processed.factor_boosts,
      finalScore: processed.final_score,
    });

    if (!generated) {
      return NextResponse.json(
        { error: 'xAI returned an unparseable response.' },
        { status: 502 }
      );
    }

    const saved = await saveAiReview({
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

    return NextResponse.json({
      review:
        saved ?? {
          ticker,
          generated_at: new Date().toISOString(),
          ...generated.payload,
          model: generated.model,
        },
      cached: false,
    });
  } catch (err) {
    console.error('AI review error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
