# quanticscreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

quanticscreen is a Streamlit-based stock screening tool using yfinance for data, SQLite for caching metrics (72h expiry), on-the-fly processing with customizable configs stored ephemerally in session state (metrics include/exclude, weight sliders 0-0.3, correlation flags enable/disable with boost sliders +/-10% of default). Features: Seed ~700 tickers (large/mid/small cap from lists), dataset filters (All/Cap sizes/Value/Growth/Sector/Custom sets), search, flag filters, exclude negatives, top N/show all, ranked table with details, CSV export, factor sub-lists (value/momentum/quality/growth), warnings (e.g., high P/E). Password protected via .env for GitHub version.

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
- Seed data via button (populates ~700 tickers).

## Limitations
Tickers limited to ~700 hardcoded in tickers.py (expand for more); custom sets validate against this list—stocks not in list won't be added/seeded/shown. Data may have N/A for some metrics. No real-time updates beyond seeding.

For custom stock filtering: Currently limited to hardcoded DEFAULT_TICKERS; if input ticker not in list, error. To relax: In streamlit_app.py create set button, remove 'valid_tickers = [t for t in input_tickers if t in DEFAULT_TICKERS]', use input_tickers directly; add st.warning if not all seeded ('Unseeded tickers won't show until fetched—run seed or add fetch button'). But don't add fetch yet; note in README as limitation/future.

## Contributing
Fork and PR; report issues on GitHub.

## Screenshots
![Main UI](path/to/main_ui_screenshot.png)
![Customize Page](path/to/customize_screenshot.png)