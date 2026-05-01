-- Track what kind of security a ticker is (EQUITY, ETF, MUTUALFUND, INDEX, etc.)
-- so the screener can exclude funds/indices that don't report the fundamental
-- metrics it relies on, while still allowing search & detail/AI pages to load
-- them like any other ticker.
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS quote_type TEXT;

CREATE INDEX IF NOT EXISTS idx_stocks_quote_type ON stocks(quote_type);
