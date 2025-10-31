# quanticscreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

quanticscreen is a Streamlit-based stock screening tool using yfinance for data, SQLite for caching metrics (72h expiry), on-the-fly processing with customizable configs stored ephemerally in session state (metrics include/exclude, weight sliders 0-0.3, correlation flags enable/disable with boost sliders +/-10% of default). Features: ~1500 tickers (prioritized from ticker.csv via generate_tickers.py), new metrics (Market Cap left of EV, P/FCF right of FCF/EV% with fallbacks/calculations), auto-fetch missing/expired data on app load (every 12h or after market hours via background threading), algorithm presets (Value/original, Growth/high revenue/EPS/PEG, Momentum/price/RSI/volume, Quality/ROE/D/E/margins/dividend/beta—selectable in Customize with read-only protection), custom configs start as NewConfig1 (increment, no overwrite presets), UI bug fixes (rerun on updates), dataset filters (All/Cap sizes/Value/Growth/Sector/Custom sets), search, flag filters, exclude negatives, top N/show all, ranked table with details, CSV export, factor sub-lists (value/momentum/quality/growth), warnings (e.g., high P/E). Simple password protection via APP_PASSWORD in .env.

## Setup
1. Clone repo: `git clone https://github.com/your-repo/quanticscreen.git`
2. `cd quanticscreen`
3. Create/activate venv: `python -m venv .venv` then `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix).
4. Install deps: `pip install -r requirements.txt`
5. Create .env with APP_PASSWORD, e.g.:
   ```
   APP_PASSWORD=your_secret_password
   ```
   Copy from .env.example and set your password.

6. Run: `streamlit run streamlit_app.py`

## Usage
- **Authentication**: Enter the APP_PASSWORD from .env to access the app.
- **Sidebar**: Select dataset (All, Large/Mid/Small Cap, Value, Growth, Sector, Custom sets), config (presets or custom), force refresh, top N stocks, show all, exclude negatives.
- **Main**: Search by ticker/company, filter by flags, view ranked table with metrics (including Market Cap, EV, P/FCF), CSV export.
- **Pages**: Customize (select presets like Value, Growth, Momentum, Quality; create custom configs starting as NewConfig1), Explanation (metrics, correlations, scoring).
- **Seeding**: Use "Seed Initial Data" button to populate ~1500 tickers from prioritized CSV.
- **Auto-fetch**: App automatically fetches missing/expired data in background on load (every 12h or after market hours).
- **Custom Sets**: Create sets of tickers for personalized screening.
- **Factor Sub-lists**: View top 5 stocks per factor (value, momentum, quality, growth).
- **Warnings**: Highlights high P/E stocks and other cautions.
- Restart app or delete stock_screen.db to reset DB if needed.

## Limitations
Data may have N/A for some metrics (with fallback calculations for P/E, P/FCF). Relies on yfinance for data accuracy. No real-time updates beyond refresh. Custom sets fetch unseeded tickers in background.

## Contributing
Fork and PR; report issues on GitHub.

## Screenshots
![Main UI](path/to/main_ui_screenshot.png)
![Customize Page](path/to/customize_screenshot.png)