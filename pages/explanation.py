# pages/explanation.py
import streamlit as st

st.title("QuantiScreen Explanation")

st.markdown("""
## App Overview
QuantiScreen is a Streamlit-based stock screening tool that helps investors identify promising stocks using quantitative metrics and customizable algorithms. It fetches data from yfinance, caches it in a local SQLite database (expiring after 72 hours), and processes stocks on-the-fly.

### How to Use
- **Datasets**: Filter stocks by All, Large/Mid/Small Cap (based on Market Cap >$10B, $2-10B, <$2B), Value (low P/B or Undervalued flags), Growth (low PEG or GARP flags), Sector, or Custom sets (user-created ticker lists).
- **Filters**: Search by ticker/company name, select flags (e.g., Undervalued, Quality Moat), exclude negative flags (Value Trap, Debt Burden), set top N results or show all.
- **Table**: View ranked stocks with metrics like Score, Price, 52W High/Low, Market Cap (MC), EV, Total Cash/Debt, P/E, ROE%, P/B, PEG, Gross Margin%, FCF/EV%, P/FCF, D/E, Flags, Positives. Export to CSV.
- **Customize**: Select presets (Value: low P/E/P/B/high ROE; Growth: high revenue/EPS/PEG; Momentum: price/RSI/volume; Quality: ROE/D/E/margins/dividend/beta) or create custom configs (NewConfig1, incrementing). Adjust weights, enable/disable flags with boost sliders.
- **Auto-Seed/Fetch**: App seeds ~1500 prioritized tickers from ticker.csv via generate_tickers.py on button press. Auto-fetches missing/expired data in background on load (every 12h or after market hours).
- **Custom Sets**: Create sets from comma-separated tickers; validates and fetches unseeded ones in background.
- **Factor Sub-Lists**: Top 5 per factor (Value, Momentum, Quality, Growth) based on boosts.

## Metrics Explanation
Each metric is scored 0-10 based on thresholds, weighted for base score. Lower scores for valuations (P/E, P/B) indicate undervaluation; higher for fundamentals (ROE, margins) indicate strength. N/A treated as 0.

- **P/E (Price/Earnings)**: Price per earnings share. Lower (<15) indicates undervalued.
- **ROE% (Return on Equity)**: Profit efficiency using equity. Higher (>15%) better.
- **D/E (Debt-to-Equity)**: Leverage ratio. Lower (<1) indicates strong balance.
- **P/B (Price-to-Book)**: Price per book value. Lower (<1.5) suggests undervaluation.
- **PEG (Price/Earnings to Growth)**: P/E adjusted for growth. Lower (<1) indicates growth at fair price.
- **Gross Margin%**: Revenue after COGS. Higher (>40%) shows pricing power.
- **Net Profit Margin%**: Revenue after expenses. Higher (>15%) indicates profitability.
- **FCF % EV TTM (Free Cash Flow to Enterprise Value)**: Cash flow relative to value. Higher (>5%) shows cash generation.
- **EBITDA % EV TTM**: Operating earnings to value. Higher (>10%) indicates operational strength.
- **Balance Score**: Liquidity/momentum (cash >20% MC or price >80% 52W high =10; debt >MC or price <110% low =0; else 5).
- **P/FCF (Price/Free Cash Flow)**: Price per free cash flow. Lower (<15) indicates undervaluation relative to cash.
- **Market Cap**: Company size. Used for cap filters.
- **EV (Enterprise Value)**: Market Cap + Debt - Cash. Used in FCF/EV.
- **Total Cash/Debt**: Liquidity/leverage. Used in Balance and flags.
- **52W High/Low**: Price range. Used in momentum.
- **Forward P/E**: Future P/E estimate. Similar scoring to P/E.
- **Revenue/Earnings Growth**: Annual growth rates. Higher (>10%) indicates growth potential.
- **RSI (Relative Strength Index)**: Momentum indicator (50-70 optimal).
- **Beta**: Volatility vs. market. Lower (<1) indicates stability.
- **Dividend Yield**: Annual dividend %. Higher (>2%) indicates income.
- **Average Volume**: Trading liquidity. Higher (>1M) indicates ease of trading.

## Correlations and Flags
Flags combine metrics to detect patterns, applying boosts/penalties to score and adding labels. Enabled by default with adjustable boosts.

- **Undervalued (+15%)**: P/E <15 and ROE >15 – Mispriced efficient firms.
- **Strong Balance Sheet (+10%)**: D/E <1 and Total Cash > Total Debt – Resilient to shocks.
- **Quality Moat (+15%)**: Gross Margin >40%, Net Profit Margin >15%, FCF % EV >5 – Competitive advantages.
- **GARP (+10%)**: PEG <1.5 and P/E <20 – Growth at reasonable price.
- **High-Risk Growth (-10%)**: P/E >30 and PEG <1 – Volatile growth bets.
- **Value Trap (-10%)**: P/B <1.5 and ROE <5 – Cheap but declining businesses.
- **Momentum Building (+5%)**: Current Price >90% 52W High and EBITDA % EV >5 – Upward trends.
- **Debt Burden (-15%)**: D/E >2 and FCF % EV <1 – Leverage straining cash flow.

## Scoring Formula
Final Score = Base Score + (Base Score * Boosts/100) + Factor Boosts

- **Base Score (0-100)**: Weighted average of metric scores (0-10) scaled up, e.g., P/E 20%, ROE 15%.
- **Boosts**: Percentage adjustments from enabled flags (e.g., +15% for Undervalued).
- **Factor Boosts**: Fixed points for alignment (Value: 20 if P/FCF<15 or P/B<1.5+ROE>15; Momentum: 20 if price>90% high + RSI 50-70 + volume>1M + ROE>15; Quality: 20 if ROE>20 + D/E<1 + margins>40 + dividend>2% + beta<1; Growth: 20 if PEG<1.5 + growths>10 + forward P/E<25 + D/E<1).

## Customization
Create configs on Customize page: Name (NewConfig1+), select metrics, adjust weights (0-0.3, sum~1), toggle flags with boost sliders (+/-10% of default). Presets read-only. Saves to session; export/import JSON.

## Limitations
- N/A data handled as 0, may skew scores; fallbacks for calculations.
- Relies on yfinance accuracy; no real-time beyond refresh.
- Caching expires 72h; auto-fetch may lag.
- No advanced analytics (e.g., Monte Carlo); basic screening only.

## Tips
- Restart app to reset DB (delete stock_screen.db) if seeding issues.
- Expand tickers: Edit ticker.csv or generate_tickers.py for more coverage.
- Monitor warnings: High P/E stocks need review; debt burdens in rising rates.
- Use factor sub-lists for style-specific insights.
""")
