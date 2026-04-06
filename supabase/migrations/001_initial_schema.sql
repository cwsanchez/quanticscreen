-- QuanticScreen Database Schema
-- This migration creates all tables needed for the stock screening application.

-- Stocks table (primary reference)
CREATE TABLE IF NOT EXISTS stocks (
  ticker TEXT PRIMARY KEY,
  company_name TEXT DEFAULT 'N/A',
  industry TEXT DEFAULT 'N/A',
  sector TEXT DEFAULT 'N/A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metric fetches (raw data from Yahoo Finance)
CREATE TABLE IF NOT EXISTS metric_fetches (
  fetch_id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  fetch_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pe DOUBLE PRECISION,
  roe DOUBLE PRECISION,
  de DOUBLE PRECISION,
  pb DOUBLE PRECISION,
  peg DOUBLE PRECISION,
  gross_margin DOUBLE PRECISION,
  net_profit_margin DOUBLE PRECISION,
  fcf_ev DOUBLE PRECISION,
  ebitda_ev DOUBLE PRECISION,
  current_price DOUBLE PRECISION,
  w52_high DOUBLE PRECISION,
  w52_low DOUBLE PRECISION,
  market_cap DOUBLE PRECISION,
  ev DOUBLE PRECISION,
  total_cash DOUBLE PRECISION,
  total_debt DOUBLE PRECISION,
  fcf_actual DOUBLE PRECISION,
  ebitda_actual DOUBLE PRECISION,
  p_fcf DOUBLE PRECISION,
  beta DOUBLE PRECISION,
  dividend_yield DOUBLE PRECISION,
  avg_volume DOUBLE PRECISION,
  rsi DOUBLE PRECISION,
  revenue_growth DOUBLE PRECISION,
  earnings_growth DOUBLE PRECISION,
  forward_pe DOUBLE PRECISION,
  analyst_rating TEXT,
  analyst_mean DOUBLE PRECISION,
  target_price DOUBLE PRECISION,
  sentiment TEXT
);

CREATE INDEX IF NOT EXISTS idx_metric_fetches_ticker ON metric_fetches(ticker);
CREATE INDEX IF NOT EXISTS idx_metric_fetches_timestamp ON metric_fetches(fetch_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metric_fetches_ticker_timestamp ON metric_fetches(ticker, fetch_timestamp DESC);

-- View for latest metrics per ticker (used heavily by the app)
CREATE OR REPLACE VIEW latest_metrics AS
SELECT DISTINCT ON (mf.ticker) mf.*
FROM metric_fetches mf
ORDER BY mf.ticker, mf.fetch_timestamp DESC;

-- Processed results (cached scoring results)
CREATE TABLE IF NOT EXISTS processed_results (
  result_id BIGSERIAL PRIMARY KEY,
  fetch_id BIGINT REFERENCES metric_fetches(fetch_id) ON DELETE CASCADE,
  base_score DOUBLE PRECISION,
  final_score DOUBLE PRECISION,
  flags JSONB DEFAULT '[]'::JSONB,
  positives TEXT,
  risks TEXT,
  factor_boosts JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_results_fetch ON processed_results(fetch_id);

-- Price history
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  fetch_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  history_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_ticker ON price_history(ticker);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(fetch_timestamp DESC);

-- Metadata (key-value store for app state)
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- User presets (for future auth integration)
CREATE TABLE IF NOT EXISTS user_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  is_community BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presets_user ON user_presets(user_id);

-- Enable Row Level Security on user_presets
ALTER TABLE user_presets ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_presets
CREATE POLICY "Users can view their own presets"
  ON user_presets
  FOR SELECT
  USING (auth.uid() = user_id OR is_community = TRUE);

CREATE POLICY "Users can insert their own presets"
  ON user_presets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets"
  ON user_presets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets"
  ON user_presets
  FOR DELETE
  USING (auth.uid() = user_id);
