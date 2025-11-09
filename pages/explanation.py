import streamlit as st

st.title("QuanticScreen Explanation")

st.header("App Overview")
st.write("""
QuanticScreen is a web tool for screening and analyzing stocks. It pulls financial data from Yahoo Finance, stores it in a database, and ranks stocks based on customizable scores. Use it to explore presets like Value or Growth, filter by sectors/flags, create custom ticker lists, or dive into individual stock summaries with metrics, graphs, and rankings.

Key pages:
- **Main**: Select dataset/config, apply filters (sectors, flags Any/All, top N, search), view ranked table, export CSV.
- **Stock Summary**: Search dropdown (type to filter existing tickers), auto-loads details: all metrics (formatted/rounded), flags, bullet positives, 52W bar, 1Y graph, analyst sentiment, 4x3 rankings (by preset vs. All/Category/Sector).
- **Customize**: Edit weights (0-0.3), metrics, flag enables/boosts; save new configs (presets read-only).
- **Manage (Admin)**: Password-protected; refresh stale, add/refresh/delete tickers (rate-limited), prune old data.
- **Explanation**: This page!

Data refreshes in background for stale metrics (>12h or pre-last market close), even weekends if needed. Custom sets auto-fetch missing metrics for existing stocks.
""")

st.header("Metrics Explained")
st.write("""
Metrics are fetched from Yahoo Finance (yfinance) and used for scoring/rankings. 'N/A' if missing (logged; fallbacks for some like PEG = P/E / growth).

- **P/E (Price/Earnings)**: Stock price vs. earnings—lower (<15) often undervalued.
- **ROE (Return on Equity %)**: Profit from equity—high (>15%) shows efficiency.
- **P/B (Price/Book)**: Market vs. book value—low (<1.5) undervalued.
- **PEG (Price/Earnings to Growth)**: P/E adjusted for growth—low (<1.5) good value-growth.
- **Gross Margin %**: Revenue after costs—high (>40%) strong.
- **Net Profit Margin %**: Net income %—high (>15%) profitable.
- **FCF % EV TTM (Free Cash Flow % Enterprise Value)**: Cash gen vs. value—high (>5%) positive.
- **EBITDA % EV TTM**: Ops cash vs. value—high (>5%) efficient.
- **P/FCF**: Price vs. free cash—low (<20) undervalued.
- **D/E (Debt/Equity)**: Leverage—low (<1) healthy.
- **Beta**: Volatility vs. market—<1 less volatile.
- **Dividend Yield %**: Annual dividend/price—high attractive for income.
- **Average Volume**: Trading liquidity—high better.
- **RSI (Relative Strength Index)**: Momentum (0-100)—<30 oversold, >70 overbought.
- **Revenue/Earnings Growth %**: Recent quarterly—high (>10%) growth.
- **Forward PE**: Future P/E—low suggests undervalued.
- **Analyst Rating/Mean/Target Price/Sentiment**: Aggregated opinions (Bullish/Neutral/Bearish based on mean 1-5).
- **Current Price/52W High/Low/Market Cap/EV/Total Cash/Debt/FCF/EBITDA Actual**: Raw values for context.

Large numbers (e.g., Market Cap) formatted as '2.5B'. All rounded to 2 decimals in summaries.
""")

st.header("Flags & Positives Explained")
st.write("""
Flags trigger based on conditions, adding boosts/penalties to scores. Positives are descriptive (e.g., "Undervalued with P/E 12.3 and ROE 20%") shown as bullets in summaries/table.

- **Undervalued (+15%)**: P/E <15, ROE >15.
- **Strong Balance Sheet (+10%)**: D/E <1, Cash > Debt.
- **Quality Moat (+20%)**: Gross >40%, Net >15%, FCF/EV >5%.
- **GARP (+10%)**: PEG <1.5, P/E <20.
- **High Growth (+15%)**: Revenue/Earnings Growth >15%, PEG <1.
- **Value Trap (-10%)**: P/B <1.5, ROE <5.
- **Momentum Building (+5%)**: Price >90% 52W High, EBITDA/EV >5%.
- **Debt Burden (-15%)**: D/E >2, FCF/EV <1.

Customize in Customize page—enable/disable, adjust boosts. Rankings grid shows position by preset (Value/Growth/etc.) vs. All/Category/Sector.
""")

st.header("Usage Tips")
st.write("""
- **Getting Started**: If table empty, use Manage (admin password) to add tickers (e.g., from defaults like AAPL, MSFT) or refresh. Custom sets: Enter name/tickers—auto-fetches missing metrics for existing stocks, warns/skips new (add via Manage).
- **Datasets**: 'All' for full DB; cap categories (Mega/Large/etc.); sectors; presets filter by scores; custom browser-saved.
- **Configs**: Presets balanced (Overall) or focused (e.g., Growth emphasizes PEG/growth). Save edits as new.
- **Filters**: Require flags (Any/All for combos), search partial ticker/company, top N (slider), exclude negatives.
- **Summary**: Dropdown filters as you type (client-side, no refresh); auto-loads on select. Graph/bar refresh if >24h stale.
- **Admin**: Cooldowns prevent abuse (e.g., 1h add/refresh). Prune olds to save space.
- **Background Refresh**: Runs in session; checks close-date (fetches if pre-last close, even weekends). Logs in console.
- **Tips**: For large DB, filter for speed. Export CSV for offline. If errors, check logs (e.g., yfinance misses).
""")

st.header("Limitations & Notes")
st.write("""
- **Data**: Yahoo gaps/misses (e.g., PEG calculated fallback). Not real-time—refreshes background/manual.
- **Custom Sets**: Browser-only (resets on clear/close); no auto-add new tickers.
- **Performance**: ~1700 tickers fine; larger lags (batched queries help). Free Neon/Streamlit limits storage/traffic.
- **Security**: Basic password—no full auth. Deploy privately.
- **Prototype**: No advanced tests/ML/backtesting yet. Expand tickers via tickers.csv/generate_tickers.py.
""")