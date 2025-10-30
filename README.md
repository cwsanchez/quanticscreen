# quanticscreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

quanticscreen is a Streamlit-based stock screening tool using yfinance for data, SQLite for caching metrics (72h expiry), on-the-fly processing with customizable configs stored ephemerally in session state (metrics include/exclude, weight sliders 0-0.3, correlation flags enable/disable with boost sliders +/-10% of default). Features: Seed ~1500 tickers (prioritized large/mid caps from CSV), dataset filters (All/Cap sizes/Value/Growth/Sector/Custom sets), search, flag filters, exclude negatives, top N/show all, ranked table with details (including new MC and P/FCF metrics), CSV export, factor sub-lists (value/momentum/quality/growth), warnings (e.g., high P/E). Password protected via .env for GitHub version. Auto-fetches missing/expired data on launch if >12h since last fetch or after market hours.

## Setup
1. Clone repo: `git clone https://github.com/your-repo/quanticscreen.git`
2. `cd quanticscreen`
3. Create/activate venv: `python -m venv .venv` then `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix).
4. Install deps: `pip install -r requirements.txt`
5. Create .env with `APP_PASSWORD=your_secret`
6. Run: `streamlit run streamlit_app.py`

To remove password (for local instance): Comment out the authentication block in streamlit_app.py (if 'authenticated' not in st.session_state: ... st.stop()).

## Usage
- Sidebar: Select dataset, config, force refresh, top N, show all, exclude negatives.
- Main: Search ticker/company, flag filters, ranked table (sortable), CSV export.
- Pages: Customize (create/edit configs), Explanation (logic details).
- Seed data via button (populates ~1500 tickers).
- Auto-refresh: App fetches missing/expired data in background on launch. Restarting app may require re-seeding if DB reset needed (delete stock_screen.db).

## Limitations
Data may have N/A for some metrics (with fallback handling for P/E). Custom sets fetch unseeded tickers in background.

## Contributing
Fork and PR; report issues on GitHub.

## Screenshots
![Main UI](path/to/main_ui_screenshot.png)
![Customize Page](path/to/customize_screenshot.png)