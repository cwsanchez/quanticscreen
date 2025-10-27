# quanticscreen

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

quanticscreen is a modular Python-based stock screening tool that analyzes publicly traded companies using key financial metrics from Yahoo Finance. It scores stocks with a focus on value strategies (low P/E, high ROE), applies correlations for boosts/penalties, and generates ranked reports with flags, positives/risks, and factor sub-lists. Originally LLM-driven for data and sentiment, it's now AI-optional for reliable, deterministic results via yfinance.

## Project Idea and Goals
Build a simple factor-investing screener inspired by value tactics (e.g., flagging "undervalued efficient" stocks). Processes metrics like P/E, ROE%, D/E, P/B, PEG, margins, FCF/EBITDA % EV (with $actuals), price (52W range), market cap, EV, cash/debt. Core: Fetch data, score/weight (0-100 base), add flags/boosts, output markdown reports. Extensible for sentiment or seeding.

At prototype stage: Works for small lists; expect tweaks for accuracy/scaling.

## Usage
Run with preset tickers (UNH, NVO, AAPL, MSFT, GOOGL):
```
python main.py
```

Custom list:
```
python main.py --tickers=TSLA,AMZN,NVDA
```

Outputs markdown report (ranked table, sub-lists, warnings).

## Current Stage and Expectations
Early prototype: Reliable fetching/scoring/output; handles N/A. Limitations: yfinance-dependent (caching/outages), PEG often N/A, no sentiment/export. Accurate per source but verify manually. Good for personal screens; not production (no tests/UI).

## Path Forward
- Add seeding (e.g., S&P 500 lists).
- Reintegrate sentiment (X/web tools).
- Export to CSV/JSON.
- Multi-source averaging (Finviz).
- CLI options (e.g., --num_top).
- Tests and Streamlit UI.

Contributions: Fork/PR welcome.

## License
MIT—free to use/modify. See [LICENSE](LICENSE).