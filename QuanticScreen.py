import streamlit as st
import json
from db import init_db, get_all_tickers, get_unique_sectors, get_latest_metrics, save_metrics, get_metadata, set_metadata
from processor import get_float, process_stock, DEFAULT_LOGIC
from tickers import DEFAULT_TICKERS  # Import for validation
import pandas as pd
import numpy as np  # For np.nan
from seeder import seed
import io  # For CSV export
import re
import time
from fetcher import StockFetcher
from datetime import datetime, timedelta, time
import pytz
import threading

st.set_page_config(page_title="QuanticScreen", page_icon="📊", layout="wide")

init_db()

# Auto-fetch logic
def fetch_bg():
    fetcher = StockFetcher()
    tickers = DEFAULT_TICKERS  # or get_all_tickers() + custom if needed
    for t in tickers:
        if not get_latest_metrics(t):
            try:
                metrics = fetcher.fetch_metrics(t)
                if metrics:
                    save_metrics(metrics)
                time.sleep(1)
            except Exception as e:
                pass  # Log if needed
    set_metadata('last_fetch_time', datetime.now().isoformat())

# Check if need to fetch
et_tz = pytz.timezone('US/Eastern')
now_et = datetime.now(et_tz)
is_weekday = now_et.weekday() < 5
market_close = time(16, 0)
market_open = time(9, 30)
after_close_before_open = is_weekday and (now_et.time() > market_close or now_et.time() < market_open)

last_fetch_str = get_metadata('last_fetch_time')
st.write(f"Last fetch time: {last_fetch_str}")
last_fetch = datetime.fromisoformat(last_fetch_str) if last_fetch_str else None
need_fetch = last_fetch is None or (datetime.now() - last_fetch > timedelta(hours=12)) or after_close_before_open

if need_fetch:
    st.write("Starting fetch")
    with st.spinner("Fetching data..."):
        threading.Thread(target=fetch_bg).start()

st.title("QuanticScreen")

with st.sidebar:
    st.sidebar.title("QuanticScreen")
    dataset = st.selectbox("Select Dataset", ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"] + list(st.session_state.get('custom_sets', {}).keys()))
    if dataset == "Sector":
        sectors = get_unique_sectors()
        selected_sector = st.selectbox("Select Sector", sectors)

    # Initialize configs in session state
    if 'configs' not in st.session_state:
        default_weights = {
            'P/E': 0.2, 'ROE': 0.15, 'D/E': 0.1, 'P/B': 0.1, 'PEG': 0.1,
            'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.075,
            'EBITDA % EV TTM': 0.075, 'Balance': 0.05, 'P/FCF': 0.075
        }
        default_metrics = list(default_weights.keys())
        st.session_state.configs = {
            'default': {
                'weights': default_weights,
                'metrics': default_metrics,
                'logic': DEFAULT_LOGIC
            }
        }

    config_name = st.selectbox('Select Config', list(st.session_state.configs.keys()))

    force_refresh = st.checkbox("Force Refresh (Re-fetch All)")
    num_top = st.slider("Top N Stocks", 1, 50, 20)
    show_all = st.checkbox("Show All (Ignore Top N)")
    exclude_negative = st.checkbox("Exclude Negative Flags (e.g., Value Trap, Debt Burden)")
    if st.button("Seed Initial Data"):
        with st.spinner("Seeding data (this may take a while)..."):
            seed()
        st.success("Data seeded!")
        st.rerun()

    # Custom Sets
    st.subheader("Create Custom Set")
    set_name = st.text_input("Set Name")
    ticker_input = st.text_area("Comma-separated Tickers (e.g., AAPL,MSFT)")
    if st.button("Create Set"):
        if set_name and ticker_input:
            input_tickers = [t.strip().upper() for t in ticker_input.split(',')]
            valid_tickers = [t for t in input_tickers if re.match(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?(-[A-Z])?$', t)]
            if valid_tickers:
                if 'custom_sets' not in st.session_state:
                    st.session_state.custom_sets = {}
                st.session_state.custom_sets[set_name] = valid_tickers
                st.success(f"Created set '{set_name}' with {len(valid_tickers)} valid tickers.")
                st.rerun()
                
                # Check for unseeded tickers and fetch in background
                unseeded = [t for t in valid_tickers if not get_latest_metrics(t)]
                if unseeded:
                    st.warning(f"Unseeded tickers will be fetched in background: {', '.join(unseeded)}")
                    
                    def fetch_custom_bg(unseeded):
                        fetcher = StockFetcher()
                        for t in unseeded:
                            try:
                                metrics = fetcher.fetch_metrics(t)
                                if metrics:
                                    save_metrics(metrics)
                                time.sleep(1)
                            except Exception as e:
                                pass  # Log if needed
                    
                    threading.Thread(target=fetch_custom_bg, args=(unseeded,)).start()
            else:
                st.error("No valid tickers provided. Tickers should be 1-5 uppercase letters, optionally with '.' or '-'.")
        else:
            st.error("Provide a name and tickers.")

# Get all tickers and process on the fly
tickers = get_all_tickers()
results = []
for ticker in tickers:
    metrics = get_latest_metrics(ticker)
    if metrics:
        config = st.session_state.configs[config_name]
        processed = process_stock(metrics, config_dict=config)
        results.append(processed)

# Apply filters based on dataset
if dataset in st.session_state.get('custom_sets', {}):
    custom_tickers = st.session_state.custom_sets[dataset]
    results = [r for r in results if r['metrics']['Ticker'] in custom_tickers]
elif dataset == "Large Cap":
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

# Helper to format large numbers as B/M (returns str)
def format_large(val):
    if val >= 1e9:
        return f"{round(val / 1e9, 2)}B"
    elif val >= 1e6:
        return f"{round(val / 1e6, 2)}M"
    else:
        return f"{round(val, 2)}"

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
            "Score": f"{round(res['final_score'], 2)}",
            "Price": f"{round(get_float(m, 'Current Price'), 2)}" if m['Current Price'] != 'N/A' else 'N/A',
            "52W High/Low": f"{round(get_float(m, '52W High'), 2)} / {round(get_float(m, '52W Low'), 2)}" if m['52W High'] != 'N/A' else 'N/A',
            "MC": format_large(get_float(m, 'Market Cap')) if m['Market Cap'] != 'N/A' else 'N/A',
            "EV": format_large(get_float(m, 'EV')) if m['EV'] != 'N/A' else 'N/A',
            "Total Cash": format_large(get_float(m, 'Total Cash')) if m['Total Cash'] != 'N/A' else 'N/A',
            "Total Debt": format_large(get_float(m, 'Total Debt')) if m['Total Debt'] != 'N/A' else 'N/A',
            "P/E": f"{round(get_float(m, 'P/E'), 2)}" if m['P/E'] != 'N/A' else 'N/A',
            "ROE %": f"{round(get_float(m, 'ROE'), 2)}" if m['ROE'] != 'N/A' else 'N/A',
            "P/B": f"{round(get_float(m, 'P/B'), 2)}" if m['P/B'] != 'N/A' else 'N/A',
            "PEG": f"{round(get_float(m, 'PEG'), 2)}" if m['PEG'] != 'N/A' else 'N/A',
            "Gross Margin %": f"{round(get_float(m, 'Gross Margin'), 2)}" if m['Gross Margin'] != 'N/A' else 'N/A',
            "FCF/EV %": f"{round(get_float(m, 'FCF % EV TTM'), 2)}" if m['FCF % EV TTM'] != 'N/A' else 'N/A',
            "P/FCF": f"{round(get_float(m, 'P/FCF'), 2)}" if m.get('P/FCF', 'N/A') != 'N/A' else 'N/A',
            "D/E": f"{round(get_float(m, 'D/E'), 2)}" if m['D/E'] != 'N/A' else 'N/A',
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