import yahooFinance from 'yahoo-finance2';
import type { StockMetrics, PriceHistoryPoint } from '@/types';

export async function fetchStockMetrics(
  ticker: string
): Promise<StockMetrics | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const quote = await yahooFinance.quoteSummary(ticker, {
        modules: [
          'price',
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
          'recommendationTrend',
          'earningsTrend',
        ],
      });

      const price = quote.price;
      const summary = quote.summaryDetail;
      const keyStats = quote.defaultKeyStatistics;
      const financial = quote.financialData;

      const marketCap = price?.marketCap ?? null;
      const freeCashflow = financial?.freeCashflow ?? null;
      const ev = keyStats?.enterpriseValue ?? null;
      const ebitda = financial?.ebitda ?? null;

      let pe: number | 'N/A' = summary?.trailingPE ?? 'N/A';
      if (pe === 'N/A' && marketCap && financial?.earningsGrowth) {
        const trailingEps = price?.regularMarketPrice
          ? marketCap / (price.regularMarketPrice * 1)
          : null;
        if (trailingEps && trailingEps !== 0) {
          pe = marketCap / trailingEps;
        }
      }

      let peg: number | 'N/A' = keyStats?.pegRatio ?? 'N/A';
      if (peg === 'N/A') {
        const peForPeg =
          (summary?.trailingPE ?? summary?.forwardPE) ?? null;
        const growth = keyStats?.earningsQuarterlyGrowth ?? 0;
        if (peForPeg && growth > 0) {
          peg = peForPeg / (growth * 100);
        }
      }

      let pFcf: number | 'N/A' = 'N/A';
      if (freeCashflow && freeCashflow > 0 && marketCap && marketCap > 0) {
        pFcf = marketCap / freeCashflow;
      }

      const roe = financial?.returnOnEquity
        ? financial.returnOnEquity * 100
        : 'N/A';
      const deRaw = financial?.debtToEquity;
      const de = deRaw != null ? deRaw / 100 : 'N/A';

      const grossMargins = financial?.grossMargins
        ? financial.grossMargins * 100
        : 'N/A';
      const profitMargins = financial?.profitMargins
        ? financial.profitMargins * 100
        : 'N/A';

      const fcfEv =
        freeCashflow && ev ? (freeCashflow / ev) * 100 : 'N/A';
      const ebitdaEv = ebitda && ev ? (ebitda / ev) * 100 : 'N/A';

      const dividendYield = summary?.dividendYield
        ? summary.dividendYield * 100
        : 'N/A';

      const revenueGrowth = financial?.revenueGrowth
        ? financial.revenueGrowth * 100
        : 'N/A';
      const earningsGrowth = financial?.earningsGrowth
        ? financial.earningsGrowth * 100
        : 'N/A';

      const analystRating = financial?.recommendationKey ?? 'N/A';
      const analystMean = financial?.recommendationMean ?? 'N/A';
      const targetPrice = financial?.targetMeanPrice ?? 'N/A';

      let sentiment: string | 'N/A' = 'N/A';
      if (typeof analystMean === 'number') {
        if (analystMean <= 2) sentiment = 'Bullish';
        else if (analystMean === 3) sentiment = 'Neutral';
        else sentiment = 'Bearish';
      }

      let rsi: number | 'N/A' = 'N/A';
      try {
        const hist = await yahooFinance.chart(ticker, {
          period1: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          interval: '1d',
        });
        const closes =
          hist.quotes?.map((q) => q.close).filter(Boolean) ?? [];
        if (closes.length >= 14) {
          const deltas = [];
          for (let i = 1; i < closes.length; i++) {
            deltas.push((closes[i] as number) - (closes[i - 1] as number));
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
        // RSI calculation failed, leave as N/A
      }

      const metrics: StockMetrics = {
        Ticker: ticker,
        'Company Name': price?.longName ?? price?.shortName ?? 'N/A',
        Industry: price?.quoteType === 'EQUITY' ? (summary as Record<string, unknown>)?.industry as string ?? 'N/A' : 'N/A',
        Sector: 'N/A',
        'P/E': pe,
        ROE: roe,
        'D/E': de,
        'P/B': summary?.priceToBook ?? 'N/A',
        PEG: peg,
        'Gross Margin': grossMargins,
        'Net Profit Margin': profitMargins,
        'FCF % EV TTM': fcfEv,
        'EBITDA % EV TTM': ebitdaEv,
        'Current Price': price?.regularMarketPrice ?? 'N/A',
        '52W High': summary?.fiftyTwoWeekHigh ?? 'N/A',
        '52W Low': summary?.fiftyTwoWeekLow ?? 'N/A',
        'Market Cap': marketCap ?? 'N/A',
        EV: ev ?? 'N/A',
        'Total Cash': financial?.totalCash ?? 'N/A',
        'Total Debt': financial?.totalDebt ?? 'N/A',
        'FCF Actual': freeCashflow ?? 'N/A',
        'EBITDA Actual': ebitda ?? 'N/A',
        'P/FCF': pFcf,
        Beta: summary?.beta ?? 'N/A',
        'Dividend Yield': dividendYield,
        'Average Volume': price?.averageDailyVolume3Month ?? summary?.averageVolume ?? 'N/A',
        RSI: rsi,
        'Revenue Growth': revenueGrowth,
        'Earnings Growth': earningsGrowth,
        'Forward P/E': summary?.forwardPE ?? 'N/A',
        'Analyst Rating': analystRating,
        'Analyst Mean': analystMean,
        'Target Price': targetPrice,
        Sentiment: sentiment,
      };

      // Try to get sector/industry from quote modules
      try {
        const assetProfile = await yahooFinance.quoteSummary(ticker, {
          modules: ['assetProfile'],
        });
        if (assetProfile.assetProfile) {
          metrics.Sector = assetProfile.assetProfile.sector ?? 'N/A';
          metrics.Industry = assetProfile.assetProfile.industry ?? metrics.Industry;
        }
      } catch {
        // Sector/Industry fetch failed
      }

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

export async function fetchPriceHistory(
  ticker: string,
  period: string = '1y'
): Promise<PriceHistoryPoint[]> {
  try {
    const periodMap: Record<string, number> = {
      '1m': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365,
      '2y': 730,
      '5y': 1825,
    };
    const days = periodMap[period] ?? 365;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await yahooFinance.chart(ticker, {
      period1: startDate.toISOString().split('T')[0],
      interval: '1d',
    });

    if (!result.quotes || result.quotes.length === 0) return [];

    return result.quotes
      .filter((q) => q.close != null && q.date != null)
      .map((q) => ({
        date: new Date(q.date!).toISOString().split('T')[0],
        close: Number(q.close!.toFixed(2)),
      }));
  } catch (err) {
    console.error(`Failed to fetch history for ${ticker}:`, err);
    return [];
  }
}

export async function searchTickers(
  query: string
): Promise<Array<{ symbol: string; name: string; type: string; exchange: string }>> {
  try {
    const results = await yahooFinance.search(query, { newsCount: 0 });
    return (results.quotes ?? [])
      .filter(
        (q) =>
          q.quoteType === 'EQUITY' &&
          q.symbol &&
          !q.symbol.includes('.')
      )
      .slice(0, 10)
      .map((q) => ({
        symbol: q.symbol ?? '',
        name: (q as Record<string, unknown>).longname as string ?? (q as Record<string, unknown>).shortname as string ?? q.symbol ?? '',
        type: q.quoteType ?? '',
        exchange: (q as Record<string, unknown>).exchange as string ?? '',
      }));
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}
