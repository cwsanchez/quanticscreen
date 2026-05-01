import YahooFinance from 'yahoo-finance2';
import type { StockMetrics, PriceHistoryPoint } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const yahooFinance = new YahooFinance();

export async function fetchStockMetrics(
  ticker: string
): Promise<StockMetrics | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const quote: any = await yahooFinance.quoteSummary(ticker, {
        modules: [
          'price',
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
          'assetProfile',
        ],
      });

      const price = quote.price ?? {};
      const summary = quote.summaryDetail ?? {};
      const keyStats = quote.defaultKeyStatistics ?? {};
      const financial = quote.financialData ?? {};
      const profile = quote.assetProfile ?? {};

      const marketCap = price.marketCap ?? null;
      const freeCashflow = financial.freeCashflow ?? null;
      const ev = keyStats.enterpriseValue ?? null;
      const ebitda = financial.ebitda ?? null;

      let pe: number | 'N/A' = summary.trailingPE ?? 'N/A';
      if (pe === 'N/A') {
        const trailingEps = price.regularMarketPrice && marketCap
          ? marketCap / price.regularMarketPrice
          : null;
        if (trailingEps && trailingEps !== 0 && marketCap) {
          pe = marketCap / trailingEps;
        }
      }

      let peg: number | 'N/A' = keyStats.pegRatio ?? 'N/A';
      if (peg === 'N/A') {
        const peForPeg = summary.trailingPE ?? summary.forwardPE ?? null;
        const growth = keyStats.earningsQuarterlyGrowth ?? 0;
        if (peForPeg && growth > 0) {
          peg = peForPeg / (growth * 100);
        }
      }

      let pFcf: number | 'N/A' = 'N/A';
      if (freeCashflow && freeCashflow > 0 && marketCap && marketCap > 0) {
        pFcf = marketCap / freeCashflow;
      }

      const roe = financial.returnOnEquity != null
        ? financial.returnOnEquity * 100
        : 'N/A';
      const deRaw = financial.debtToEquity;
      const de = deRaw != null ? deRaw / 100 : 'N/A';

      const grossMargins = financial.grossMargins != null
        ? financial.grossMargins * 100
        : 'N/A';
      const profitMargins = financial.profitMargins != null
        ? financial.profitMargins * 100
        : 'N/A';

      const fcfEv =
        freeCashflow && ev ? (freeCashflow / ev) * 100 : 'N/A';
      const ebitdaEv = ebitda && ev ? (ebitda / ev) * 100 : 'N/A';

      const dividendYield = summary.dividendYield != null
        ? summary.dividendYield * 100
        : 'N/A';

      const revenueGrowth = financial.revenueGrowth != null
        ? financial.revenueGrowth * 100
        : 'N/A';
      const earningsGrowth = financial.earningsGrowth != null
        ? financial.earningsGrowth * 100
        : 'N/A';

      const analystRating = financial.recommendationKey ?? 'N/A';
      const analystMean = financial.recommendationMean ?? 'N/A';
      const targetPrice = financial.targetMeanPrice ?? 'N/A';

      let sentiment: string | 'N/A' = 'N/A';
      if (typeof analystMean === 'number') {
        if (analystMean <= 2) sentiment = 'Bullish';
        else if (analystMean === 3) sentiment = 'Neutral';
        else sentiment = 'Bearish';
      }

      let rsi: number | 'N/A' = 'N/A';
      try {
        const hist: any = await yahooFinance.chart(ticker, {
          period1: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          interval: '1d',
        });
        const closes: number[] =
          (hist.quotes ?? [])
            .map((q: any) => q.close)
            .filter((c: any) => c != null) ?? [];
        if (closes.length >= 14) {
          const deltas: number[] = [];
          for (let i = 1; i < closes.length; i++) {
            deltas.push(closes[i] - closes[i - 1]);
          }
          const gains = deltas.map((d) => (d > 0 ? d : 0));
          const losses = deltas.map((d) => (d < 0 ? -d : 0));
          const period = 14;
          let avgGain =
            gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
          let avgLoss =
            losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
          for (let i = period; i < gains.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
          }
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi = 100 - 100 / (1 + rs);
        }
      } catch {
        // RSI calculation failed
      }

      const metrics: StockMetrics = {
        Ticker: ticker,
        'Company Name': price.longName ?? price.shortName ?? 'N/A',
        Industry: profile.industry ?? 'N/A',
        Sector: profile.sector ?? 'N/A',
        'P/E': pe,
        ROE: roe,
        'D/E': de,
        'P/B': summary.priceToBook ?? 'N/A',
        PEG: peg,
        'Gross Margin': grossMargins,
        'Net Profit Margin': profitMargins,
        'FCF % EV TTM': fcfEv,
        'EBITDA % EV TTM': ebitdaEv,
        'Current Price': price.regularMarketPrice ?? 'N/A',
        '52W High': summary.fiftyTwoWeekHigh ?? 'N/A',
        '52W Low': summary.fiftyTwoWeekLow ?? 'N/A',
        'Market Cap': marketCap ?? 'N/A',
        EV: ev ?? 'N/A',
        'Total Cash': financial.totalCash ?? 'N/A',
        'Total Debt': financial.totalDebt ?? 'N/A',
        'FCF Actual': freeCashflow ?? 'N/A',
        'EBITDA Actual': ebitda ?? 'N/A',
        'P/FCF': pFcf,
        Beta: summary.beta ?? 'N/A',
        'Dividend Yield': dividendYield,
        'Average Volume': price.averageDailyVolume3Month ?? summary.averageVolume ?? 'N/A',
        RSI: rsi,
        'Revenue Growth': revenueGrowth,
        'Earnings Growth': earningsGrowth,
        'Forward P/E': summary.forwardPE ?? 'N/A',
        'Analyst Rating': analystRating,
        'Analyst Mean': analystMean,
        'Target Price': targetPrice,
        Sentiment: sentiment,
      };

      return metrics;
    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed for ${ticker}:`, err);
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
  return null;
}

export type HistoryRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'Max';

type YahooInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo';

interface RangeSpec {
  interval: YahooInterval;
  /** Days back from now. null = since 1970 (max). */
  days: number | null;
  /** Whether the returned points are intraday (include time component). */
  intraday: boolean;
}

const RANGE_SPECS: Record<HistoryRange, RangeSpec> = {
  '1D': { interval: '5m', days: 2, intraday: true },
  '1W': { interval: '30m', days: 7, intraday: true },
  '1M': { interval: '1d', days: 35, intraday: false },
  '3M': { interval: '1d', days: 95, intraday: false },
  '6M': { interval: '1d', days: 190, intraday: false },
  '1Y': { interval: '1d', days: 370, intraday: false },
  '5Y': { interval: '1wk', days: 365 * 5 + 10, intraday: false },
  Max: { interval: '1mo', days: null, intraday: false },
};

export async function fetchPriceHistory(
  ticker: string,
  period: string = '1Y'
): Promise<PriceHistoryPoint[]> {
  const normalized = normalizeRange(period);
  const spec = RANGE_SPECS[normalized];
  const startDate = spec.days == null
    ? new Date('1970-01-01')
    : new Date(Date.now() - spec.days * 24 * 60 * 60 * 1000);

  try {
    const result: any = await yahooFinance.chart(ticker, {
      period1: startDate,
      interval: spec.interval,
    });

    if (!result.quotes || result.quotes.length === 0) return [];

    const points = result.quotes
      .filter((q: any) => q.close != null && q.date != null)
      .map((q: any) => {
        const iso = new Date(q.date).toISOString();
        return {
          date: spec.intraday ? iso : iso.split('T')[0],
          close: Number(Number(q.close).toFixed(2)),
        } satisfies PriceHistoryPoint;
      });

    if (normalized === '1D') {
      // Yahoo's 5m interval will include the last trading session even when
      // called on a weekend. Trim to the most recent trading day.
      return trimToMostRecentSession(points);
    }
    return points;
  } catch (err) {
    console.error(`Failed to fetch history for ${ticker} (${period}):`, err);
    return [];
  }
}

function normalizeRange(period: string): HistoryRange {
  const aliases: Record<string, HistoryRange> = {
    '1d': '1D',
    '1w': '1W',
    '5d': '1W',
    '1m': '1M',
    '1mo': '1M',
    '3m': '3M',
    '6m': '6M',
    '1y': '1Y',
    '5y': '5Y',
    max: 'Max',
  };
  return aliases[period.toLowerCase()] ?? (period as HistoryRange) ?? '1Y';
}

function trimToMostRecentSession(points: PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (points.length === 0) return points;
  const byDay = new Map<string, PriceHistoryPoint[]>();
  for (const p of points) {
    const d = p.date.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(p);
  }
  const days = [...byDay.keys()].sort();
  const lastDay = days[days.length - 1];
  return byDay.get(lastDay) ?? points;
}

export async function searchTickers(
  query: string
): Promise<Array<{ symbol: string; name: string; type: string; exchange: string }>> {
  try {
    const results: any = await yahooFinance.search(query, { newsCount: 0 });
    return (results.quotes ?? [])
      .filter(
        (q: any) =>
          q.quoteType === 'EQUITY' &&
          q.symbol &&
          !q.symbol.includes('.')
      )
      .slice(0, 10)
      .map((q: any) => ({
        symbol: q.symbol ?? '',
        name: q.longname ?? q.shortname ?? q.symbol ?? '',
        type: q.quoteType ?? '',
        exchange: q.exchange ?? '',
      }));
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}
