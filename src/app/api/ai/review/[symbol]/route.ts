import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import type { AiReview, AiReviewKeyMetrics } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = 'grok-4-1-fast-reasoning';
const CACHE_DAYS = 7;

function buildPrompt(ticker: string): string {
  return `You are a senior equity research analyst. Analyze the publicly traded company with ticker symbol "${ticker}" and provide a structured investment analysis.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "bull_case": "2-4 sentences on why this stock could outperform",
  "bear_case": "2-4 sentences on key risks and why it could underperform",
  "institutional_sentiment": "1-2 sentences on how institutions view this stock currently",
  "retail_sentiment": "1-2 sentences on retail investor sentiment and social media buzz",
  "key_metrics": {
    "overall_score": <1-100 integer>,
    "value_score": <1-100 integer>,
    "growth_score": <1-100 integer>,
    "momentum_score": <1-100 integer>,
    "quality_score": <1-100 integer>,
    "top_ratios": {
      "pe_assessment": "<cheap/fair/expensive>",
      "revenue_trend": "<accelerating/stable/decelerating>",
      "margin_trend": "<expanding/stable/contracting>",
      "balance_sheet": "<strong/adequate/weak>",
      "cash_flow": "<strong/adequate/weak>"
    }
  },
  "verdict": "1-2 sentence overall investment verdict (Buy/Hold/Sell thesis)",
  "confidence": <1-100 integer representing your confidence level>
}`;
}

async function getCachedReview(ticker: string): Promise<AiReview | null> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await sb
    .from('ai_reviews')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .gte('generated_at', cutoff)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  return data as AiReview | null;
}

async function generateReview(ticker: string): Promise<AiReview | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a senior equity research analyst. Return only valid JSON, no markdown formatting.',
        },
        {
          role: 'user',
          content: buildPrompt(ticker),
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`xAI API error for ${ticker}: ${response.status} ${errText}`);
    return null;
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`xAI API returned no content for ${ticker}`);
    return null;
  }

  let parsed;
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error(`Failed to parse xAI response for ${ticker}:`, e, content);
    return null;
  }

  const keyMetrics: AiReviewKeyMetrics = {
    overall_score: Number(parsed.key_metrics?.overall_score) || 50,
    value_score: Number(parsed.key_metrics?.value_score) || 50,
    growth_score: Number(parsed.key_metrics?.growth_score) || 50,
    momentum_score: Number(parsed.key_metrics?.momentum_score) || 50,
    quality_score: Number(parsed.key_metrics?.quality_score) || 50,
    top_ratios: parsed.key_metrics?.top_ratios || {},
  };

  const sb = getServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('ai_reviews')
    .insert({
      ticker: ticker.toUpperCase(),
      generated_at: now,
      bull_case: String(parsed.bull_case || ''),
      bear_case: String(parsed.bear_case || ''),
      institutional_sentiment: String(parsed.institutional_sentiment || ''),
      retail_sentiment: String(parsed.retail_sentiment || ''),
      key_metrics: keyMetrics,
      verdict: String(parsed.verdict || ''),
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
    })
    .select()
    .single();

  if (error) {
    console.error(`Failed to save AI review for ${ticker}:`, error);
    return null;
  }

  return data as AiReview;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  try {
    const cached = await getCachedReview(ticker);
    if (cached) {
      return NextResponse.json({ review: cached, cached: true });
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI reviews not configured. Add XAI_API_KEY to enable.', review: null },
        { status: 200 }
      );
    }

    const review = await generateReview(ticker);
    if (!review) {
      return NextResponse.json(
        { error: 'Failed to generate AI review', review: null },
        { status: 500 }
      );
    }

    return NextResponse.json({ review, cached: false });
  } catch (err) {
    console.error(`AI review error for ${ticker}:`, err);
    return NextResponse.json(
      { error: 'Internal server error', review: null },
      { status: 500 }
    );
  }
}
