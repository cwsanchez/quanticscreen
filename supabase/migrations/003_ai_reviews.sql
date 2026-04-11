-- AI Reviews table for xAI Grok-generated company analysis
CREATE TABLE IF NOT EXISTS ai_reviews (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bull_case TEXT,
  bear_case TEXT,
  institutional_sentiment TEXT,
  retail_sentiment TEXT,
  key_metrics JSONB,
  verdict TEXT,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100)
);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_ticker ON ai_reviews(ticker);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_generated ON ai_reviews(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_ticker_generated ON ai_reviews(ticker, generated_at DESC);
