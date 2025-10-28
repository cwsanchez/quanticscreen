# streamlit_app.py (main Streamlit app for screening)
import streamlit as st
from db import init_db, get_all_tickers, get_unique_sectors, get_latest_processed
from processor import get_float
import pandas as pd
from seeder import seed

init_db()

st.title("Stock Screening Tool")

with st.sidebar:
    dataset = st.selectbox("Select Dataset", ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"])
    if dataset == "Sector":
        sectors = get_unique_sectors()
        selected_sector = st.selectbox("Select Sector", sectors)
    force_refresh = st.checkbox("Force Refresh (Re-fetch All)")
    num_top = st.slider("Top N Stocks", 1, 50, 20)
    if st.button("Seed Initial Data"):
        with st.spinner("Seeding data (this may take a while)..."):
            seed()
        st.success("Data seeded!")

# Get all tickers and load latest processed
tickers = get_all_tickers()
results = []
for ticker in tickers:
    processed = get_latest_processed(ticker)
    if processed:
        results.append(processed)

# Apply filters based on dataset
if dataset == "Large Cap":
    results = [r for r in results if get_float(r['metrics'], "Market Cap") > 10e9]
elif dataset == "Mid Cap":
    results = [r for r in results if 2e9 <= get_float(r['metrics'], "Market Cap") <= 10e9]
elif dataset == "Small Cap":
    results = [r for r in results if get_float(r['metrics'], "Market Cap") < 2e9]
elif dataset == "Value":
    results = [r for r in results if "Undervalued" in r['flags'] or get_float(r['metrics'], "P/B") < 2]
elif dataset == "Growth":
    results = [r for r in results if "GARP" in r['flags'] or get_float(r['metrics'], "PEG") < 1]
elif dataset == "Sector":
    results = [r for r in results if r['metrics'].get("Sector", "N/A") == selected_sector]

if force_refresh:
    st.warning("Force refresh not implemented for all; re-seed or re-run for selected tickers.")

# Rank by final_score desc
results.sort(key=lambda x: x['final_score'], reverse=True)
top_results = results[:num_top]

# Display ranked table using pandas for better view (sortable, searchable)
if top_results:
    df_data = []
    for i, res in enumerate(top_results, 1):
        m = res['metrics']
        details = (
            f"P/E: {m['P/E']}\nROE: {m['ROE']}%\nP/B: {m['P/B']}\nPEG: {m['PEG']}\n"
            f"Gross: {m['Gross Margin']}%\nFCF/EV: {m['FCF % EV TTM']}%\nD/E: {m['D/E']}"
        )
        df_data.append({
            "#": i,
            "Company (Ticker)": f"{m['Company Name']} ({m['Ticker']})",
            "Score": round(res['final_score'], 2),
            "Quantitative Details": details,
            "Flags": ", ".join(res['flags']),
            "Positives": res['positives'],
            "Risks": res['risks']
        })
    df = pd.DataFrame(df_data)
    st.subheader("Ranked Top Stocks")
    st.dataframe(df, use_container_width=True, height=400)  # Interactive table

    # Factor Sub-Lists
    factors = ['value', 'momentum', 'quality', 'growth']
    st.subheader("Factor Sub-Lists (Top 5 per Factor)")
    for factor in factors:
        with st.expander(f"{factor.capitalize()}"):
            sorted_by_factor = sorted(results, key=lambda x: x['factor_boosts'].get(factor, 0), reverse=True)
            top_factor = sorted_by_factor[:5]
            for res in top_factor:
                if res['factor_boosts'][factor] > 0:
                    m = res['metrics']
                    reason = f"High score due to relevant metrics (e.g., ROE: {m['ROE']}%, Flags: {', '.join(res['flags'])})."
                    st.markdown(f"- {m['Company Name']} ({m['Ticker']}): {reason}")

    # Warnings
    st.subheader("Warnings")
    high_pe = [r['metrics']['Ticker'] for r in results if get_float(r['metrics'], 'P/E') > 30]
    st.markdown(f"- High P/E stocks needing review: {', '.join(high_pe) if high_pe else 'None'}.")
    st.markdown("- Monitor debt burdens and market volatility.")
else:
    st.info("No stocks match the selected dataset. Try seeding data or changing filters.")