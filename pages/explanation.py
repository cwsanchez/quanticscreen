import streamlit as st

st.title("QuanticScreen Explanation")

st.header("App Overview")
st.write("""
QuanticScreen is a Streamlit-based tool for screening and analyzing publicly traded stocks using fundamental metrics from Yahoo Finance (via yfinance). It allows you to filter datasets, customize scoring logic, view ranked results with details, export to CSV, and explore factor sub-lists. The app auto-fetches data for ~700 prioritized tickers on launch if missing/expired, respecting yfinance limits with rate-limited background threading. Use the sidebar to navigate pages, select datasets/configs, and apply filters. Main features include searchable rankings, column exclusion, and warnings for risks like high P/E.
""")

st.header("Metrics Explained")
st.write("""
The app uses these key metrics (fetched or calculated):
- **P/E (Price/Earnings)**: Trailing P/E ratio—lower suggests undervalued (fallback: marketCap / trailingEps if missing).
- **ROE (Return on Equity)**: Profitability relative to equity—higher is better (e.g., >15% positive).
- **P/B (Price/Book)**: Market vs. book value—low (<1.5) indicates undervalued.
- **PEG (Price/Earnings to Growth)**: P/E adjusted for growth—low (<1.5) for growth at reasonable price (fallback: P/E / (earningsGrowth * 100) if missing).
- **Gross Margin**: Revenue after COGS as %—high (>40%) shows efficiency.
- **Net Profit Margin**: Net income as % of revenue—high (>15%) indicates strong profitability.
- **FCF % EV TTM (Free Cash Flow % Enterprise Value Trailing 12 Months)**: FCF relative to EV—high (>5%) positive for cash generation.
- **EBITDA % EV TTM**: EBITDA relative to EV—high (>5%) for operational efficiency.
- **Current Price**: Latest stock price.
- **52W High/Low**: 52-week range for momentum context.
- **Market Cap (MC)**: Total market value (left of EV in table).
- **EV (Enterprise Value)**: Market cap + debt - cash.
- **Total Cash/Debt**: Balance sheet liquidity/debt levels.
- **FCF Actual/EBITDA Actual**: Raw $ values for FCF/EBITDA.
- **P/FCF (Price to Free Cash Flow)**: Market cap / FCF—low indicates value (fallback: calculated if missing, right of FCF % EV).
- **Beta**: Volatility vs. market—low (<1) for stability.
- **Dividend Yield**: Annual dividend %—high (>2%) for income focus.
- **Average Volume**: Trading liquidity.
- **RSI (Relative Strength Index)**: Momentum oscillator (30-70 normal; calculated from history if needed).
N/A values are logged and handled gracefully in scoring (treated as 0 or skipped).
""")

st.header("Scoring Logic")
st.write("""
Stocks are processed on-the-fly:
- **Base Score**: Weighted average of included metrics (e.g., lower P/E = higher score; customizable weights 0-0.3).
- **Boosts**: From enabled flags/correlations (e.g., +15% for 'Undervalued' if P/E <15 and ROE >15; sliders for ±10%).
- **Factor Boosts**: Additional points per factor (value: low P/E/P/B/high ROE; momentum: near 52W high/high EBITDA % EV; quality: high ROE/low D/E/high margins/dividend/low beta; growth: low PEG/high growth/low D/E).
- **Final Score**: Base + (base * boost %) + factor points. Excludes negatives if selected. Ranked descending.
Factor sub-lists show top 5 per factor for focused views.
""")

st.header("Flags and Correlations")
st.write("""
Flags are conditional tags boosting scores if enabled:
- **Undervalued**: P/E <15 and ROE >15 (+15%).
- **Strong Balance Sheet**: D/E <1 and cash > debt (+10%).
- **Quality Moat**: Gross >40%, net profit >15%, FCF % EV >5% (+15%).
- **GARP (Growth at Reasonable Price)**: PEG <1.5 and P/E <20 (+10%).
- **High-Risk Growth**: P/E >30 and PEG <1 (+5%).
- **Value Trap**: P/B <1.5 and ROE <5 (-10%).
- **Momentum Building**: Price >90% of 52W high and EBITDA % EV >5% (+10%).
- **Debt Burden**: D/E >2 and FCF % EV <1 (-15%).
Customize in the Customize page—enable/disable, adjust boosts.
""")

st.header("Usage Tips")
st.write("""
- **Datasets**: 'All' for full ~700; cap sizes based on market cap; value/growth presets filter by scores; sectors from DB; custom adds any ticker (validated ^[A-Z0-9.-]{1,5}$), auto-fetches unseeded.
- **Configs/Presets**: Load Overall (balanced default with broad boosts across value/quality/growth/momentum, penalizing risks), Value (focus on undervalued), Growth (high revenue/EPS/PEG), Momentum (price/RSI/volume), Quality (ROE/D/E/margins/dividend/beta). New configs as NewConfig1 (increment); presets read-only—save as new.
- **Filters/Search**: Flag multi-select, search ticker/company, top N/show all, exclude negatives.
- **Table**: Sort columns, exclude via multiselect, export CSV.
- **Auto-Fetch**: Background on load if >12h or after market (US/Eastern, weekdays 4PM-9:30AM); respects limits with 1s sleep.
- **Reset**: Delete stock_screen.db to re-seed; restart app for changes.
- **Analysis Pages**: Stock Analysis for individual charts/metrics/ML; Portfolio/Backtesting for simulations (if implemented).
""")

st.header("Limitations")
st.write("""
- yfinance reliance: Gaps/delays possible; fallbacks for PEG/P/FCF/P/E.
- No real-time: Refresh for updates; auto-fetch not cron-scheduled.
- Performance: Large datasets may lag; no pagination yet.
- N/A Handling: Skipped in scoring; warnings logged.
- Expandability: Add tickers to CSV and run generate_tickers.py for more.
""")
