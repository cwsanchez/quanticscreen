import streamlit as st
from db import init_db, get_all_tickers, get_unique_sectors, get_latest_processed
from processor import get_float
import pandas as pd
import numpy as np  # For np.nan
from seeder import seed
import io  # For CSV export
import os
from dotenv import load_dotenv

load_dotenv()
st.set_page_config(layout="wide")  # Wider page

# Password protection from env
PASSWORD = os.getenv("APP_PASSWORD")  # Env var name; set to your secret value
entered_password = st.text_input("Enter password to access the app", type="password")
if entered_password != PASSWORD:
    st.error("Incorrect password. Please try again.")
    st.stop()

init_db()

st.title("Stock Screening Tool")

with st.sidebar:
    dataset = st.selectbox("Select Dataset", ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"])
    if dataset == "Sector":
        sectors = get_unique_sectors()
        selected_sector = st.selectbox("Select Sector", sectors)
    force_refresh = st.checkbox("Force Refresh (Re-fetch All)")
    num_top = st.slider("Top N Stocks", 1, 50, 20)
    show_all = st.checkbox("Show All (Ignore Top N)")
    exclude_negative = st.checkbox("Exclude Negative Flags (e.g., Value Trap, Debt Burden)")
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

# Additional filters
search = st.text_input("Search Ticker/Company")
if search:
    results = [r for r in results if search.lower() in r['metrics']['Ticker'].lower() or search.lower() in r['metrics']['Company Name'].lower()]

unique_flags = sorted(set(flag for res in results for flag in res['flags']))
selected_flags = st.multiselect("Filter by Flags", unique_flags)
if selected_flags:
    results = [r for r in results if any(flag in r['flags'] for flag in selected_flags)]

# Exclude negative flags if checked
negative_flags = {"Value Trap", "High-Risk Growth", "Debt Burden"}  # Define negatives
if exclude_negative:
    results = [r for r in results if not any(flag in negative_flags for flag in r['flags'])]

# Rank by final_score desc
results.sort(key=lambda x: x['final_score'], reverse=True)
top_results = results if show_all else results[:num_top]

# Disclaimer for search
if search and not top_results:
    st.info("No matches found. Note: Results are ranked by score; low-scoring stocks may not appear unless 'Show All' is checked.")

# Helper to format large numbers as B/M
def format_large(val):
    if val >= 1e9:
        return f"{round(val / 1e9, 2)}B"
    elif val >= 1e6:
        return f"{round(val / 1e6, 2)}M"
    else:
        return round(val, 2)

# Display ranked table using pandas (added new columns, combined 52W for space)
if top_results:
    df_data = []
    for res in top_results:
        m = res['metrics']
        # Dynamic positives based on key strengths (handle N/A with get_float)
        positives = []
        if "Undervalued" in res['flags']:
            positives.append(f"Undervalued with P/E {round(get_float(m, 'P/E'), 2)} and ROE {round(get_float(m, 'ROE'), 2)}%")
        if "Quality Moat" in res['flags']:
            positives.append(f"Quality moat with margins {round(get_float(m, 'Gross Margin'), 2)}%/{round(get_float(m, 'Net Profit Margin'), 2)}%")
        if "Strong Balance Sheet" in res['flags']:
            positives.append(f"Strong balance with D/E {round(get_float(m, 'D/E'), 2)}")
        positives_str = "; ".join(positives) if positives else "Solid fundamentals."
        
        df_data.append({
            "Company (Ticker)": f"{m['Company Name']} ({m['Ticker']})",
            "Score": round(res['final_score'], 2),
            "Price": round(get_float(m, 'Current Price'), 2),
            "52W High/Low": f"{round(get_float(m, '52W High'), 2)} / {round(get_float(m, '52W Low'), 2)}",
            "EV": format_large(get_float(m, 'EV')),
            "Total Cash": format_large(get_float(m, 'Total Cash')),
            "Total Debt": format_large(get_float(m, 'Total Debt')),
            "P/E": round(get_float(m, 'P/E'), 2),
            "ROE %": round(get_float(m, 'ROE'), 2),
            "P/B": round(get_float(m, 'P/B'), 2),
            "PEG": round(get_float(m, 'PEG'), 2),
            "Gross Margin %": round(get_float(m, 'Gross Margin'), 2),
            "FCF/EV %": round(get_float(m, 'FCF % EV TTM'), 2),
            "D/E": round(get_float(m, 'D/E'), 2),
            "Flags": ", ".join(res['flags']),
            "Positives": positives_str,
        })
    df = pd.DataFrame(df_data)

    # Column excluder
    all_columns = df.columns.tolist()
    excluded_columns = st.multiselect("Select Columns to Exclude", all_columns, default=[])
    displayed_columns = [col for col in all_columns if col not in excluded_columns]
    df = df[displayed_columns]  # Filter to non-excluded

    st.subheader("Ranked Top Stocks")
    st.dataframe(df, width='stretch', height=400, hide_index=False)  # Keeps index

    # Export button
    csv = df.to_csv(index=False).encode('utf-8')
    st.download_button("Export CSV", data=csv, file_name="top_stocks.csv", mime="text/csv")

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
                    reason = f"High score due to relevant metrics (e.g., ROE: {round(get_float(m, 'ROE'), 2)}%, Flags: {', '.join(res['flags'])})."
                    st.markdown(f"- {m['Company Name']} ({m['Ticker']}): {reason}")

    # Warnings
    st.subheader("Warnings")
    high_pe = [r['metrics']['Ticker'] for r in results if get_float(r['metrics'], 'P/E') > 30]
    st.markdown(f"- High P/E stocks needing review: {', '.join(high_pe) if high_pe else 'None'}.")
    st.markdown("- Monitor debt burdens and market volatility.")
else:
    st.info("No stocks match the selected dataset. Try seeding data or changing filters.")