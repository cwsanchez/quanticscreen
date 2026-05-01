import { getServiceClient } from './supabase';
import type { StockMetrics, PriceHistoryPoint, AiReview, StockNews, NewsHeadline } from '@/types';

function val(v: unknown): unknown {
  return v === 'N/A' ? null : v;
}

export async function saveMetrics(metrics: StockMetrics): Promise<number | null> {
  const sb = getServiceClient();

  const { error: stockError } = await sb
    .from('stocks')
    .upsert(
      {
        ticker: metrics.Ticker,
        company_name: metrics['Company Name'] ?? 'N/A',
        industry: metrics.Industry ?? 'N/A',
        sector: metrics.Sector ?? 'N/A',
        quote_type: metrics.quoteType ?? 'EQUITY',
      },
      { onConflict: 'ticker' }
    );
  if (stockError) console.error('Stock upsert error:', stockError);

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('metric_fetches')
    .insert({
      ticker: metrics.Ticker,
      fetch_timestamp: now,
      pe: val(metrics['P/E']),
      roe: val(metrics.ROE),
      de: val(metrics['D/E']),
      pb: val(metrics['P/B']),
      peg: val(metrics.PEG),
      gross_margin: val(metrics['Gross Margin']),
      net_profit_margin: val(metrics['Net Profit Margin']),
      fcf_ev: val(metrics['FCF % EV TTM']),
      ebitda_ev: val(metrics['EBITDA % EV TTM']),
      current_price: val(metrics['Current Price']),
      w52_high: val(metrics['52W High']),
      w52_low: val(metrics['52W Low']),
      market_cap: val(metrics['Market Cap']),
      ev: val(metrics.EV),
      total_cash: val(metrics['Total Cash']),
      total_debt: val(metrics['Total Debt']),
      fcf_actual: val(metrics['FCF Actual']),
      ebitda_actual: val(metrics['EBITDA Actual']),
      p_fcf: val(metrics['P/FCF']),
      beta: val(metrics.Beta),
      dividend_yield: val(metrics['Dividend Yield']),
      avg_volume: val(metrics['Average Volume']),
      rsi: val(metrics.RSI),
      revenue_growth: val(metrics['Revenue Growth']),
      earnings_growth: val(metrics['Earnings Growth']),
      forward_pe: val(metrics['Forward P/E']),
      analyst_rating: val(metrics['Analyst Rating']),
      analyst_mean: val(metrics['Analyst Mean']),
      target_price: val(metrics['Target Price']),
      sentiment: val(metrics.Sentiment),
    })
    .select('fetch_id')
    .single();

  if (error) {
    console.error('Metric insert error:', error);
    return null;
  }
  return data?.fetch_id ?? null;
}

function rowToMetrics(row: Record<string, unknown>, stock?: Record<string, unknown>): StockMetrics {
  const v = (k: string) => (row[k] != null ? row[k] : 'N/A') as number | 'N/A';
  const s = (k: string) => (row[k] != null ? String(row[k]) : 'N/A') as string | 'N/A';

  return {
    Ticker: String(row.ticker),
    'Company Name': stock?.company_name ? String(stock.company_name) : 'N/A',
    Industry: stock?.industry ? String(stock.industry) : 'N/A',
    Sector: stock?.sector ? String(stock.sector) : 'N/A',
    'P/E': v('pe'),
    ROE: v('roe'),
    'D/E': v('de'),
    'P/B': v('pb'),
    PEG: v('peg'),
    'Gross Margin': v('gross_margin'),
    'Net Profit Margin': v('net_profit_margin'),
    'FCF % EV TTM': v('fcf_ev'),
    'EBITDA % EV TTM': v('ebitda_ev'),
    'Current Price': v('current_price'),
    '52W High': v('w52_high'),
    '52W Low': v('w52_low'),
    'Market Cap': v('market_cap'),
    EV: v('ev'),
    'Total Cash': v('total_cash'),
    'Total Debt': v('total_debt'),
    'FCF Actual': v('fcf_actual'),
    'EBITDA Actual': v('ebitda_actual'),
    'P/FCF': v('p_fcf'),
    Beta: v('beta'),
    'Dividend Yield': v('dividend_yield'),
    'Average Volume': v('avg_volume'),
    RSI: v('rsi'),
    'Revenue Growth': v('revenue_growth'),
    'Earnings Growth': v('earnings_growth'),
    'Forward P/E': v('forward_pe'),
    'Analyst Rating': s('analyst_rating'),
    'Analyst Mean': v('analyst_mean'),
    'Target Price': v('target_price'),
    Sentiment: s('sentiment'),
    fetch_timestamp: String(row.fetch_timestamp ?? ''),
    fetch_id: Number(row.fetch_id ?? 0),
  };
}

export async function getLatestMetrics(ticker: string): Promise<StockMetrics | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('metric_fetches')
    .select('*, stocks(*)')
    .eq('ticker', ticker)
    .order('fetch_timestamp', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  const fetchTime = new Date(data.fetch_timestamp).getTime();
  const hoursSince = (Date.now() - fetchTime) / (1000 * 60 * 60);
  if (hoursSince > 72) return null;

  return rowToMetrics(data, data.stocks);
}

export async function getAllLatestMetrics(): Promise<StockMetrics[]> {
  const sb = getServiceClient();

  const { data: stocks } = await sb.from('stocks').select('ticker');
  if (!stocks || stocks.length === 0) return [];

  const allMetrics: StockMetrics[] = [];

  // Get latest metric for each stock by fetching all and grouping
  const { data: fetches } = await sb
    .from('latest_metrics')
    .select('*, stocks(*)');

  if (!fetches) return [];

  for (const row of fetches) {
    // Only equities are useful in the screener / fundamental rankings — ETFs,
    // mutual funds and indices don't report the metrics we score on, so they'd
    // either get artificially low scores or pollute sector aggregates. Rows
    // without a quote_type set yet (legacy/un-backfilled) are still treated
    // as equities so we don't accidentally hide valid stocks.
    const stockRow = row.stocks as { quote_type?: string | null } | null | undefined;
    const qt = (stockRow?.quote_type ?? 'EQUITY').toUpperCase();
    if (qt !== 'EQUITY') continue;
    allMetrics.push(rowToMetrics(row, row.stocks));
  }

  return allMetrics;
}

export async function getAllTickers(): Promise<string[]> {
  const sb = getServiceClient();
  const { data } = await sb.from('stocks').select('ticker').order('ticker');
  return data?.map((r) => r.ticker) ?? [];
}

export async function getUniqueSectors(): Promise<string[]> {
  const sb = getServiceClient();
  // Only count sectors from equities; ETFs/funds don't have a meaningful sector.
  const { data } = await sb
    .from('stocks')
    .select('sector, quote_type')
    .or('quote_type.is.null,quote_type.eq.EQUITY');
  if (!data) return [];
  const sectors = [...new Set(data.map((r) => r.sector).filter((s) => s && s !== 'N/A'))];
  return sectors.sort();
}

export async function getStaleTickers(): Promise<string[]> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data: allStocks } = await sb.from('stocks').select('ticker');
  if (!allStocks) return [];

  const { data: freshFetches } = await sb
    .from('latest_metrics')
    .select('ticker, fetch_timestamp')
    .gte('fetch_timestamp', cutoff);

  const freshSet = new Set(freshFetches?.map((f) => f.ticker) ?? []);
  return allStocks.filter((s) => !freshSet.has(s.ticker)).map((s) => s.ticker);
}

export async function getPriceHistory(ticker: string): Promise<PriceHistoryPoint[] | null> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await sb
    .from('price_history')
    .select('*')
    .eq('ticker', ticker)
    .gte('fetch_timestamp', cutoff)
    .order('fetch_timestamp', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return JSON.parse(data.history_json);
}

export async function savePriceHistory(ticker: string, history: PriceHistoryPoint[]): Promise<void> {
  const sb = getServiceClient();
  await sb.from('price_history').insert({
    ticker,
    fetch_timestamp: new Date().toISOString(),
    history_json: JSON.stringify(history),
  });
}

export async function touchStockView(ticker: string): Promise<void> {
  const sb = getServiceClient();
  await sb
    .from('stocks')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('ticker', ticker);
}

export async function getRecentlyViewedTickers(limit: number = 50): Promise<string[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('stocks')
    .select('ticker, last_viewed_at')
    .not('last_viewed_at', 'is', null)
    .order('last_viewed_at', { ascending: false })
    .limit(limit);
  return data?.map((r) => r.ticker) ?? [];
}

export async function getMetadata(key: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb.from('metadata').select('value').eq('key', key).single();
  return data?.value ?? null;
}

export async function setMetadata(key: string, value: string): Promise<void> {
  const sb = getServiceClient();
  await sb.from('metadata').upsert({ key, value }, { onConflict: 'key' });
}

export async function deleteStock(ticker: string): Promise<void> {
  const sb = getServiceClient();
  await sb.from('processed_results').delete().in(
    'fetch_id',
    sb.from('metric_fetches').select('fetch_id').eq('ticker', ticker) as unknown as number[]
  );
  await sb.from('metric_fetches').delete().eq('ticker', ticker);
  await sb.from('price_history').delete().eq('ticker', ticker);
  await sb.from('stocks').delete().eq('ticker', ticker);
}

export async function getLatestAiReview(
  ticker: string,
  maxAgeDays: number = 7
): Promise<AiReview | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('ai_reviews')
    .select('*')
    .eq('ticker', ticker)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.generated_at).getTime();
  if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) return null;
  return data as AiReview;
}

export async function saveAiReview(review: Omit<AiReview, 'id' | 'generated_at'> & { generated_at?: string }): Promise<AiReview | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('ai_reviews')
    .insert({
      ticker: review.ticker,
      generated_at: review.generated_at ?? new Date().toISOString(),
      bull_case: review.bull_case,
      bear_case: review.bear_case,
      institutional_sentiment: review.institutional_sentiment,
      retail_sentiment: review.retail_sentiment,
      key_metrics: review.key_metrics,
      verdict: review.verdict,
      confidence: review.confidence,
      model: review.model ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('AI review insert error:', error);
    return null;
  }
  return data as AiReview;
}

export async function getTickersWithStaleAiReviews(
  candidates: string[],
  maxAgeDays: number = 7
): Promise<string[]> {
  if (candidates.length === 0) return [];
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from('ai_reviews')
    .select('ticker, generated_at')
    .in('ticker', candidates)
    .gte('generated_at', cutoff);
  const fresh = new Set((data ?? []).map((r) => r.ticker));
  return candidates.filter((t) => !fresh.has(t));
}

export async function getLatestStockNews(
  ticker: string,
  maxAgeHours: number = 24
): Promise<StockNews | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('stock_news')
    .select('*')
    .eq('ticker', ticker)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.generated_at).getTime();
  if (ageMs > maxAgeHours * 60 * 60 * 1000) return null;
  return normalizeStockNews(data);
}

export async function saveStockNews(
  news: Omit<StockNews, 'id' | 'generated_at'> & { generated_at?: string }
): Promise<StockNews | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from('stock_news')
    .insert({
      ticker: news.ticker,
      generated_at: news.generated_at ?? new Date().toISOString(),
      summary: news.summary,
      headlines: news.headlines,
      model: news.model ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('Stock news insert error:', error);
    return null;
  }
  return normalizeStockNews(data);
}

function normalizeStockNews(row: Record<string, unknown>): StockNews {
  const rawHeadlines = row.headlines;
  let headlines: NewsHeadline[] = [];
  if (Array.isArray(rawHeadlines)) {
    headlines = rawHeadlines as NewsHeadline[];
  } else if (typeof rawHeadlines === 'string') {
    try {
      const parsed = JSON.parse(rawHeadlines);
      headlines = Array.isArray(parsed) ? parsed : [];
    } catch {
      headlines = [];
    }
  }
  return {
    id: row.id as number | undefined,
    ticker: String(row.ticker),
    generated_at: String(row.generated_at),
    summary: (row.summary as string) ?? '',
    headlines,
    model: (row.model as string | null) ?? null,
  };
}

export async function pruneOldMetrics(
  tickers?: string[],
  keepDays: number = 7
): Promise<number> {
  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();

  let query = sb
    .from('metric_fetches')
    .select('fetch_id, ticker, fetch_timestamp')
    .lt('fetch_timestamp', cutoff);

  if (tickers && tickers.length > 0) {
    query = query.in('ticker', tickers);
  }

  const { data: oldFetches } = await query;
  if (!oldFetches || oldFetches.length === 0) return 0;

  // Get latest fetch per ticker to keep
  const { data: latest } = await sb.from('latest_metrics').select('fetch_id');
  const latestIds = new Set(latest?.map((l) => l.fetch_id) ?? []);

  const toDelete = oldFetches
    .filter((f) => !latestIds.has(f.fetch_id))
    .map((f) => f.fetch_id);

  if (toDelete.length === 0) return 0;

  const { error } = await sb
    .from('metric_fetches')
    .delete()
    .in('fetch_id', toDelete);

  if (error) console.error('Prune error:', error);
  return toDelete.length;
}
