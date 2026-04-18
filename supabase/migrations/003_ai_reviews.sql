-- AI reviews table — cached xAI Grok company analysis (weekly)
CREATE TABLE IF NOT EXISTS ai_reviews (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bull_case TEXT,
  bear_case TEXT,
  institutional_sentiment TEXT,
  retail_sentiment TEXT,
  key_metrics JSONB DEFAULT '{}'::JSONB,
  verdict TEXT,
  confidence INTEGER,
  model TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_ticker ON ai_reviews(ticker);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_generated ON ai_reviews(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reviews_ticker_generated ON ai_reviews(ticker, generated_at DESC);

-- View of the latest AI review per ticker
CREATE OR REPLACE VIEW latest_ai_reviews AS
SELECT DISTINCT ON (ar.ticker) ar.*
FROM ai_reviews ar
ORDER BY ar.ticker, ar.generated_at DESC;

-- Track most recent view of each ticker so cron can prioritize recently viewed stocks
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_stocks_last_viewed ON stocks(last_viewed_at DESC);
