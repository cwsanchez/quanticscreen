import streamlit as st
import json
from db import init_db, get_all_tickers, get_unique_sectors, get_latest_metrics, get_all_latest_metrics, save_metrics, get_metadata, set_metadata, get_stale_tickers, prune_old_metrics, get_price_history, save_price_history
import logging
logging.basicConfig(level=logging.INFO)
logging.info("Successfully imported get_all_latest_metrics")
from processor import get_float, process_stock, DEFAULT_LOGIC, PRESETS, CONDITIONS, format_large, get_cap_category
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
def display_ticker_summary(ticker):
    metrics = get_latest_metrics(ticker)
    if not metrics or datetime.now() - datetime.fromisoformat(metrics['fetch_timestamp']) > timedelta(hours=24):
        with st.spinner("Fetching data..."):
            fetcher = StockFetcher()
            new_metrics = fetcher.fetch_metrics(ticker)
            if new_metrics:
                save_metrics(new_metrics)
                metrics = get_latest_metrics(ticker)
                logging.info(f"Fetched and saved metrics for {ticker}")
            time.sleep(random.randint(5, 10))
    if metrics:
        if 'weights' not in st.session_state or 'selected_metrics' not in st.session_state or 'logic' not in st.session_state:
            logging.info("Using fallback config for summary processing")
        processed = process_stock(metrics, st.session_state.get('weights', default_weights), st.session_state.get('selected_metrics', default_metrics), st.session_state.get('logic', DEFAULT_LOGIC))
        history = get_price_history(ticker)
        if not history:
            with st.spinner("Fetching price history..."):
                fetcher = StockFetcher()
                history = fetcher.fetch_history(ticker)
                if history:
                    save_price_history(ticker, history)
                    logging.info(f"Fetched and saved history for {ticker}")
                time.sleep(random.randint(5, 10))
        with st.expander(f"Summary for {ticker}"):
            # List all metrics in two columns, rounded to 2 decimals where float, skip internals
            skip_keys = {'fetch_timestamp', 'fetch_id'}
            large_value_keys = ['Market Cap', 'EV', 'Total Cash', 'Total Debt', 'FCF Actual', 'EBITDA Actual', 'Average Volume']
            metric_items = [(k, v) for k, v in metrics.items() if k not in skip_keys]
            col1, col2 = st.columns(2)
            half = len(metric_items) // 2
            for i, (key, val) in enumerate(metric_items):
                col = col1 if i < half else col2
                with col:
                    if val == 'N/A':
                        display_val = 'N/A'
                    elif key in large_value_keys:
                        display_val = format_large(round(float(val), 2))
                    elif isinstance(val, (int, float)):
                        display_val = f"{round(float(val), 2)}"
                    else:
                        display_val = val
                    st.write(f"**{key}:** {display_val}")
            st.write(f"**Flags:** {', '.join(processed['flags'])}")
            st.subheader("Positives")
            positives = processed['positives']
            if isinstance(positives, str):
                positives_list = positives.split('; ')
            else:
                positives_list = positives
            if positives_list:
                for positive in positives_list:
                    st.markdown(f"- {positive.strip()}")
            else:
                st.write("No positives identified.")
            current = get_float(metrics, 'Current Price')
            low = get_float(metrics, '52W Low')
            high = get_float(metrics, '52W High')
            if current != 'N/A' and low != 'N/A' and high != 'N/A':
                st.metric("Current Price", f"${current:.2f}")
                range_ = high - low
                if range_ > 0:
                    pos = (current - low) / range_
                    left_dashes = int(pos * 20)
                    right_dashes = 20 - left_dashes
                    bar = f"[52W Low: ${low:.2f}] {'─' * left_dashes}|{'─' * right_dashes} [52W High: ${high:.2f}]"
                    st.markdown(f"<div style='font-family: monospace;'>{bar}</div>", unsafe_allow_html=True)
            if history:
                df_hist = pd.DataFrame(history)
                df_hist['date'] = pd.to_datetime(df_hist['date'])
                df_hist.set_index('date', inplace=True)
                min_close = df_hist['close'].min()
                max_close = df_hist['close'].max()
                st.line_chart(df_hist['close'])
                st.write(f"Min Close: ${min_close:.2f} | Max Close: ${max_close:.2f}")

                # Rankings by Preset
                st.subheader("Rankings by Preset")
                now = datetime.now()
                if 'rankings' not in st.session_state:
                    st.session_state.rankings = {}
                if 'rankings' not in st.session_state or ticker not in st.session_state.rankings or (now - st.session_state.rankings[ticker]['timestamp']) > timedelta(hours=12):
                    start_time = time.time()
                    all_metrics = load_all_metrics()
                    rankings = {}
                    target_cap = processed['cap_category']
                    target_sector = metrics.get('Sector', 'N/A')
                    cap_header = target_cap if target_cap != 'N/A' else 'Unknown'
                    sector_header = target_sector if target_sector != 'N/A' else 'Unknown'
                    for preset in ['Value', 'Growth', 'Momentum', 'Quality']:
                        logic = PRESETS[preset]
                        processed_all = [process_stock(m, weights=default_weights, selected_metrics=default_metrics, logic=logic) for m in all_metrics]
                        # All
                        sorted_all = sorted(processed_all, key=lambda x: x['final_score'], reverse=True)
                        rank_all = next((i+1 for i, p in enumerate(sorted_all) if p['metrics']['Ticker'] == ticker), None)
                        rankings[f"{preset}_All"] = f"{rank_all}/{len(sorted_all)}" if rank_all else 'N/A'
                        # Market Cap
                        filtered_cap = [p for p in processed_all if p['cap_category'] == target_cap]
                        if filtered_cap:
                            sorted_cap = sorted(filtered_cap, key=lambda x: x['final_score'], reverse=True)
                            rank_cap = next((i+1 for i, p in enumerate(sorted_cap) if p['metrics']['Ticker'] == ticker), None)
                            rankings[f"{preset}_{cap_header}"] = f"{rank_cap}/{len(sorted_cap)}" if rank_cap else 'N/A'
                        else:
                            rankings[f"{preset}_Market Cap"] = 'N/A'
                        # Sector
                        filtered_sector = [p for p in processed_all if p['metrics'].get('Sector', 'N/A') == target_sector]
                        if filtered_sector:
                            sorted_sector = sorted(filtered_sector, key=lambda x: x['final_score'], reverse=True)
                            rank_sector = next((i+1 for i, p in enumerate(sorted_sector) if p['metrics']['Ticker'] == ticker), None)
                            rankings[f"{preset}_{sector_header}"] = f"{rank_sector}/{len(filtered_sector)}" if rank_sector else 'N/A'
                        else:
                            rankings[f"{preset}_Sector"] = 'N/A'
                    st.session_state.rankings[ticker] = {'data': rankings, 'timestamp': now}
                    compute_time = time.time() - start_time
                    logging.info(f"Computed rankings for {ticker} in {compute_time:.2f}s")
                else:
                    rankings = st.session_state.rankings[ticker]['data']

                # Create 4x3 grid
                data = {
                    'All': [rankings[f"{p}_All"] for p in ['Value', 'Growth', 'Momentum', 'Quality']],
                    cap_header: [rankings[f"{p}_{cap_header}"] for p in ['Value', 'Growth', 'Momentum', 'Quality']],
                    sector_header: [rankings[f"{p}_{sector_header}"] for p in ['Value', 'Growth', 'Momentum', 'Quality']]
                }
                df_rank = pd.DataFrame(data, index=['Value', 'Growth', 'Momentum', 'Quality'])
                st.table(df_rank)

db_empty = len(get_all_tickers()) == 0
if db_empty:
    st.warning("DB failed/empty. Retried. Showing samples. Restart to retry.")

@st.cache_data
def load_all_metrics():
    return get_all_latest_metrics()

# Auto-fetch logic with polling
def get_last_close_date(now=datetime.now(pytz.timezone('US/Eastern'))):
    while now.weekday() > 4 or now.hour < 16:
        now -= timedelta(days=1)
    return now.date() if now.weekday() <= 4 else (now - timedelta(days=now.weekday()-4)).date()

def fetch_bg():
    if st.session_state.get('bg_thread_started', False):
        logging.info("Background thread already started - skipping duplicate.")
        return
    logging.info("Starting background refresh...")
    et_tz = pytz.timezone('US/Eastern')
    now_et = datetime.now(et_tz)
    market_open_dt = datetime.combine(now_et.date(), dt_time(0,0)).replace(tzinfo=et_tz)

    last_fetch_str = get_metadata('last_fetch_time')
    last_fetch = datetime.fromisoformat(last_fetch_str).replace(tzinfo=et_tz) if last_fetch_str else None
    if last_fetch is None or last_fetch < market_open_dt:
        stale_tickers = get_stale_tickers()
        last_close_date = get_last_close_date(now_et)
        to_fetch = []
        for t in stale_tickers:
            metrics = get_latest_metrics(t)
            if metrics is None:
                to_fetch.append((t, 'initial'))
            else:
                fetch_date = datetime.fromisoformat(metrics['fetch_timestamp']).date()
                if fetch_date < last_close_date:
                    to_fetch.append((t, 'refresh'))
                else:
                    logging.info(f"Skipping {t}: fetch_timestamp {fetch_date} >= last_close_date {last_close_date}")
        if not to_fetch:
            logging.info("No tickers to fetch.")
            # Schedule next poll in 15 mins
            threading.Timer(15 * 60, fetch_bg).start()
            return
        fetcher = StockFetcher()
        chunk_size = 30  # Process in chunks of 30
        batch_size = random.randint(3, 5)
        total_to_fetch = len(to_fetch)
        logging.info(f"Processing {total_to_fetch} tickers to fetch in chunks of {chunk_size}.")
        for i in range(0, total_to_fetch, chunk_size):
            chunk = to_fetch[i:i + chunk_size]
            processed_tickers = []
            for j in range(0, len(chunk), batch_size):
                batch = chunk[j:j + batch_size]
                for t, fetch_type in batch:
                    try:
                        metrics = fetcher.fetch_metrics(t)
                        if metrics:
                            save_metrics(metrics)
                            if fetch_type == 'initial':
                                logging.info(f"Fetched initial metrics for {t}.")
                            else:
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
            if i + chunk_size < total_to_fetch and total_to_fetch > 50:
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

# Search Ticker for Summary
all_tickers = get_all_tickers()
if all_tickers:
    selected_ticker = st.selectbox("Search Ticker Summary", options=all_tickers, index=None, key='summary_selected_ticker')
    if selected_ticker:
        display_ticker_summary(selected_ticker)
else:
    st.write('No tickers available')

if 'selected_ticker' in st.session_state:
    ticker = st.session_state.selected_ticker
    metrics = get_latest_metrics(ticker)
    if not metrics or datetime.now() - datetime.fromisoformat(metrics['fetch_timestamp']) > timedelta(hours=24):
        with st.spinner("Fetching data..."):
            fetcher = StockFetcher()
            new_metrics = fetcher.fetch_metrics(ticker)
            if new_metrics:
                save_metrics(new_metrics)
                metrics = get_latest_metrics(ticker)
                logging.info(f"Fetched and saved metrics for {ticker}")
            time.sleep(random.randint(5, 10))
    if metrics:
            if 'weights' not in st.session_state or 'selected_metrics' not in st.session_state or 'logic' not in st.session_state:
                logging.info("Using fallback config for summary processing")
            processed = process_stock(metrics, st.session_state.get('weights', default_weights), st.session_state.get('selected_metrics', default_metrics), st.session_state.get('logic', DEFAULT_LOGIC))
            history = get_price_history(ticker)
            if not history:
                with st.spinner("Fetching price history..."):
                    fetcher = StockFetcher()
                    history = fetcher.fetch_history(ticker)
                    if history:
                        save_price_history(ticker, history)
                        logging.info(f"Fetched and saved history for {ticker}")
                    time.sleep(random.randint(5, 10))
            with st.expander(f"Summary for {ticker}"):
                # List all metrics in two columns, rounded to 2 decimals where float, skip internals
                skip_keys = {'fetch_timestamp', 'fetch_id'}
                large_value_keys = ['Market Cap', 'EV', 'Total Cash', 'Total Debt', 'FCF Actual', 'EBITDA Actual', 'Average Volume']
                metric_items = [(k, v) for k, v in metrics.items() if k not in skip_keys]
                col1, col2 = st.columns(2)
                half = len(metric_items) // 2
                for i, (key, val) in enumerate(metric_items):
                    col = col1 if i < half else col2
                    with col:
                        if val == 'N/A':
                            display_val = 'N/A'
                        elif key in large_value_keys:
                            display_val = format_large(round(float(val), 2))
                        elif isinstance(val, (int, float)):
                            display_val = f"{round(float(val), 2)}"
                        else:
                            display_val = val
                        st.write(f"**{key}:** {display_val}")
                st.write(f"**Flags:** {', '.join(processed['flags'])}")
                st.subheader("Positives")
                positives = processed['positives']
                if isinstance(positives, str):
                    positives_list = positives.split('; ')
                else:
                    positives_list = positives
                if positives_list:
                    for positive in positives_list:
                        st.markdown(f"- {positive.strip()}")
                else:
                    st.write("No positives identified.")
                current = get_float(metrics, 'Current Price')
                low = get_float(metrics, '52W Low')
                high = get_float(metrics, '52W High')
                if current != 'N/A' and low != 'N/A' and high != 'N/A':
                    st.metric("Current Price", f"${current:.2f}")
                    range_ = high - low
                    if range_ > 0:
                        pos = (current - low) / range_
                        left_dashes = int(pos * 20)
                        right_dashes = 20 - left_dashes
                        bar = f"[52W Low: ${low:.2f}] {'─' * left_dashes}|{'─' * right_dashes} [52W High: ${high:.2f}]"
                        st.markdown(f"<div style='font-family: monospace;'>{bar}</div>", unsafe_allow_html=True)
                if history:
                    df_hist = pd.DataFrame(history)
                    df_hist['date'] = pd.to_datetime(df_hist['date'])
                    df_hist.set_index('date', inplace=True)
                    min_close = df_hist['close'].min()
                    max_close = df_hist['close'].max()
                    st.line_chart(df_hist['close'])
                    st.write(f"Min Close: ${min_close:.2f} | Max Close: ${max_close:.2f}")

                    # Rankings by Preset
                    st.subheader("Rankings by Preset")
                    now = datetime.now()
                    if 'rankings' not in st.session_state:
                        st.session_state.rankings = {}
                    if 'rankings' not in st.session_state or ticker not in st.session_state.rankings or (now - st.session_state.rankings[ticker]['timestamp']) > timedelta(hours=12):
                        start_time = time.time()
                        all_metrics = load_all_metrics()
                        rankings = {}
                        target_cap = processed['cap_category']
                        target_sector = metrics.get('Sector', 'N/A')
                        cap_header = target_cap if target_cap != 'N/A' else 'Unknown'
                        sector_header = target_sector if target_sector != 'N/A' else 'Unknown'
                        for preset in ['Value', 'Growth', 'Momentum', 'Quality']:
                            logic = PRESETS[preset]
                            processed_all = [process_stock(m, weights=default_weights, selected_metrics=default_metrics, logic=logic) for m in all_metrics]
                            # All
                            sorted_all = sorted(processed_all, key=lambda x: x['final_score'], reverse=True)
                            rank_all = next((i+1 for i, p in enumerate(sorted_all) if p['metrics']['Ticker'] == ticker), None)
                            rankings[f"{preset}_All"] = f"{rank_all}/{len(sorted_all)}" if rank_all else 'N/A'
                            # Market Cap
                            filtered_cap = [p for p in processed_all if p['cap_category'] == target_cap]
                            if filtered_cap:
                                sorted_cap = sorted(filtered_cap, key=lambda x: x['final_score'], reverse=True)
                                rank_cap = next((i+1 for i, p in enumerate(sorted_cap) if p['metrics']['Ticker'] == ticker), None)
                                rankings[f"{preset}_{cap_header}"] = f"{rank_cap}/{len(sorted_cap)}" if rank_cap else 'N/A'
                            else:
                                rankings[f"{preset}_Market Cap"] = 'N/A'
                            # Sector
                            filtered_sector = [p for p in processed_all if p['metrics'].get('Sector', 'N/A') == target_sector]
                            if filtered_sector:
                                sorted_sector = sorted(filtered_sector, key=lambda x: x['final_score'], reverse=True)
                                rank_sector = next((i+1 for i, p in enumerate(sorted_sector) if p['metrics']['Ticker'] == ticker), None)
                                rankings[f"{preset}_{sector_header}"] = f"{rank_sector}/{len(sorted_sector)}" if rank_sector else 'N/A'
                            else:
                                rankings[f"{preset}_Sector"] = 'N/A'
                        st.session_state.rankings[ticker] = {'data': rankings, 'timestamp': now}
                        compute_time = time.time() - start_time
                        logging.info(f"Computed rankings for {ticker} in {compute_time:.2f}s")
                    else:
                        rankings = st.session_state.rankings[ticker]['data']

                    # Create 4x3 grid
                    data = {
                        'All': [rankings[f"{p}_All"] for p in ['Value', 'Growth', 'Momentum', 'Quality']],
                        cap_header: [rankings[f"{p}_{cap_header}"] for p in ['Value', 'Growth', 'Momentum', 'Quality']],
                        sector_header: [rankings[f"{p}_{sector_header}"] for p in ['Value', 'Growth', 'Momentum', 'Quality']]
                    }
                    df_rank = pd.DataFrame(data, index=['Value', 'Growth', 'Momentum', 'Quality'])
                    st.table(df_rank)

def on_dataset_change():
    if st.session_state.dataset in st.session_state.get('custom_sets', {}):
        custom_tickers = st.session_state.custom_sets[st.session_state.dataset]
        all_tickers_db = get_all_tickers()
        missing = [t for t in custom_tickers if t not in all_tickers_db]
        if missing:
            st.warning(f"Refreshing missing tickers: {', '.join(missing)}")
            logging.info(f"Missing tickers in custom set {st.session_state.dataset}: {missing}")
            fetcher = StockFetcher()
            for t in missing:
                try:
                    metrics = fetcher.fetch_metrics(t)
                    if metrics:
                        save_metrics(metrics)
                        logging.info(f"Fetched and saved {t}")
                    time.sleep(random.randint(5,10))
                except Exception as e:
                    logging.error(f"Error fetching {t}: {e}")
            st.rerun()

with st.sidebar:
    st.sidebar.title("QuanticScreen")

    # Custom Sets
    with st.form("create_custom_set"):
        st.subheader("Create Custom Set")
        set_name = st.text_input("New Custom Set Name", key='new_set_name')
        available_tickers = get_all_tickers()
        selected_tickers = st.multiselect("Select Tickers", available_tickers, key='selected_tickers')
        submitted = st.form_submit_button("Save")
        if submitted:
            if set_name and selected_tickers:
                if 'custom_sets' not in st.session_state:
                    st.session_state.custom_sets = {}
                st.session_state.custom_sets[set_name] = selected_tickers
                st.success(f"Created set '{set_name}' with {len(selected_tickers)} tickers.")
            else:
                st.error("Provide a name and select tickers.")


    options = ["All", "Large Cap", "Mid Cap", "Small Cap", "Value", "Growth", "Sector"] + list(st.session_state.get('custom_sets', {}).keys())
    default_dataset = st.session_state.get('dataset', "All")
    index_dataset = options.index(default_dataset) if default_dataset in options else 0
    dataset = st.selectbox("Select Dataset", options, index=index_dataset, key='dataset', on_change=on_dataset_change)
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

# Store config in session_state for summary access
st.session_state.weights = weights
st.session_state.selected_metrics = selected_metrics
st.session_state.logic = logic

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
    all_tickers_db = get_all_tickers()
    skipped = []
    fetcher = StockFetcher()
    for t in custom_tickers:
        if t not in all_tickers_db:
            skipped.append(t)
        elif get_latest_metrics(t) is None:
            try:
                metrics = fetcher.fetch_metrics(t)
                if metrics:
                    save_metrics(metrics)
                    logging.info(f"Fetched and saved metrics for {t} in custom set {dataset}")
                else:
                    skipped.append(t)
            except Exception as e:
                logging.error(f"Error fetching {t}: {e}")
                skipped.append(t)
            time.sleep(random.randint(5, 10))
    if skipped:
        st.warning(f"Tickers {', '.join(skipped)} not found in database or fetch failed and will be skipped. Use Manage page to add new tickers.")
    valid_tickers = [t for t in custom_tickers if get_latest_metrics(t)]
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

# Display ranked table using pandas (added new columns, combined 52W for space)
if top_results:
    df_data = []
    for res in top_results:
        m = res['metrics']
        positives_str = '; '.join(res['positives'])
        
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
            "Net Margin %": f"{round(get_float(m, 'Net Profit Margin'), 2)}" if m['Net Profit Margin'] != 'N/A' else 'N/A',
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