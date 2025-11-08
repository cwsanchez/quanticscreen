import streamlit as st
import json
from db import init_db, get_all_tickers, get_unique_sectors, get_latest_metrics, get_all_latest_metrics, save_metrics, get_metadata, set_metadata, get_stale_tickers, prune_old_metrics
import logging
logging.basicConfig(level=logging.INFO)
logging.info("Successfully imported get_all_latest_metrics")
from processor import get_float, process_stock, DEFAULT_LOGIC, PRESETS, CONDITIONS
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
    if st.session_state.get('bg_thread_started', False):
        logging.info("Background thread already started - skipping duplicate.")
        return
    logging.info("Starting background refresh...")
    et_tz = pytz.timezone('US/Eastern')
    now_et = datetime.now(et_tz)
    is_weekday = now_et.weekday() < 5
    market_open = dt_time(9, 30)
    current_time = now_et.time()
    market_open_dt = datetime.combine(now_et.date(), market_open).replace(tzinfo=et_tz)
    market_update_end = market_open_dt + timedelta(hours=6.5)  # 9:30 AM to 4:00 PM ET

    if not (is_weekday and current_time >= market_open and current_time <= market_update_end.time()):
        logging.info("Skipping: not market hours/weekday.")
        # Schedule next poll in 15 mins
        threading.Timer(15 * 60, fetch_bg).start()
        return

    last_fetch_str = get_metadata('last_fetch_time')
    last_fetch = datetime.fromisoformat(last_fetch_str).replace(tzinfo=et_tz) if last_fetch_str else None
    if last_fetch is None or last_fetch < market_open_dt:
        stale_tickers = get_stale_tickers()
        if not stale_tickers:
            logging.info("No stale tickers found.")
            # Schedule next poll in 15 mins
            threading.Timer(15 * 60, fetch_bg).start()
            return
        fetcher = StockFetcher()
        chunk_size = 30  # Process in chunks of 30
        batch_size = random.randint(3, 5)
        total_stale = len(stale_tickers)
        logging.info(f"Processing {total_stale} stale tickers in chunks of {chunk_size}.")
        for i in range(0, total_stale, chunk_size):
            chunk = stale_tickers[i:i + chunk_size]
            processed_tickers = []
            for j in range(0, len(chunk), batch_size):
                batch = chunk[j:j + batch_size]
                for t in batch:
                    try:
                        metrics = fetcher.fetch_metrics(t)
                        if metrics:
                            save_metrics(metrics)
                            logging.info(f"Fetched and updated {t}.")
                            processed_tickers.append(t)
                    except Exception as e:
                        logging.error(f"Error fetching {t}: {e}")
                    time.sleep(random.randint(10, 30))  # Sleep per ticker
                time.sleep(random.randint(30, 60))  # Sleep per batch
            # After chunk, prune old metrics for processed tickers
            if processed_tickers:
                prune_old_metrics(tickers=processed_tickers)
                logging.info(f"Pruned old metrics for chunk of {len(processed_tickers)} tickers.")
            # If more chunks and total >50, sleep before next chunk
            if i + chunk_size < total_stale and total_stale > 50:
                sleep_time = random.randint(15 * 60, 30 * 60)
                logging.info(f"More chunks remaining, sleeping {sleep_time}s before next chunk.")
                time.sleep(sleep_time)
        set_metadata('last_fetch_time', datetime.now().isoformat())
    # Schedule next poll in 15 mins
    threading.Timer(15 * 60, fetch_bg).start()

# Start polling thread
if not st.session_state.get('bg_thread_started', False):
    threading.Thread(target=fetch_bg, daemon=True).start()
    st.session_state['bg_thread_started'] = True

st.title("QuanticScreen")

st.info("Loading large datasets may take time; consider filtering for faster results.")

with st.sidebar:
    st.sidebar.title("QuanticScreen")

    # Custom Sets
    st.subheader("Create Custom Set")
    set_name = st.text_input("Set Name", key='set_name')
    ticker_input = st.text_area("Comma-separated Tickers (e.g., AAPL,MSFT)", key='ticker_input')
    if st.button("Create Set"):
        if set_name and ticker_input:
            input_tickers = [t.strip().upper() for t in ticker_input.split(',')]
            if len(input_tickers) > 50:
                input_tickers = input_tickers[:50]
                st.warning("Input capped to 50 tickers.")
            valid_tickers = [t for t in input_tickers if re.match(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?(-[A-Z])?$', t) and get_latest_metrics(t)]
            unseeded = [t for t in input_tickers if re.match(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?(-[A-Z])?$', t) and not get_latest_metrics(t)]
            if valid_tickers:
                if 'custom_sets' not in st.session_state:
                    st.session_state.custom_sets = {}
                st.session_state.custom_sets[set_name] = valid_tickers
                st.success(f"Created set '{set_name}' with {len(valid_tickers)} valid tickers.")
                st.rerun()
                if unseeded:
                    for t in unseeded:
                        st.warning(f"Ticker {t} not found in database and will be skipped. Use the Manage page to add new tickers.")

            else:
                st.error("No valid tickers provided. Tickers should be 1-5 uppercase letters, optionally with '.' or '-'.")
        else:
            st.error("Provide a name and tickers.")

    # Custom Filters
    st.subheader("Custom Filters")
    custom_filter_name = st.text_input("Custom Filter Name", key='custom_filter_name')
    if st.button("Save Current Filters"):
        if custom_filter_name:
            current_filters = {
                'dataset': st.session_state.get('dataset'),
                'selected_sector': st.session_state.get('selected_sector') if st.session_state.get('dataset') == "Sector" else None,
                'config_name': st.session_state.get('config_name'),
                'num_top': st.session_state.get('num_top'),
                'show_all': st.session_state.get('show_all'),
                'exclude_negative': st.session_state.get('exclude_negative'),
                'require_flags': st.session_state.get('require_flags'),
                'match_type': st.session_state.get('match_type'),
                'search': st.session_state.get('search')
            }
            if 'custom_filters' not in st.session_state:
                st.session_state.custom_filters = {}
            st.session_state.custom_filters[custom_filter_name] = current_filters
            st.success(f"Saved filter '{custom_filter_name}'")
            logging.info(f"Saved custom filter: {custom_filter_name}")
    load_filter = st.selectbox("Load Custom Filter", [""] + list(st.session_state.get('custom_filters', {}).keys()), key='load_filter')
    if load_filter and load_filter != "":
        loaded = st.session_state.custom_filters[load_filter]
        logging.info(f"Attempting to load filter '{load_filter}': loaded dataset='{loaded['dataset']}', current session dataset='{st.session_state.get('dataset')}'")
        options = ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"] + list(st.session_state.get('custom_sets', {}).keys())
        if loaded['dataset'] not in options:
            logging.error(f"Loaded dataset '{loaded['dataset']}' not in available options: {options}")
            st.error(f"Invalid dataset in filter '{load_filter}': {loaded['dataset']}")
        else:
            logging.info("Setting session state for loaded filter")
            st.session_state.dataset = loaded['dataset']
            if loaded['selected_sector']:
                st.session_state.selected_sector = loaded['selected_sector']
            st.session_state.config_name = loaded['config_name']
            st.session_state.num_top = loaded['num_top']
            st.session_state.show_all = loaded['show_all']
            st.session_state.exclude_negative = loaded['exclude_negative']
            st.session_state.require_flags = loaded['require_flags']
            st.session_state.match_type = loaded['match_type']
            st.session_state.search = loaded['search']
            st.session_state.load_filter = ""
            st.success(f"Loaded filter '{load_filter}'")
            logging.info(f"Loaded custom filter: {load_filter}")
            st.rerun()

    options = ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"] + list(st.session_state.get('custom_sets', {}).keys())
    default_dataset = st.session_state.get('dataset', "All")
    index_dataset = options.index(default_dataset) if default_dataset in options else 0
    dataset = st.selectbox("Select Dataset", options, index=index_dataset, key='dataset')
    if dataset == "Sector":
        sectors = get_unique_sectors()
        default_sector = st.session_state.get('selected_sector')
        index_sector = sectors.index(default_sector) if default_sector and default_sector in sectors else 0
        selected_sector = st.selectbox("Select Sector", sectors, index=index_sector, key='selected_sector')

    # Initialize configs in session state
    if 'configs' not in st.session_state:
        st.session_state.configs = {}

    preset_options = ["Overall", "Value", "Growth", "Momentum", "Quality"]
    custom_configs = [k for k in st.session_state.configs.keys() if k not in preset_options]
    config_options = preset_options + custom_configs
    default_config = st.session_state.get('config_name', "Overall")
    index_config = config_options.index(default_config) if default_config in config_options else 0
    config_name = st.selectbox("Select Config", config_options, index=index_config, key='config_name')
    num_top = st.slider("Top N Stocks", 1, 200, value=st.session_state.get('num_top', 100), key='num_top')
    show_all = st.checkbox("Show All (Ignore Top N)", value=st.session_state.get('show_all', False), key='show_all')
    exclude_negative = st.checkbox("Exclude Negative Flags (e.g., Value Trap, Debt Burden)", value=st.session_state.get('exclude_negative', False), key='exclude_negative')

    # Flag filtering
    require_flags = st.multiselect("Require Flags", list(CONDITIONS.keys()), default=st.session_state.get('require_flags', []), key='require_flags')
    match_type = st.radio("Match", ["Any", "All"], index=0 if st.session_state.get('match_type', "Any") == "Any" else 1, key='match_type')

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
    valid_tickers = [t for t in custom_tickers if get_latest_metrics(t)]
    skipped = [t for t in custom_tickers if not get_latest_metrics(t)]
    if skipped:
        st.warning(f"Tickers {', '.join(skipped)} not found in database and will be skipped. Use Manage page to add new tickers.")
    results = [r for r in results if r['metrics']['Ticker'] in valid_tickers]
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
search = st.text_input("Search Ticker/Company", value=st.session_state.get('search', ""), key='search')
if search:
    results = [r for r in results if search.lower() in r['metrics']['Ticker'].lower() or search.lower() in r['metrics']['Company Name'].lower()]

# Apply flag filters
if require_flags:
    if match_type == "Any":
        results = [r for r in results if any(flag in r['flags'] for flag in require_flags)]
    else:
        results = [r for r in results if all(flag in r['flags'] for flag in require_flags)]
    logging.info(f"Applied flag filter: {require_flags} with {match_type} logic, {len(results)} results remaining.")

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