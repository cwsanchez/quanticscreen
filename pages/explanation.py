# pages/explanation.py (trimmed individual metrics, expanded correlations/factors)
import streamlit as st

st.title("Screening Logic Explanation")

st.markdown("""
This page provides a detailed breakdown of the stock screening logic, including individual metrics, their scoring rationale, correlations (flags and boosts/penalties), and factor lenses. The system prioritizes value investing (e.g., low valuations with strong fundamentals) while incorporating elements of quality, growth, and momentum. Explanations focus on what each component measures and why it's useful, with emphasis on correlations and factors for deeper insights.

### 1. Individual Metrics and Scoring
Each metric is evaluated on a 0-10 scale based on predefined thresholds that reflect common investment benchmarks. Higher scores indicate better performance.

- **P/E (Trailing Price/Earnings)**: Measures stock price relative to earnings. Scoring: 10 (<15), 7 (<20), 5 (<30), 2 (<40), 0 (otherwise).
- **ROE% (Return on Equity)**: Shows efficiency in using equity for profits. Scoring: 10 (>15%), 7 (>=10%), 5 (>=5%), 0 (otherwise).
- **D/E (Debt-to-Equity)**: Gauges financial leverage. Scoring: 10 (<1), 7 (<1.5), 5 (<2), 0 (otherwise).
- **P/B (Price-to-Book)**: Compares price to book value. Scoring: 10 (<1.5), 7 (<2.5), 5 (<4), 0 (otherwise).
- **PEG (Price/Earnings to Growth)**: Adjusts P/E for growth. Scoring: 10 (<1), 7 (<1.5), 5 (<2), 0 (otherwise).
- **Gross Margin%**: Revenue after cost of goods. Scoring: 10 (>40%), 7 (>=30%), 5 (>=20%), 0 (otherwise).
- **Net Profit Margin%**: Revenue after all expenses. Scoring: 10 (>15%), 7 (>=10%), 5 (>=5%), 0 (otherwise).
- **FCF % EV TTM (Free Cash Flow to Enterprise Value)**: Cash flow relative to company value. Scoring: 10 (>5%), 7 (>=3%), 5 (>=1%), 0 (otherwise).
- **EBITDA % EV TTM**: Operating earnings to enterprise value. Scoring: 10 (>10%), 7 (>=5%), 5 (>=2%), 0 (otherwise).
- **Balance Score (Cash, Debt, Price vs. 52W)**: Assesses liquidity and momentum. Scoring: 10 (strong), 0 (risky), 5 (neutral).

### 2. Weighting for Base Score
Scores are weighted (e.g., P/E 20%, ROE 15%) and scaled to 0-100, emphasizing value and profitability.

### 3. Correlations and Flags (Boosts/Penalties)
These combine metrics to detect patterns, adjusting scores and adding flags. They reveal synergies/risks: e.g., isolated low P/E might miss efficiency, but paired with high ROE signals true value.

- **Undervalued (+15%)**: Low P/E with high ROE—indicates mispriced efficient firms; useful for spotting high-potential bargains in value screens.
- **Strong Balance Sheet (+10%)**: Low D/E with high cash—signals resilience to economic shocks; key for risk-averse strategies, reducing bankruptcy odds.
- **Quality Moat (+15%)**: High margins with strong FCF/EV—points to competitive advantages like brand strength; helps predict long-term outperformance.
- **GARP (+10%)**: Low PEG with moderate P/E—balances growth/value; ideal for avoiding overpaying for expansion, per Peter Lynch's style.
- **High-Risk Growth (-10%)**: High P/E but low PEG—warns of volatility in growth bets; flags hype vs. fundamentals, aiding caution in bull markets.
- **Value Trap (-10%)**: Low P/B but low ROE—highlights cheap but declining businesses; prevents investing in "falling knives" like turnaround failures.
- **Momentum Building (+5%)**: Price near high with strong EBITDA/EV—captures positive trends with backing; useful for timing entries in trending sectors.
- **Debt Burden (-15%)**: High D/E with low FCF/EV—indicates cash strains from leverage; critical for avoiding defaults in rising rate environments.

### 4. Factor Lenses (Additional Boosts)
Fixed points for style alignment, enabling targeted sub-lists. Factors allow customization: e.g., value for deep discounts, quality for stability.

- **Value (+10)**: Low P/B with high ROE—identifies undervalued with returns; core for strategies seeking margin of safety, like Graham/Buffett.
- **Momentum (+5)**: Price near high with positive FCF—spots upward trends with cash; helps ride winners, per quantitative trend-following.
- **Quality (+10)**: High margins with low D/E—highlights durable businesses; focuses on compounders with low volatility, ideal for long holds.
- **Growth (+5)**: Low PEG in mid-caps—targets scalable opportunities; balances potential with feasibility, avoiding overhyped small/large caps.
""")