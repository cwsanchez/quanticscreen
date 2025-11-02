# QuanticScreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

QuanticScreen is a Streamlit-based web application for screening and analyzing stocks. It fetches financial metrics from Yahoo Finance using yfinance, stores them in a PostgreSQL database (optimized for Neon DB, with fallback to local SQLite), and applies customizable scoring logic to rank stocks. Data is refreshed in the background for existing tickers only, with stale thresholds of 12 hours. The app supports dataset filtering (e.g., by sector, market cap, presets, or custom sets limited to existing data), search, flag-based filters, top N results, and CSV exports. Configurations include metric selection, weights (0-0.3), and flag boosts. A password-protected Manage page allows admins to add/refresh/delete tickers with rate limits to prevent abuse. No automatic seeding of new tickers—additions are manual via Manage. If the DB is empty, it displays sample data for testing.

This project is in an early prototype stage, suitable for personal use or small-scale deployment. It's not production-ready for high traffic but includes basic optimizations like batched queries and caching.

## Features

- **Data Fetching and Storage**: Metrics from yfinance cached in Neon PostgreSQL (via `DATABASE_URL` secret) or SQLite fallback. Background refreshes for stale data (>12 hours old) run every 15 minutes during US market hours (9:30 AM - 4:00 PM ET, weekdays only), in batches of 5-10 with 5-10s delays to respect rate limits.
- **Scoring and Processing**: On-the-fly processing with customizable logic (e.g., P/E, ROE, PEG weights; flags like Undervalued, GARP with boosts). Presets for Overall, Value, Growth, Momentum, Quality—read-only in Customize page.
- **Filters and Views**: Select datasets (All from DB, market cap sizes, value/growth presets, sectors, custom sets). Search by ticker/company, filter by flags, exclude negatives, top N (default 100, up to 200) or show all. Ranked interactive table with sortable columns (e.g., Score, P/E, ROE, Market Cap, P/FCF).
- **Customization**: Edit configs via sliders; save new ones without overwriting presets. Includes new metrics like Beta, Dividend Yield, RSI, Revenue/Earnings Growth.
- **Admin Management (Password-Protected)**: Manage page for manual stale refresh (2-hour cooldown), add/refresh 1-20 tickers (1-hour cooldown, prioritizes new), delete 1-5 tickers (5-min cooldown). Pulls password from secrets.toml.
- **Exports and UX**: CSV download for results. Progress bars/spinners for long ops. Warnings for missing tickers in custom sets (skipped, direct to Manage).
- **Error Handling**: Logs for missing metrics (e.g., PEG fallbacks), fetch failures, and skips invalid inputs.

## Setup

1. Clone the repo: `git clone https://github.com/yourusername/quanticscreen.git` (replace with your repo URL).
2. Navigate to the directory: `cd quanticscreen`.
3. Create and activate a virtual environment: `python -m venv .venv` then `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix/Mac).
4. Install dependencies: `pip install -r requirements.txt`.
5. Set up secrets: Create `.streamlit/secrets.toml` with:
   ```
   DATABASE_URL = "postgresql://your_neon_user:your_password@your_neon_host/your_db?sslmode=require"
   admin_password = "your_secure_password"
   ```
   (Replace with your Neon creds and a strong password.)
6. Run the app locally: `streamlit run QuanticScreen.py --server.fileWatcherType none`.

For deployment (e.g., Streamlit Cloud):
- Push to GitHub.
- Connect to Streamlit Cloud, set Python 3.13, and add secrets via Advanced Settings > Secrets (paste the TOML content).
- Deploy—app auto-starts.

## Usage

- **Main Dashboard (QuanticScreen)**:
  - Sidebar: Select dataset (All, cap sizes, presets, sectors, custom sets—limited to DB data).
  - Config: Choose preset or custom; filters for search, flags, negatives, top N.
  - Output: Ranked table (sortable, excludes columns via multiselect). Export CSV.
  - Custom Sets: Add via name and comma-separated tickers (up to 50, validated); skips non-DB tickers with warning to use Manage.

- **Customize Page**: Load/edit configs (metrics, weights, boosts); presets read-only—save as new.

- **Manage Page (Admin-Only)**: Enter password (from secrets). Features:
  - Manual Refresh: Triggers stale refresh (like background, 2-hour cooldown).
  - Add/Refresh Tickers: 1-20 comma-separated (1-hour cooldown); adds new or refreshes existing.
  - Delete Tickers: 1-5 comma-separated (5-min cooldown); cascades to related data.

- **Background Operations**: Auto-refreshes existing stale data during market hours/weekdays. No new additions.

If DB is empty/fails, shows samples (AAPL, MSFT, etc.) with mock metrics.

## Limitations

- **Data Gaps**: yfinance may have N/A (e.g., Dividend Yield, PEG—logs warnings; uses fallbacks like calculated P/E).
- **No Real-Time**: Background refreshes are scheduled; manual for admins only.
- **Custom Sets**: Limited to existing DB tickers—no auto-fetch; warn/skips others.
- **Performance**: Handles ~1700 tickers; larger sets may slow without further optimization.
- **Security**: Basic password for Manage; deploy privately or add full auth for public use.
- **Dependencies**: Relies on yfinance (potential delays/bans if overused) and Neon (plan limits on branches/storage).
- **Maturity**: Prototype—basic features work, but lacks tests, advanced error recovery, or scalability for 10k+ tickers.

## Contributing

Fork the repo, make changes, and submit pull requests. Report issues on GitHub. Welcome contributions for new metrics (e.g., more ML-based), UI polish, tests, or integrations (e.g., other APIs). Follow MIT license.