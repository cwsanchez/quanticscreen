# pages/explanation.py (updated with more descriptive explanations)
import streamlit as st

st.title("Screening Logic Explanation")

st.markdown("""
This page provides a detailed breakdown of the stock screening logic, including individual metrics, their scoring rationale, correlations (flags and boosts/penalties), and factor lenses. The system prioritizes value investing (e.g., low valuations with strong fundamentals) while incorporating elements of quality, growth, and momentum. Explanations focus on what each component measures, why it's useful, and how it contributes to the overall score.

### 1. Individual Metrics and Scoring
Each metric is evaluated on a 0-10 scale based on predefined thresholds that reflect common investment benchmarks. Higher scores indicate better performance relative to peers or historical norms. These scores are then weighted to form the base score (0-100).

- **P/E (Trailing Price/Earnings)**: Measures stock price relative to earnings per share. Low P/E suggests undervaluation; high may indicate overvaluation or growth expectations. Scoring: 10 (<15: cheap), 7 (<20), 5 (<30), 2 (<40), 0 (otherwise). Useful for identifying bargains but must be contextualized with growth.
- **ROE% (Return on Equity)**: Shows how efficiently a company uses shareholders' equity to generate profits. High ROE indicates strong management and profitability. Scoring: 10 (>15%: excellent), 7 (>=10%), 5 (>=5%), 0 (otherwise). Key for assessing long-term value creation.
- **D/E (Debt-to-Equity)**: Gauges financial leverage; low ratios mean less debt risk. Scoring: 10 (<1: conservative), 7 (<1.5), 5 (<2), 0 (otherwise). Helps flag balance sheet strength and vulnerability to interest rate changes.
- **P/B (Price-to-Book)**: Compares market price to book value; low P/B may signal undervaluation. Scoring: 10 (<1.5: deep value), 7 (<2.5), 5 (<4), 0 (otherwise). Particularly useful for asset-heavy industries like banking.
- **PEG (Price/Earnings to Growth)**: Adjusts P/E for growth rate; low PEG highlights growth at a fair price. Scoring: 10 (<1: attractive), 7 (<1.5), 5 (<2), 0 (otherwise). Balances value and growth perspectives.
- **Gross Margin%**: Percentage of revenue left after cost of goods; high margins indicate pricing power. Scoring: 10 (>40%: strong), 7 (>=30%), 5 (>=20%), 0 (otherwise). Signals competitive moats in industries like software.
- **Net Profit Margin%**: Revenue after all expenses; high values show operational efficiency. Scoring: 10 (>15%: robust), 7 (>=10%), 5 (>=5%), 0 (otherwise). Reflects overall profitability health.
- **FCF % EV TTM (Free Cash Flow to Enterprise Value, Trailing 12 Months)**: FCF relative to total company value; high % means strong cash generation. Scoring: 10 (>5%: excellent yield), 7 (>=3%), 5 (>=1%), 0 (otherwise). Critical for valuing cash flows over earnings.
- **EBITDA % EV TTM**: Operating earnings to enterprise value; high % suggests undervaluation. Scoring: 10 (>10%: high yield), 7 (>=5%), 5 (>=2%), 0 (otherwise). Useful for comparing firms with different capital structures.
- **Balance Score (Total Cash, Total Debt, Price vs. 52W High/Low)**: Assesses liquidity and price momentum. Scoring: 10 (high cash >20% mcap or price >80% high: resilient), 0 (high debt > mcap or price <110% low: risky), 5 (neutral). Indicates financial stability and market sentiment.

### 2. Weighting for Base Score
Individual scores are multiplied by weights (totaling 100%) and scaled to 0-100, emphasizing value metrics:
- P/E (20%): High weight due to core value focus.
- ROE (15%): Rewards efficiency.
- Others as per code (e.g., margins 10% each for profitability balance).
This creates a foundational quantitative score before adjustments.

### 3. Correlations and Flags (Boosts/Penalties)
These check combinations of metrics to identify patterns, applying percentage boosts/penalties to the base score and adding descriptive flags. They capture synergies or risks not visible in isolated metrics.

- **Undervalued (+15%)**: Low P/E with high ROE. Indicates cheap stocks with strong profitability—useful for spotting mispriced efficient companies.
- **Strong Balance Sheet (+10%)**: Low D/E with ample cash. Signals low-risk firms resilient to downturns—key for conservative investors.
- **Quality Moat (+15%)**: High gross/net margins with strong FCF/EV. Points to sustainable competitive advantages—helps identify durable businesses.
- **GARP (+10%)**: Low PEG with moderate P/E. Highlights growth at reasonable valuations—balances value and expansion potential.
- **High-Risk Growth (-10%)**: High P/E but low PEG. Warns of speculative bets on future growth—useful to flag overhyping.
- **Value Trap (-10%)**: Low P/B but low ROE. Suggests cheap stocks that are cheap for a reason (poor performance)—avoids false bargains.
- **Momentum Building (+5%)**: Price near 52W high with strong EBITDA/EV. Indicates positive trends backed by operations—adds short-term signal.
- **Debt Burden (-15%)**: High D/E with low FCF/EV. Flags cash flow strains from leverage—critical for risk management.

Boosts reward positive synergies; penalties penalize risks, refining the score beyond basics.

### 4. Factor Lenses (Additional Boosts)
These add fixed points for alignment with investing styles, enabling sub-rankings:
- **Value (+10)**: Low P/B with high ROE. Identifies undervalued assets with returns—core to value strategies like Buffett's.
- **Momentum (+5)**: Price near high with positive FCF. Captures upward trends with cash backing—useful for timing entries.
- **Quality (+10)**: High margins with low D/E. Spotlights high-quality, low-risk firms—focuses on long-term stability.
- **Growth (+5)**: Low PEG in mid-cap range. Targets scalable growth opportunities—balances potential with feasibility.

Final score incorporates all for a holistic view, with sub-lists highlighting top per factor.
""")