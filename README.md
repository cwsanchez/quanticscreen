# QuanticScreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

QuanticScreen is a Streamlit-based web app for screening and analyzing stocks. It fetches financial data from Yahoo Finance using yfinance, caches metrics in a database (supports Neon/external PostgreSQL via DATABASE_URL env var, falls back to SQLite with 72-hour expiry), and performs on-the-fly processing. Configurations are customizable and stored ephemerally in session state, including metric inclusion/exclusion, weight sliders (0-0.3), and correlation flag boosts (±10% of default). Key features include dataset filters (All from DB, Cap sizes, Value/Growth presets, Sectors, Custom sets), search by ticker/company, flag filters, exclude negative scores, top N or show all results, sortable ranked table with details (including Market Cap and P/FCF metrics with fallbacks), CSV export, and algorithm presets (Overall, Value, Growth, Momentum, Quality—selectable on main page with read-only protection for presets in Customize). Background polling fetches stale data (>72h) every 15 mins during market hours (9:30 AM - 1:30 PM ET weekdays, prioritizing oldest). If DB fails/empty, shows 4 sample stocks (AAPL, MSFT, GOOGL, TSLA) with mock metrics. No initial seeding—use manual seeding script. No password—use private links for access.

## Setup

1. Clone the repo: `git clone https://github.com/cwsanchez/quanticscreen.git`
2. Navigate to the directory: `cd quanticscreen`
3. Create and activate a virtual environment: `python -m venv .venv` then `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix/Mac).
4. Install dependencies: `pip install -r requirements.txt`
5. Run the app: `streamlit run QuanticScreen.py --server.fileWatcherType none`

## Usage

- **Sidebar Navigation and Controls**:
  - Select pages: QuanticScreen (main dashboard), Stock Analysis (technical/fundamental/predictive), Portfolio, Backtesting, Customize (edit configs/presets), Explanation (metrics/logic details).
  - Dataset selection: All seeded tickers, by market cap size, value/growth presets, sectors, or custom sets (add any valid ticker; auto-fetches if unseeded).
  - Config: Choose from presets (Overall default, Value, Growth, Momentum, Quality) or custom—new configs start as NewConfig1 to avoid overwriting.
  - Filters: Top N results, show all, exclude negatives.

- **Main Dashboard (QuanticScreen)**:
  - Search by ticker or company name.
  - Flag filters for conditions like Undervalued, Quality Moat.
  - Ranked table: Sortable by score/metrics, with columns for Company (Ticker), Score, P/E, ROE, P/B, PEG, Gross Margin, FCF % EV TTM, P/FCF, D/E, Flags, Positives.
  - Export ranked results as CSV.

- **Stock Analysis Page**: Enter a symbol for technical (charts/indicators), fundamental (ratios/metrics), or predictive (ML-based forecasts) analysis.
- **Customize Page**: Load presets or create/edit configs with sliders; presets are read-only—save as new to avoid overwrites.
- **Explanation Page**: Details on metrics, scoring logic, flags, and app usage.
- **Seeding and Fetching**: No auto-seeding. You must manually seed ticker data into the database (edit TICKERS_STR in script). Background polling fetches stale data (>72h) every 15 mins during market hours (9:30 AM - 1:30 PM ET weekdays), prioritizing oldest, in batches of 5-10 with 5-10s sleeps. Custom sets queue new tickers for fetch (limited to 20/hour). If DB fails/empty, shows samples. Delete DB file or set DATABASE_URL for external DB.

## Summary of Changes

- **DB Support**: Added support for external DB (e.g., Neon PostgreSQL) via `DATABASE_URL` env var. Retries connection 3x with 5-10s sleeps; falls back to SQLite if fails.
- **No Initial Seeding**: Removed auto-seeding on launch. DB empty/fail shows 4 samples (AAPL, MSFT, GOOGL, TSLA) with mock metrics + warning.
- **Background Fetching**: Polls every 15 mins for stale data (>72h), updates during market hours (9:30 AM - 1:30 PM ET weekdays) if last fetch < today's open, prioritizing oldest in 5-10 batches with 5-10s sleeps.

## Limitations

- Data may have N/A for some metrics (e.g., PEG/P/FCF use fallbacks; logs warnings).
- Relies on yfinance—occasional gaps or delays; no real-time beyond manual refresh.
- Custom sets accept any valid ticker (regex-validated), but unseeded ones queued for fetch.
- Performance: DB size affects speed; use external DB for scalability.
- No password—use private deployment links for security.

## Contributing

Fork the repo and submit pull requests. Report issues on GitHub. Contributions welcome for new metrics, presets, or optimizations.