# pages/explanation.py (Streamlit page for logic breakdown)
import streamlit as st

st.title("Screening Logic Explanation")

st.markdown("""
This page explains the metrics, scoring, correlations, and factor lenses used in the stock screening process. The goal is to prioritize value strategies while incorporating quality, growth, and momentum elements.

### Individual Metrics and Scoring
Each metric is scored on a 0-10 scale based on thresholds:
- P/E (Trailing): 10 if <15, 7 if <20, 5 if <30, 2 if <40, else 0.
- ROE%: 10 if >15, 7 if >=10, 5 if >=5, else 0.
- D/E: 10 if <1, 7 if <1.5, 5 if <2, else 0.
- P/B: 10 if <1.5, 7 if <2.5, 5 if <4, else 0.
- PEG: 10 if <1, 7 if <1.5, 5 if <2, else 0.
- Gross Margin%: 10 if >40, 7 if >=30, 5 if >=20, else 0.
- Net Profit Margin%: 10 if >15, 7 if >=10, 5 if >=5, else 0.
- FCF % EV TTM: 10 if >5, 7 if >=3, 5 if >=1, else 0.
- EBITDA % EV TTM: 10 if >10, 7 if >=5, 5 if >=2, else 0.
- Balance (Cash/MCap and Price/52W): 10 if strong cash or near high, 0 if high debt or near low, else 5.

### Weighting for Base Score
Scores are weighted and scaled to 0-100:
- P/E: 20%
- ROE: 15%
- D/E: 10%
- P/B: 10%
- PEG: 10%
- Gross Margin: 10%
- Net Profit Margin: 10%
- FCF % EV: 7.5%
- EBITDA % EV: 7.5%
- Balance: 5%

### Correlations and Flags (Boosts/Penalties)
Multi-metric checks adjust the score and add flags:
- Undervalued: +15%
- Strong Balance Sheet: +10%
- Quality Moat: +15%
- GARP: +10%
- High-Risk Growth: -10%
- Value Trap: -10%
- Momentum Building: +5%
- Debt Burden: -15%

### Factor Lenses (Additional Boosts)
Extra points for factor alignment:
- Value: +10
- Momentum: +5
- Quality: +10
- Growth: +5

Final score = Base * (1 + Boost%) + Factor Total.
""")