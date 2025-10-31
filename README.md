# QuanticScreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

QuanticScreen is a Streamlit-based web app for screening and analyzing stocks. It fetches financial data from Yahoo Finance using yfinance, caches metrics in a SQLite database (with 72-hour expiry), and performs on-the-fly processing. Configurations are customizable and stored ephemerally in session state, including metric inclusion/exclusion, weight sliders (0-0.3), and correlation flag boosts (±10% of default). Key features include seeding ~1500 prioritized tickers (large/mid caps from a CSV via generate_tickers.py), dataset filters (All, Cap sizes, Value/Growth presets, Sectors, Custom sets), search by ticker/company, flag filters, exclude negative scores, top N or show all results, sortable ranked table with details (including new Market Cap and P/FCF metrics with fallbacks), CSV export, factor sub-lists (value, momentum, quality, growth), warnings (e.g., high P/E), and algorithm presets (Value, Growth, Momentum, Quality—selectable in Customize with read-only protection for presets). Auto-fetches missing or expired data in the background on app launch (every 12 hours or after market hours). Protected by a single password via .env for security.

## Setup

1. Clone the repo: `git clone https://github.com/cwsanchez/quanticscreen.git`
2. Navigate to the directory: `cd quanticscreen`
3. Create and activate a virtual environment: `python -m venv .venv` then `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix/Mac).
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file in the root with `APP_PASSWORD=your_secret_password` for simple authentication.
6. Run the app: `streamlit run streamlit_app.py`

To disable the password for local use, comment out the authentication block in `streamlit_app.py` (around the password input and `st.stop()`).

For deployment (e.g., Streamlit Cloud), ensure `.env` is handled via secrets management, but note the app uses a simple password (no advanced auth).

## Usage

- **Sidebar Navigation and Controls**:
  - Select pages: QuanticScreen (main dashboard), Stock Analysis (technical/fundamental/predictive), Portfolio, Backtesting, Customize (edit configs/presets), Explanation (metrics/logic details).
  - Dataset selection: All seeded tickers, by market cap size, value/growth presets, sectors, or custom sets (add any valid ticker; auto-fetches if unseeded).
  - Config: Choose algorithm presets (Value for undervalued stocks, Growth for high-potential, Momentum for trends, Quality for stable) or custom—new configs start as NewConfig1 to avoid overwriting.
  - Refresh: Force data refresh; auto-handles in background.
  - Filters: Top N results, show all, exclude negatives.

- **Main Dashboard**:
  - Search by ticker or company name.
  - Flag filters for conditions like Undervalued, Quality Moat.
  - Ranked table: Sortable by score/metrics, with columns for Company (Ticker), Score, P/E, ROE, P/B, PEG, Gross Margin, FCF % EV TTM, P/FCF, D/E, Flags, Positives.
  - Export ranked results as CSV.
  - Factor sub-lists: Top 5 per factor (expandable).
  - Warnings: Highlights high-risk items like high P/E.

- **Stock Analysis Page**: Enter a symbol for technical (charts/indicators), fundamental (ratios/metrics), or predictive (ML-based forecasts) analysis.
- **Customize Page**: Load presets or create/edit configs with sliders; presets are read-only—save as new to avoid overwrites.
- **Explanation Page**: Details on metrics, scoring logic, flags, and app usage.
- **Seeding and Fetching**: App auto-seeds ~1500 tickers on first run or if DB empty; fetches only missing/expired data to respect yfinance limits. Delete `stock_screen.db` to reset.

## Limitations

- Data may have N/A for some metrics (e.g., PEG/P/FCF use fallbacks; logs warnings).
- Relies on yfinance—occasional gaps or delays; no real-time beyond manual refresh.
- Custom sets accept any valid ticker (regex-validated), but unseeded ones auto-fetch slowly.
- Simple password auth—suitable for personal use; comment out for local.
- Performance: 1500 tickers may lag on low-end hosts; pagination not yet implemented.

## Contributing

Fork the repo and submit pull requests. Report issues on GitHub. Contributions welcome for new metrics, presets, or optimizations.