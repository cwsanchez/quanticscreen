import type { StockMetrics } from '@/types';

export const XAI_MODEL = 'grok-4-1-fast-reasoning';
export const XAI_BASE_URL = 'https://api.x.ai/v1';

export interface AiReviewPayload {
  bull_case: string;
  bear_case: string;
  institutional_sentiment: string;
  retail_sentiment: string;
  key_metrics: Record<string, unknown>;
  verdict: string;
  confidence: number;
}

function num(v: unknown): number | null {
  if (v === 'N/A' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildUserPrompt(
  ticker: string,
  metrics: StockMetrics,
  factorBoosts: { value: number; growth: number; momentum: number; quality: number },
  finalScore: number
): string {
  const m = metrics;
  const snapshot = {
    ticker,
    company_name: m['Company Name'],
    sector: m.Sector,
    industry: m.Industry,
    current_price: num(m['Current Price']),
    market_cap: num(m['Market Cap']),
    enterprise_value: num(m.EV),
    pe: num(m['P/E']),
    forward_pe: num(m['Forward P/E']),
    peg: num(m.PEG),
    pb: num(m['P/B']),
    p_fcf: num(m['P/FCF']),
    roe: num(m.ROE),
    gross_margin: num(m['Gross Margin']),
    net_profit_margin: num(m['Net Profit Margin']),
    de: num(m['D/E']),
    fcf_ev: num(m['FCF % EV TTM']),
    ebitda_ev: num(m['EBITDA % EV TTM']),
    beta: num(m.Beta),
    dividend_yield: num(m['Dividend Yield']),
    rsi: num(m.RSI),
    revenue_growth: num(m['Revenue Growth']),
    earnings_growth: num(m['Earnings Growth']),
    week52_high: num(m['52W High']),
    week52_low: num(m['52W Low']),
    analyst_rating: m['Analyst Rating'],
    analyst_target: num(m['Target Price']),
    sentiment: m.Sentiment,
    proprietary_scores: {
      overall: Number(finalScore.toFixed(1)),
      value: factorBoosts.value,
      growth: factorBoosts.growth,
      momentum: factorBoosts.momentum,
      quality: factorBoosts.quality,
    },
  };

  return [
    `You are a professional equity analyst. Write a concise, balanced, and professional research note for ${ticker} (${m['Company Name'] ?? ticker}).`,
    '',
    'Use the quantitative snapshot below as context, and incorporate your general knowledge of the company, sector, and current market dynamics.',
    '',
    'Respond with a STRICT JSON object (no markdown, no preamble, no code fences) matching exactly this schema:',
    '{',
    '  "bull_case": string,             // 3–5 concise sentences',
    '  "bear_case": string,             // 3–5 concise sentences',
    '  "institutional_sentiment": string, // 2–3 sentences on what institutions / funds likely think',
    '  "retail_sentiment": string,      // 2–3 sentences on retail / social perception',
    '  "key_metrics": {',
    '    "overall_score": number,       // 0-100',
    '    "value_score": number,         // 0-100',
    '    "growth_score": number,        // 0-100',
    '    "momentum_score": number,      // 0-100',
    '    "quality_score": number,       // 0-100',
    '    "top_ratios": { "<name>": "<formatted value>", ... }  // 4-6 most important ratios',
    '  },',
    '  "verdict": string,               // one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"',
    '  "confidence": number             // 0-100 integer',
    '}',
    '',
    'Quantitative snapshot:',
    JSON.stringify(snapshot, null, 2),
  ].join('\n');
}

function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // try to extract the first {...} block
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function sanitize(obj: unknown): AiReviewPayload | null {
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
  const km = (r.key_metrics && typeof r.key_metrics === 'object'
    ? (r.key_metrics as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const confRaw = Number(r.confidence);
  const confidence = Number.isFinite(confRaw)
    ? Math.max(0, Math.min(100, Math.round(confRaw)))
    : 50;
  const result: AiReviewPayload = {
    bull_case: str('bull_case'),
    bear_case: str('bear_case'),
    institutional_sentiment: str('institutional_sentiment'),
    retail_sentiment: str('retail_sentiment'),
    key_metrics: km,
    verdict: str('verdict') || 'Hold',
    confidence,
  };
  if (!result.bull_case && !result.bear_case) return null;
  return result;
}

export interface GenerateReviewInput {
  ticker: string;
  metrics: StockMetrics;
  factorBoosts: { value: number; growth: number; momentum: number; quality: number };
  finalScore: number;
}

export async function generateAiReview(
  input: GenerateReviewInput
): Promise<{ payload: AiReviewPayload; model: string } | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not set');
  }

  const { ticker, metrics, factorBoosts, finalScore } = input;
  const prompt = buildUserPrompt(ticker, metrics, factorBoosts, finalScore);

  const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional, balanced sell-side equity analyst. You always respond with strict JSON matching the requested schema — no markdown, no commentary.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`xAI API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const content = json.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonLoosely(content);
  const payload = sanitize(parsed);
  if (!payload) return null;
  return { payload, model: json.model ?? XAI_MODEL };
}
