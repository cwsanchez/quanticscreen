import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import type { AiReview } from '@/types';

export const dynamic = 'force-dynamic';

export interface AiListItem extends AiReview {
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  current_price: number | null;
  market_cap: number | null;
  overall_score: number | null;
  value_score: number | null;
  growth_score: number | null;
  momentum_score: number | null;
  quality_score: number | null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const sb = getServiceClient();

    const { data: reviews, error: revErr } = await sb
      .from('latest_ai_reviews')
      .select('*');

    if (revErr) {
      console.error('AI list reviews error:', revErr);
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const tickers = reviews.map((r) => r.ticker);

    const { data: stocks } = await sb
      .from('stocks')
      .select('ticker, company_name, sector, industry')
      .in('ticker', tickers);
    const stocksByTicker = new Map(
      (stocks ?? []).map((s) => [s.ticker, s])
    );

    const { data: metrics } = await sb
      .from('latest_metrics')
      .select('ticker, current_price, market_cap')
      .in('ticker', tickers);
    const metricsByTicker = new Map(
      (metrics ?? []).map((m) => [m.ticker, m])
    );

    const items: AiListItem[] = reviews.map((r) => {
      const km = (r.key_metrics ?? {}) as Record<string, unknown>;
      const stock = stocksByTicker.get(r.ticker);
      const metric = metricsByTicker.get(r.ticker);
      return {
        ...(r as AiReview),
        company_name: stock?.company_name ?? null,
        sector: stock?.sector ?? null,
        industry: stock?.industry ?? null,
        current_price: num(metric?.current_price),
        market_cap: num(metric?.market_cap),
        overall_score: num(km.overall_score),
        value_score: num(km.value_score),
        growth_score: num(km.growth_score),
        momentum_score: num(km.momentum_score),
        quality_score: num(km.quality_score),
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error('AI list error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
