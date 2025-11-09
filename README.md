# QuanticScreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://quanticscreen.streamlit.app/)

QuanticScreen is a prototype Streamlit web application for stock screening and analysis. It fetches financial metrics from Yahoo Finance using yfinance, stores them in a cloud PostgreSQL database (optimized for Neon DB via `DATABASE_URL` secret, with local SQLite fallback for testing), applies customizable scoring logic to rank stocks, and provides interactive filters, views, and summaries. The app emphasizes data freshness with controlled background refreshes for existing tickers only, security (admin-only additions/deletes), and usability (e.g., searchable rankings, CSV exports, stock summaries with graphs). Designed for personal use with ~1700 tickers in mind, it avoids abuse through rate limits and no public fetching of new tickers.

Key goals: Reliable data handling (refresh stale metrics in background; add new via admin), user-friendly UI (presets, filters, custom sets), and prototype maturity (basic tests, logging, open-sourcing prep). Avoids new dependencies; prioritizes Python 3.13, PEP 8, and logging.

## Features

- **Data Fetching & Storage**: Metrics (e.g., P/E, ROE, PEG, RSI, analyst sentiment) from yfinance, stored in Neon PostgreSQL or SQLite. Background refreshes stale data (>12 hours or older than last market close) during sessions, in batches (3-5) with random sleeps (10-30s). Prunes old metrics (>7 days, keeping latest per ticker).
- **Scoring & Processing**: Customizable weights (0-0.3), metrics selection, and flag logic (e.g., Undervalued, GARP with boosts). Presets: Overall, Value, Growth, Momentum, Quality. Flags add positives/risks with descriptive metric details.
- **Filters & Views**: Datasets (All, by market cap category, sector, presets, custom sets—browser-stored, skips non-DB with warnings). Filters: Sectors, require flags (Any/All), top N, search ticker/company, exclude negatives. Ranked table (sortable, excludable columns).
- **Stock Summary**: Searchable dropdown (client-side filter as typing), shows all metrics (rounded/formatted), flags, bullet-point positives, 52W low/high bar, 1Y price graph (fetched if >24h stale), analyst sentiment, and 4x3 rankings grid (by preset vs. All/Category/Sector).
- **Admin Manage Page**: Password-protected (secrets.toml). Manual refresh all stale (2h cooldown), add/refresh 1-20 tickers (1h cooldown, prioritizes new/existing), delete 1-5 (5min cooldown, cascades), prune old metrics.
- **Customize Page**: Edit/save configs (weights, metrics, flag enables/boosts); presets read-only—save as new. JSON export/import.
- **Explanation Page**: Details metrics, flags, usage tips, limitations.
- **Other**: CSV exports, logging for all ops, rate-limited fetches, market hours/weekday checks (skippable for close-date logic), session_state persistence.

If DB empty, shows sample data (e.g., AAPL). No ML yet; prep for future integrations.

## Setup & Installation

1. **Clone Repo**:
   ```
   git clone https://github.com/yourusername/quanticscreen.git
   cd quanticscreen
   ```

2. **Install Dependencies** (Python 3.13 recommended):
   ```
   pip install -r requirements.txt
   ```
   Minimal deps: streamlit, yfinance, pandas, sqlalchemy, numpy, psycopg[binary].

3. **Configure Secrets** (secrets.toml in .streamlit/):
   ```
   [general]
   DATABASE_URL = "postgresql://user:pass@host/db?sslmode=require"
   admin_password = "your_secure_password"
   ```
   For Neon: Use project URL. Local: Falls back to SQLite (stock_screen.db).

4. **Run Locally**:
   ```
   streamlit run QuanticScreen.py
   ```
   Access at http://localhost:8501. Test UI/syntax with SQLite; push to branch for cloud DB tests (e.g., Streamlit Cloud with Neon).

5. **Deploy** (e.g., Streamlit Cloud):
   - Connect GitHub repo.
   - Add secrets (DATABASE_URL, admin_password).
   - Set entry: QuanticScreen.py.
   - Free tiers: Handles low traffic; monitor Neon storage/rows.

## Usage

- **Main Page**: Select dataset (e.g., custom—create via tickers, auto-fetches missing for existing), config/preset, filters (sectors/flags/top N/search). View ranked table, export CSV.
- **Stock Summary**: Dropdown search (type to filter), auto-loads details/graph on select.
- **Customize**: Edit/save configs; import/export JSON.
- **Manage (Admin)**: Password entry; refresh/add/delete/prune with cooldowns.
- **Explanation**: Learn metrics/flags/logic.
- **Background**: Auto-runs; logs in console. Custom sets fetch on creation if missing metrics.

For empty DB: Use Manage to add tickers (e.g., from tickers.py defaults).

## Architecture & Key Files

- **Core**:
  - `QuanticScreen.py`: Main Streamlit UI (datasets, filters, table, summary, background thread).
  - `fetcher.py`: yfinance fetches (metrics/history with retries/fallbacks).
  - `db.py`: SQLAlchemy models (Stock, MetricFetch, ProcessedResult, PriceHistory), functions (save/get/prune/stale).
  - `processor.py`: Scoring logic (process_stock, flags/positives with descriptions, cap categories).

- **Pages**:
  - `manage.py`: Admin tools (refresh/add/delete/prune).
  - `customize.py`: Config editor (weights/metrics/logic, presets read-only).
  - `explanation.py`: User guide (metrics/flags/usage).

- **Data Flow**: yfinance → fetch/save_metrics (upserts Stock) → process/save_processed. Queries: Batched/joinedload. Background: Thread checks market/close-date, refreshes batches, prunes post-fetch.

- **Other**: `tickers.py` (defaults from CSV), `requirements.txt` (deps), `secrets.toml` (DB/password), `README.md` (this).

## Limitations

- **Data**: yfinance gaps (e.g., PEG/P/FCF—fallbacks/logged). No real-time; refreshes session-based.
- **Custom Sets**: Browser-only (session_state); skips non-DB—use Manage to add.
- **Performance**: ~1700 tickers OK; larger may lag (no async yet). Free tiers (Streamlit/Neon) limit concurrent/storage.
- **Security**: Basic password; deploy privately. No user accounts.
- **Maturity**: Prototype—no full tests, error recovery limited, no ML/future features (e.g., backtesting).

## Contributing

Fork, branch, PR. Issues/PRs welcome for: UI polish, new metrics/flags, tests, ML integrations, async fetches, or scalability. Follow MIT license—credit if reusing.