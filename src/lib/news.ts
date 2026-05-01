import { XAI_BASE_URL, XAI_MODEL } from './xai';

export interface NewsHeadline {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
}

export interface StockNewsPayload {
  summary: string;
  headlines: NewsHeadline[];
}

export interface GenerateNewsResult {
  payload: StockNewsPayload;
  model: string;
}

interface ResponsesApiOutputText {
  type: 'output_text';
  text: string;
  annotations?: Array<{
    type?: string;
    url?: string;
    title?: string;
  }>;
}

interface ResponsesApiMessage {
  type: 'message';
  content?: ResponsesApiOutputText[];
}

interface ResponsesApiPayload {
  output?: Array<ResponsesApiMessage | { type: string }>;
  output_text?: string;
  citations?: string[];
  model?: string;
  error?: { message?: string };
}

/**
 * Generate a news summary + top-5 headlines for a ticker using xAI Grok's
 * Responses API with the `web_search` + `x_search` tools.
 *
 * The Responses API does not support `response_format`; we instead ask the
 * model for strict JSON in the prompt and parse the first `{...}` block.
 */
export async function generateStockNews(
  ticker: string,
  companyName?: string
): Promise<GenerateNewsResult | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY is not set');
  }

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = monthAgo.toISOString().slice(0, 10);
  const toDate = today.toISOString().slice(0, 10);

  const companyLabel = companyName && companyName !== 'N/A' ? `${companyName} (${ticker})` : ticker;

  const prompt = [
    `Find the most important news stories about ${companyLabel} from the last 30 days (between ${fromDate} and ${toDate}).`,
    '',
    'Use the web_search and x_search tools to find real news stories. Prefer reputable financial publishers (Reuters, Bloomberg, CNBC, WSJ, Yahoo Finance, Barron\'s, MarketWatch, The Motley Fool, Seeking Alpha, Financial Times, Investopedia, Benzinga, TheStreet). Avoid press-release aggregators when possible.',
    '',
    'Respond with a STRICT JSON object (no markdown, no code fences, no preface) matching exactly this schema:',
    '{',
    '  "summary": string,      // 3-5 sentences summarizing the most relevant news over the last month',
    '  "headlines": [          // 5 most impactful or most cited stories (even if fewer than 5, list all you can find)',
    '    {',
    '      "title": string,    // the headline',
    '      "url": string,      // a direct link to the article (not a search results page)',
    '      "source": string,   // publisher / outlet name, e.g. "Bloomberg"',
    `      "published_at": string | null  // ISO date (YYYY-MM-DD) if known, or null`,
    '    }',
    '  ]',
    '}',
    '',
    `Rules:`,
    `- Only include stories that are directly about ${ticker} or its parent/subsidiary.`,
    `- Exclude generic market-wide or sector-wide stories unless they meaningfully impact ${ticker}.`,
    `- Use real, verifiable URLs from your searches. Do NOT invent URLs.`,
    `- Limit "headlines" to a maximum of 5 entries.`,
  ].join('\n');

  const res = await fetch(`${XAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      input: [
        {
          role: 'system',
          content:
            'You are a professional financial news curator. Always respond with strict JSON matching the requested schema — no markdown, no commentary, no code fences. Only include stories you can actually locate via live web or X search.',
        },
        { role: 'user', content: prompt },
      ],
      tools: [
        { type: 'web_search' },
        { type: 'x_search', from_date: fromDate, to_date: toDate },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`xAI Responses API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as ResponsesApiPayload;
  const text = extractText(json);
  if (!text) return null;

  const parsed = parseJsonLoosely(text);
  const payload = sanitize(parsed);
  if (!payload) return null;

  return { payload, model: json.model ?? XAI_MODEL };
}

function extractText(json: ResponsesApiPayload): string {
  if (typeof json.output_text === 'string' && json.output_text.length > 0) {
    return json.output_text;
  }
  const parts: string[] = [];
  for (const item of json.output ?? []) {
    if (item.type === 'message') {
      const content = (item as ResponsesApiMessage).content ?? [];
      for (const c of content) {
        if (c.type === 'output_text' && typeof c.text === 'string') {
          parts.push(c.text);
        }
      }
    }
  }
  return parts.join('\n');
}

function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
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

function sanitize(obj: unknown): StockNewsPayload | null {
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
  const raw = Array.isArray(r.headlines) ? r.headlines : [];
  const headlines: NewsHeadline[] = [];
  for (const h of raw.slice(0, 5)) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!title || !url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    const source = typeof o.source === 'string' ? o.source.trim() : hostnameOf(url);
    const pubRaw = typeof o.published_at === 'string' ? o.published_at.trim() : '';
    const published_at = pubRaw && pubRaw.toLowerCase() !== 'null' ? pubRaw : null;
    headlines.push({ title, url, source: source || hostnameOf(url), published_at });
  }

  if (headlines.length === 0 && !summary) return null;
  return { summary, headlines };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}
