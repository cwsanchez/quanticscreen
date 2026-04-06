export interface Stock {
  ticker: string;
  company_name: string;
  industry: string;
  sector: string;
}

export interface MetricFetch {
  fetch_id: number;
  ticker: string;
  fetch_timestamp: string;
  pe: number | null;
  roe: number | null;
  de: number | null;
  pb: number | null;
  peg: number | null;
  gross_margin: number | null;
  net_profit_margin: number | null;
  fcf_ev: number | null;
  ebitda_ev: number | null;
  current_price: number | null;
  w52_high: number | null;
  w52_low: number | null;
  market_cap: number | null;
  ev: number | null;
  total_cash: number | null;
  total_debt: number | null;
  fcf_actual: number | null;
  ebitda_actual: number | null;
  p_fcf: number | null;
  beta: number | null;
  dividend_yield: number | null;
  avg_volume: number | null;
  rsi: number | null;
  revenue_growth: number | null;
  earnings_growth: number | null;
  forward_pe: number | null;
  analyst_rating: string | null;
  analyst_mean: number | null;
  target_price: number | null;
  sentiment: string | null;
}

export interface StockMetrics {
  Ticker: string;
  'Company Name': string;
  Industry: string;
  Sector: string;
  'P/E': number | 'N/A';
  ROE: number | 'N/A';
  'D/E': number | 'N/A';
  'P/B': number | 'N/A';
  PEG: number | 'N/A';
  'Gross Margin': number | 'N/A';
  'Net Profit Margin': number | 'N/A';
  'FCF % EV TTM': number | 'N/A';
  'EBITDA % EV TTM': number | 'N/A';
  'Current Price': number | 'N/A';
  '52W High': number | 'N/A';
  '52W Low': number | 'N/A';
  'Market Cap': number | 'N/A';
  EV: number | 'N/A';
  'Total Cash': number | 'N/A';
  'Total Debt': number | 'N/A';
  'FCF Actual': number | 'N/A';
  'EBITDA Actual': number | 'N/A';
  'P/FCF': number | 'N/A';
  Beta: number | 'N/A';
  'Dividend Yield': number | 'N/A';
  'Average Volume': number | 'N/A';
  RSI: number | 'N/A';
  'Revenue Growth': number | 'N/A';
  'Earnings Growth': number | 'N/A';
  'Forward P/E': number | 'N/A';
  'Analyst Rating': string | 'N/A';
  'Analyst Mean': number | 'N/A';
  'Target Price': number | 'N/A';
  Sentiment: string | 'N/A';
  fetch_timestamp?: string;
  fetch_id?: number;
}

export interface FlagLogic {
  enabled: boolean;
  boost: number;
}

export type LogicConfig = Record<string, FlagLogic>;

export interface ScoringWeights {
  [metric: string]: number;
}

export interface ProcessorConfig {
  weights: ScoringWeights;
  metrics: string[];
  logic: LogicConfig;
}

export interface FactorBoosts {
  value: number;
  momentum: number;
  quality: number;
  growth: number;
}

export interface ProcessedResult {
  base_score: number;
  final_score: number;
  flags: string[];
  positives: string[];
  risks: string;
  factor_boosts: FactorBoosts;
  metrics: StockMetrics;
  cap_category: string;
}

export interface PriceHistoryPoint {
  date: string;
  close: number;
}

export interface PresetConfig {
  name: string;
  weights: ScoringWeights;
  metrics: string[];
  logic: LogicConfig;
}

export interface UserPreset {
  id: string;
  user_id: string;
  name: string;
  config: ProcessorConfig;
  is_community: boolean;
  created_at: string;
  updated_at: string;
}

export interface Rankings {
  [key: string]: string;
}

export type MetricValue = number | 'N/A';
