import { NextRequest, NextResponse } from 'next/server';
import { getAllLatestMetrics, getUniqueSectors } from '@/lib/db';
import { processStock, PRESETS, DEFAULT_WEIGHTS, DEFAULT_METRICS } from '@/lib/processor';
import type { LogicConfig, ProcessedResult, ScoringWeights } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const preset = request.nextUrl.searchParams.get('preset') ?? 'Overall';

  try {
    const allMetrics = await getAllLatestMetrics();
    const logic: LogicConfig = PRESETS[preset] ?? PRESETS.Overall;

    const results: ProcessedResult[] = allMetrics.map((m) =>
      processStock(m, DEFAULT_WEIGHTS, DEFAULT_METRICS, logic)
    );

    results.sort((a, b) => b.final_score - a.final_score);

    const sectors = await getUniqueSectors();

    return NextResponse.json({ results, sectors });
  } catch (err) {
    console.error('Process error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { weights, metrics: selectedMetrics, logic } = body as {
      weights: ScoringWeights;
      metrics: string[];
      logic: LogicConfig;
    };

    const allMetrics = await getAllLatestMetrics();

    const results: ProcessedResult[] = allMetrics.map((m) =>
      processStock(
        m,
        weights ?? DEFAULT_WEIGHTS,
        selectedMetrics ?? DEFAULT_METRICS,
        logic ?? PRESETS.Overall
      )
    );

    results.sort((a, b) => b.final_score - a.final_score);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Custom process error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
