import type {
  StockMetrics,
  LogicConfig,
  ScoringWeights,
  FactorBoosts,
  ProcessedResult,
  FlagLogic,
} from '@/types';

export function getFloat(metrics: StockMetrics, key: string): number {
  const val = (metrics as unknown as Record<string, unknown>)[key];
  if (val === 'N/A' || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

export function formatLarge(val: number): string {
  if (val >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  return val.toFixed(2);
}

export function getCapCategory(marketCap: number | 'N/A'): string {
  if (marketCap === 'N/A') return 'Unknown';
  const cap = Number(marketCap);
  if (isNaN(cap)) return 'Unknown';
  if (cap > 200e9) return 'Mega Cap';
  if (cap >= 10e9) return 'Large Cap';
  if (cap >= 2e9) return 'Mid Cap';
  if (cap >= 300e6) return 'Small Cap';
  if (cap >= 50e6) return 'Micro Cap';
  return 'Nano Cap';
}

export const CONDITIONS: Record<string, (m: StockMetrics) => boolean> = {
  Undervalued: (m) => getFloat(m, 'P/E') < 15 && getFloat(m, 'ROE') > 15,
  'Strong Balance Sheet': (m) =>
    getFloat(m, 'D/E') < 1 &&
    getFloat(m, 'Total Cash') > getFloat(m, 'Total Debt'),
  'Quality Moat': (m) =>
    getFloat(m, 'Gross Margin') > 40 &&
    getFloat(m, 'Net Profit Margin') > 15 &&
    getFloat(m, 'FCF % EV TTM') > 5,
  GARP: (m) => getFloat(m, 'PEG') < 1.5 && getFloat(m, 'P/E') < 20,
  'High-Risk Growth': (m) =>
    getFloat(m, 'P/E') > 30 && getFloat(m, 'PEG') < 1,
  'Value Trap': (m) =>
    getFloat(m, 'P/B') < 1.5 && getFloat(m, 'ROE') < 5,
  'Momentum Building': (m) =>
    getFloat(m, 'Current Price') > 0.9 * getFloat(m, '52W High') &&
    getFloat(m, 'EBITDA % EV TTM') > 5,
  'Debt Burden': (m) =>
    getFloat(m, 'D/E') > 2 && getFloat(m, 'FCF % EV TTM') < 1,
};

export function getFlagDescription(
  flag: string,
  metrics: StockMetrics
): string {
  const m = metrics;
  const descriptions: Record<string, () => string> = {
    Undervalued: () => {
      if (m['P/E'] !== 'N/A' && m['ROE'] !== 'N/A') {
        return `Undervalued with P/E ${getFloat(m, 'P/E').toFixed(2)} and ROE ${getFloat(m, 'ROE').toFixed(2)}%`;
      }
      return 'Undervalued';
    },
    'Strong Balance Sheet': () => {
      if (
        m['D/E'] !== 'N/A' &&
        m['Total Cash'] !== 'N/A' &&
        m['Total Debt'] !== 'N/A'
      ) {
        return `Strong balance sheet with D/E ${getFloat(m, 'D/E').toFixed(2)} and cash exceeding debt`;
      }
      return 'Strong Balance Sheet';
    },
    'Quality Moat': () => {
      if (
        m['Gross Margin'] !== 'N/A' &&
        m['Net Profit Margin'] !== 'N/A' &&
        m['FCF % EV TTM'] !== 'N/A'
      ) {
        return `Quality moat with margins ${getFloat(m, 'Gross Margin').toFixed(2)}%/${getFloat(m, 'Net Profit Margin').toFixed(2)}% and FCF/EV ${getFloat(m, 'FCF % EV TTM').toFixed(2)}%`;
      }
      return 'Quality Moat';
    },
    GARP: () => {
      if (m['PEG'] !== 'N/A' && m['P/E'] !== 'N/A') {
        return `GARP with PEG ${getFloat(m, 'PEG').toFixed(2)} and P/E ${getFloat(m, 'P/E').toFixed(2)}`;
      }
      return 'GARP';
    },
    'High-Risk Growth': () => {
      if (m['P/E'] !== 'N/A' && m['PEG'] !== 'N/A') {
        return `High-risk growth with P/E ${getFloat(m, 'P/E').toFixed(2)} and PEG ${getFloat(m, 'PEG').toFixed(2)}`;
      }
      return 'High-Risk Growth';
    },
    'Value Trap': () => {
      if (m['P/B'] !== 'N/A' && m['ROE'] !== 'N/A') {
        return `Value trap with P/B ${getFloat(m, 'P/B').toFixed(2)} and ROE ${getFloat(m, 'ROE').toFixed(2)}%`;
      }
      return 'Value Trap';
    },
    'Momentum Building': () => {
      if (
        m['Current Price'] !== 'N/A' &&
        m['52W High'] !== 'N/A' &&
        m['EBITDA % EV TTM'] !== 'N/A'
      ) {
        return `Momentum building near 52W high with EBITDA/EV ${getFloat(m, 'EBITDA % EV TTM').toFixed(2)}%`;
      }
      return 'Momentum Building';
    },
    'Debt Burden': () => {
      if (m['D/E'] !== 'N/A' && m['FCF % EV TTM'] !== 'N/A') {
        return `Debt burden with D/E ${getFloat(m, 'D/E').toFixed(2)} and FCF/EV ${getFloat(m, 'FCF % EV TTM').toFixed(2)}%`;
      }
      return 'Debt Burden';
    },
  };
  return (descriptions[flag] ?? (() => flag))();
}

export const DEFAULT_LOGIC: LogicConfig = {
  Undervalued: { enabled: true, boost: 15 },
  'Strong Balance Sheet': { enabled: true, boost: 10 },
  'Quality Moat': { enabled: true, boost: 15 },
  GARP: { enabled: true, boost: 10 },
  'High-Risk Growth': { enabled: true, boost: -10 },
  'Value Trap': { enabled: true, boost: -10 },
  'Momentum Building': { enabled: true, boost: 5 },
  'Debt Burden': { enabled: true, boost: -15 },
};

export const PRESETS: Record<string, LogicConfig> = {
  Overall: DEFAULT_LOGIC,
  Value: {
    Undervalued: { enabled: true, boost: 20 },
    'Strong Balance Sheet': { enabled: true, boost: 15 },
    'Quality Moat': { enabled: true, boost: 10 },
    GARP: { enabled: true, boost: 5 },
    'High-Risk Growth': { enabled: true, boost: -5 },
    'Value Trap': { enabled: true, boost: -5 },
    'Momentum Building': { enabled: true, boost: 0 },
    'Debt Burden': { enabled: true, boost: -20 },
  },
  Growth: {
    Undervalued: { enabled: true, boost: 5 },
    'Strong Balance Sheet': { enabled: true, boost: 5 },
    'Quality Moat': { enabled: true, boost: 5 },
    GARP: { enabled: true, boost: 20 },
    'High-Risk Growth': { enabled: true, boost: 10 },
    'Value Trap': { enabled: true, boost: -15 },
    'Momentum Building': { enabled: true, boost: 10 },
    'Debt Burden': { enabled: true, boost: -10 },
  },
  Momentum: {
    Undervalued: { enabled: true, boost: 5 },
    'Strong Balance Sheet': { enabled: true, boost: 5 },
    'Quality Moat': { enabled: true, boost: 5 },
    GARP: { enabled: true, boost: 5 },
    'High-Risk Growth': { enabled: true, boost: 5 },
    'Value Trap': { enabled: true, boost: -15 },
    'Momentum Building': { enabled: true, boost: 20 },
    'Debt Burden': { enabled: true, boost: -10 },
  },
  Quality: {
    Undervalued: { enabled: true, boost: 10 },
    'Strong Balance Sheet': { enabled: true, boost: 20 },
    'Quality Moat': { enabled: true, boost: 20 },
    GARP: { enabled: true, boost: 5 },
    'High-Risk Growth': { enabled: true, boost: -15 },
    'Value Trap': { enabled: true, boost: -15 },
    'Momentum Building': { enabled: true, boost: 5 },
    'Debt Burden': { enabled: true, boost: -20 },
  },
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
  'P/E': 0.2,
  ROE: 0.2,
  'P/B': 0.1,
  PEG: 0.15,
  'Gross Margin': 0.1,
  'Net Profit Margin': 0.1,
  'FCF % EV TTM': 0.1,
  'EBITDA % EV TTM': 0.05,
};

export const DEFAULT_METRICS = Object.keys(DEFAULT_WEIGHTS);

const METRIC_NORMALIZERS: Record<string, (v: number) => number> = {
  'P/E': (v) => Math.max(0, Math.min(100, 100 - v * 2)),
  ROE: (v) => Math.max(0, Math.min(100, v * 4)),
  'D/E': (v) => Math.max(0, Math.min(100, 100 - v * 50)),
  'P/B': (v) => Math.max(0, Math.min(100, 100 - v * 20)),
  PEG: (v) => Math.max(0, Math.min(100, 100 - v * 50)),
  'Gross Margin': (v) => Math.max(0, Math.min(100, v)),
  'Net Profit Margin': (v) => Math.max(0, Math.min(100, v)),
  'FCF % EV TTM': (v) => Math.max(0, Math.min(100, v * 10)),
  'EBITDA % EV TTM': (v) => Math.max(0, Math.min(100, v * 10)),
};

export function processStock(
  metrics: StockMetrics,
  weights?: ScoringWeights | null,
  selectedMetrics?: string[] | null,
  logic?: LogicConfig | null
): ProcessedResult {
  const w = weights ?? DEFAULT_WEIGHTS;
  const selected = selectedMetrics ?? Object.keys(w);
  const lg = logic ?? DEFAULT_LOGIC;

  const pe = getFloat(metrics, 'P/E');
  const roe = getFloat(metrics, 'ROE');
  const de = getFloat(metrics, 'D/E');
  const pb = getFloat(metrics, 'P/B');
  const peg = getFloat(metrics, 'PEG');
  const gross = getFloat(metrics, 'Gross Margin');
  const price = getFloat(metrics, 'Current Price');
  const high = getFloat(metrics, '52W High');
  const p_fcf = getFloat(metrics, 'P/FCF');
  const revenueGrowth = getFloat(metrics, 'Revenue Growth');
  const earningsGrowth = getFloat(metrics, 'Earnings Growth');
  const forwardPe = getFloat(metrics, 'Forward P/E');
  const rsi = getFloat(metrics, 'RSI');
  const beta = getFloat(metrics, 'Beta');
  const dividend = getFloat(metrics, 'Dividend Yield');
  const avgVolume = getFloat(metrics, 'Average Volume');

  const normScores: Record<string, number> = {};
  for (const metric of selected) {
    const normalizer = METRIC_NORMALIZERS[metric] ?? (() => 0);
    normScores[metric] = normalizer(getFloat(metrics, metric));
  }

  const totalWeight = selected.reduce((sum, m) => sum + (w[m] ?? 0), 0);
  const baseScore =
    totalWeight > 0
      ? selected.reduce(
          (sum, m) => sum + normScores[m] * (w[m] ?? 0),
          0
        ) / totalWeight
      : 0;

  const flags: string[] = [];
  let boostTotal = 0;
  const positives: string[] = [];
  let risks = '';

  for (const flag of Object.keys(lg)) {
    const flagConfig = lg[flag] as FlagLogic;
    if (flagConfig.enabled && CONDITIONS[flag] && CONDITIONS[flag](metrics)) {
      flags.push(flag);
      const boost = flagConfig.boost;
      boostTotal += boost;
      const desc = getFlagDescription(flag, metrics);
      positives.push(desc);
      if (boost < 0) {
        risks += `${flag} (${boost}%) `;
      }
    }
  }

  const factorBoosts: FactorBoosts = {
    value:
      p_fcf < 15 || (pb < 1.5 && roe > 15) ? 20 : p_fcf < 20 ? 10 : 0,
    momentum:
      price > 0.9 * high &&
      rsi > 50 &&
      rsi < 70 &&
      avgVolume > 1000000 &&
      roe > 15
        ? 20
        : price > 0.8 * high
          ? 10
          : 0,
    quality:
      roe > 20 && de < 1 && gross > 40 && dividend > 2 && beta < 1
        ? 20
        : roe > 15 && de < 1.5
          ? 10
          : 0,
    growth:
      peg < 1.5 &&
      revenueGrowth > 10 &&
      earningsGrowth > 10 &&
      forwardPe < 25 &&
      de < 1
        ? 20
        : peg < 2
          ? 10
          : 0,
  };

  const factorBoostTotal = Object.values(factorBoosts).reduce(
    (a, b) => a + b,
    0
  );
  const finalScore =
    baseScore + baseScore * (boostTotal / 100) + factorBoostTotal;

  return {
    base_score: baseScore,
    final_score: finalScore,
    flags,
    positives:
      positives.length > 0
        ? positives
        : ['Solid fundamentals based on available metrics.'],
    risks: risks || 'Low risks based on available metrics.',
    factor_boosts: factorBoosts,
    metrics,
    cap_category: getCapCategory(metrics['Market Cap']),
  };
}

export const NEGATIVE_FLAGS = new Set([
  'Value Trap',
  'High-Risk Growth',
  'Debt Burden',
]);

export const FLAG_NAMES = Object.keys(CONDITIONS);
