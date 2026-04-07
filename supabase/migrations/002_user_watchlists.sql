-- User watchlists table for pinning stocks
CREATE TABLE IF NOT EXISTS user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stock_symbol TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0,
  UNIQUE(user_id, stock_symbol)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlists_user ON user_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlists_symbol ON user_watchlists(stock_symbol);

ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist"
  ON user_watchlists
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watchlist"
  ON user_watchlists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist"
  ON user_watchlists
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own watchlist"
  ON user_watchlists
  FOR DELETE
  USING (auth.uid() = user_id);
