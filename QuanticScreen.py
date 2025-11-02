import streamlit as st
import json
from db import init_db, get_all_tickers, get_unique_sectors, get_latest_metrics, get_all_latest_metrics, save_metrics, get_metadata, set_metadata, get_stale_tickers
logging.info("Successfully imported get_all_latest_metrics")
from processor import get_float, process_stock, DEFAULT_LOGIC, PRESETS
import pandas as pd
import numpy as np  # For np.nan
import io  # For CSV export
import re
import time
import random
from fetcher import StockFetcher
from datetime import datetime, timedelta
from datetime import time as dt_time
import pytz
import threading

# Define default weights and metrics at the top to avoid NameError on navigation
default_weights = {'P/E': 0.2, 'ROE': 0.2, 'P/B': 0.1, 'PEG': 0.15, 'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.1, 'EBITDA % EV TTM': 0.05}
default_metrics = list(default_weights.keys())

st.set_page_config(page_title="QuanticScreen", page_icon="📊", layout="wide")

init_db()

# Sample data if DB empty
sample_metrics = [
    {
        'Ticker': 'AAPL',
        'Company Name': 'Apple Inc.',
        'Industry': 'Technology',
        'Sector': 'Technology',
        'P/E': 28.5,
        'ROE': 0.25,
        'D/E': 0.5,
        'P/B': 5.2,
        'PEG': 1.8,
        'Gross Margin': 0.38,
        'Net Profit Margin': 0.22,
        'FCF % EV TTM': 0.15,
        'EBITDA % EV TTM': 0.20,
        'Current Price': 150.0,
        '52W High': 200.0,
        '52W Low': 120.0,
        'Market Cap': 2500000000000,
        'EV': 2600000000000,
        'Total Cash': 50000000000,
        'Total Debt': 100000000000,
        'FCF Actual': 80000000000,
        'EBITDA Actual': 100000000000,
        'P/FCF': 25.0,
        'fetch_timestamp': datetime.now().isoformat(),
        'fetch_id': None
    },
    {
        'Ticker': 'MSFT',
        'Company Name': 'Microsoft Corporation',
        'Industry': 'Technology',
        'Sector': 'Technology',
        'P/E': 32.0,
        'ROE': 0.30,
        'D/E': 0.4,
        'P/B': 12.0,
        'PEG': 2.0,
        'Gross Margin': 0.70,
        'Net Profit Margin': 0.35,
        'FCF % EV TTM': 0.18,
        'EBITDA % EV TTM': 0.25,
        'Current Price': 300.0,
        '52W High': 400.0,
        '52W Low': 250.0,
        'Market Cap': 2200000000000,
        'EV': 2300000000000,
        'Total Cash': 80000000000,
        'Total Debt': 60000000000,
        'FCF Actual': 60000000000,
        'EBITDA Actual': 90000000000,
        'P/FCF': 30.0,
        'fetch_timestamp': datetime.now().isoformat(),
        'fetch_id': None
    },
    {
        'Ticker': 'GOOGL',
        'Company Name': 'Alphabet Inc.',
        'Industry': 'Technology',
        'Sector': 'Technology',
        'P/E': 25.0,
        'ROE': 0.20,
        'D/E': 0.1,
        'P/B': 4.5,
        'PEG': 1.5,
        'Gross Margin': 0.55,
        'Net Profit Margin': 0.20,
        'FCF % EV TTM': 0.12,
        'EBITDA % EV TTM': 0.18,
        'Current Price': 2800.0,
        '52W High': 3000.0,
        '52W Low': 2000.0,
        'Market Cap': 1800000000000,
        'EV': 1850000000000,
        'Total Cash': 100000000000,
        'Total Debt': 20000000000,
        'FCF Actual': 50000000000,
        'EBITDA Actual': 80000000000,
        'P/FCF': 28.0,
        'fetch_timestamp': datetime.now().isoformat(),
        'fetch_id': None
    },
    {
        'Ticker': 'TSLA',
        'Company Name': 'Tesla Inc.',
        'Industry': 'Automotive',
        'Sector': 'Consumer Discretionary',
        'P/E': 50.0,
        'ROE': 0.15,
        'D/E': 0.8,
        'P/B': 8.0,
        'PEG': 3.0,
        'Gross Margin': 0.18,
        'Net Profit Margin': 0.08,
        'FCF % EV TTM': 0.05,
        'EBITDA % EV TTM': 0.10,
        'Current Price': 250.0,
        '52W High': 300.0,
        '52W Low': 150.0,
        'Market Cap': 800000000000,
        'EV': 850000000000,
        'Total Cash': 20000000000,
        'Total Debt': 5000000000,
        'FCF Actual': 10000000000,
        'EBITDA Actual': 15000000000,
        'P/FCF': 40.0,
        'fetch_timestamp': datetime.now().isoformat(),
        'fetch_id': None
    }
]

db_empty = len(get_all_tickers()) == 0
if db_empty:
    st.warning("DB failed/empty. Retried. Showing samples. Restart to retry.")

@st.cache_data
def load_all_metrics():
    return get_all_latest_metrics()

# Auto-fetch logic with polling
def fetch_bg():
    et_tz = pytz.timezone('US/Eastern')
    now_et = datetime.now(et_tz)
    is_weekday = now_et.weekday() < 5
    market_open = dt_time(9, 30)
    current_time = now_et.time()
    market_open_dt = datetime.combine(now_et.date(), market_open).replace(tzinfo=et_tz)
    market_update_end = market_open_dt + timedelta(hours=4)

    if is_weekday and current_time > market_open and current_time < market_update_end.time():
        last_fetch_str = get_metadata('last_fetch_time')
        last_fetch = datetime.fromisoformat(last_fetch_str).replace(tzinfo=et_tz) if last_fetch_str else None
        if last_fetch is None or last_fetch < market_open_dt:
            stale_tickers = get_stale_tickers()
            if stale_tickers:
                fetcher = StockFetcher()
                batch_size = random.randint(5, 10)
                for i in range(0, len(stale_tickers), batch_size):
                    batch = stale_tickers[i:i + batch_size]
                    for t in batch:
                        try:
                            metrics = fetcher.fetch_metrics(t)
                            if metrics:
                                save_metrics(metrics)
                        except Exception as e:
                            print(f"Error fetching {t}: {e}")
                        time.sleep(random.randint(5, 10))
                    time.sleep(random.randint(5, 10))
                set_metadata('last_fetch_time', datetime.now().isoformat())
    # Schedule next poll in 15 mins
    threading.Timer(15 * 60, fetch_bg).start()

# Start polling thread
threading.Thread(target=fetch_bg, daemon=True).start()

st.title("QuanticScreen")

st.info("Loading large datasets may take time; consider filtering for faster results.")

with st.sidebar:
    st.sidebar.title("QuanticScreen")
    dataset = st.selectbox("Select Dataset", ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"] + list(st.session_state.get('custom_sets', {}).keys()))
    if dataset == "Sector":
        sectors = get_unique_sectors()
        selected_sector = st.selectbox("Select Sector", sectors)

    # Initialize configs in session state
    if 'configs' not in st.session_state:
        st.session_state.configs = {}

    preset_options = ["Overall", "Value", "Growth", "Momentum", "Quality"]
    custom_configs = [k for k in st.session_state.configs.keys() if k not in preset_options]
    config_options = preset_options + custom_configs
    config_name = st.selectbox("Select Config", config_options, index=0)
    num_top = st.slider("Top N Stocks", 1, 200, 100)
    show_all = st.checkbox("Show All (Ignore Top N)")
    exclude_negative = st.checkbox("Exclude Negative Flags (e.g., Value Trap, Debt Burden)")

    # Custom Sets
    st.subheader("Create Custom Set")
    set_name = st.text_input("Set Name")
    ticker_input = st.text_area("Comma-separated Tickers (e.g., AAPL,MSFT)")
    if st.button("Create Set"):
        if set_name and ticker_input:
            input_tickers = [t.strip().upper() for t in ticker_input.split(',')]
            if len(input_tickers) > 50:
                input_tickers = input_tickers[:50]
                st.warning("Input capped to 50 tickers.")
            valid_tickers = [t for t in input_tickers if re.match(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?(-[A-Z])?$', t)]
            if valid_tickers:
                if 'custom_sets' not in st.session_state:
                    st.session_state.custom_sets = {}
                st.session_state.custom_sets[set_name] = valid_tickers
                st.success(f"Created set '{set_name}' with {len(valid_tickers)} valid tickers.")
                st.rerun()

                # Check for unseeded tickers
                unseeded = [t for t in valid_tickers if not get_latest_metrics(t)]
                if unseeded:
                    st.warning(f"New tickers queued for fetch: {', '.join(unseeded)}. Fetching limited to 20/hour, may take time.")
            else:
                st.error("No valid tickers provided. Tickers should be 1-5 uppercase letters, optionally with '.' or '-'.")
        else:
            st.error("Provide a name and tickers.")

# Get metrics and process on the fly
if db_empty:
    metrics_list = sample_metrics
else:
    metrics_list = load_all_metrics()

# Set config
if config_name in PRESETS:
    config = {
        'weights': default_weights,
        'metrics': default_metrics,
        'logic': PRESETS[config_name]
    }
else:
    config = st.session_state.configs[config_name]

weights = config['weights']
selected_metrics = config['metrics']
logic = config['logic']

results = []
with st.spinner('Processing stocks...'):
    progress = st.progress(0)
    for i, metrics in enumerate(metrics_list):
        r = process_stock(metrics, weights, selected_metrics, logic)
        results.append(r)
        progress.progress((i+1)/len(metrics_list))

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
    st.dataframe(df, width='stretch', height=600, hide_index=False)  # Keeps index

    # Export button
    csv = df.to_csv(index=False).encode('utf-8')
    st.download_button("Export CSV", data=csv, file_name="top_stocks.csv", mime="text/csv")

else:
    st.info("No stocks match the selected dataset. Try seeding data or changing filters.")