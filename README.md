# quanticscreen
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

quanticscreen is a modular Python-based stock screening tool that analyzes publicly traded companies using key financial metrics from Yahoo Finance (via yfinance). It scores stocks with a focus on value strategies (low P/E, high ROE), applies correlations for boosts/penalties/flags (e.g., "Undervalued", "Quality Moat"), and generates ranked reports with positives/risks, factor sub-lists (value, momentum, quality, growth), and warnings. Data is cached in a SQLite database for efficiency, with optional seeding of ~700 tickers from major indices. Includes a Streamlit UI for interactive filtering, searching, and exporting.

Originally LLM-driven for data and sentiment, it's now fully code-based for reliable, deterministic results—AI-optional for future extensions like sentiment overlays.

## Project Idea and Goals
Create a factor-investing screener inspired by value tactics, processing metrics like P/E, ROE%, D/E, P/B, PEG, margins, FCF/EBITDA % EV (with $actuals), price (52W range), market cap, EV, cash/debt. Core: Fetch/cache data, score/weight (0-100 base), add flags/boosts, output reports. Extensible for custom datasets, filters (e.g., by cap size, sector), and UI enhancements.

At working prototype stage: Handles seeding, caching (72h freshness), processing, and interactive viewing. Good for personal or small-team use; verify outputs manually.

## Setup
1. Clone the repo and navigate in.
2. Create/activate venv: `python -m venv .venv` then `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Unix).
3. Install deps: `pip install -r requirements.txt` (includes streamlit, pandas, yfinance, sqlalchemy, python-dotenv).
4. (Optional) Set env vars in `.env` (e.g., for passwords).

## Usage
### CLI Mode
Run with presets (UNH, NVO, AAPL, MSFT, GOOGL):
```
python main.py
```
Custom list:
```
python main.py --tickers=TSLA,AMZN,NVDA
```
Outputs markdown report (ranked table, sub-lists, warnings) to console.

### Streamlit UI Mode
Run: `streamlit run streamlit_app.py`
- Sidebar: Select dataset (All, Large/Mid/Small Cap, Value/Growth, Sector), force refresh, top N.
- Features: Seed data button, ticker/company search, flag multiselect filter, interactive table (sortable, scrollable metrics columns), factor expanders, warnings, CSV export.
- Pages: Main screening + Explanation (detailed logic breakdown).

### Seeding Data
Seed ~700 tickers (S&P 500 + partial Russell 2000) via UI button or `python seeder.py`. Uses caching to avoid redundant Yahoo calls.

## Current Stage and Expectations
Functional prototype: Reliable fetching/processing with DB caching, handles N/A, UI for exploration. Limitations: yfinance-dependent (potential outages), some metrics N/A (e.g., PEG), no sentiment yet, filters are in-memory (efficient for current scale). Accurate per source but cross-verify. Not production-ready (add tests, error handling).

## Path Forward
- Reintegrate sentiment (X/web tools for overrides).
- Advanced filters (custom weights/thresholds).
- Charts (e.g., score distributions).
- Deployment enhancements (external DB for persistence).
- Tests and scalability (e.g., larger seeds).

Contributions: Fork/PR welcome.

## License
MIT—free to use/modify. See [LICENSE](LICENSE).