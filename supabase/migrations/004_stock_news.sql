-- Stock news cache: Grok-generated headlines + summary per ticker, refreshed daily.
CREATE TABLE IF NOT EXISTS stock_news (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT,
  headlines JSONB NOT NULL DEFAULT '[]'::JSONB,
  model TEXT
);

CREATE INDEX IF NOT EXISTS idx_stock_news_ticker ON stock_news(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_news_generated ON stock_news(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_news_ticker_generated ON stock_news(ticker, generated_at DESC);

-- View of the latest news entry per ticker
CREATE OR REPLACE VIEW latest_stock_news AS
SELECT DISTINCT ON (sn.ticker) sn.*
FROM stock_news sn
ORDER BY sn.ticker, sn.generated_at DESC;
