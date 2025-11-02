import streamlit as st
import time
import logging
import re
import random
from db import get_latest_metrics, get_stale_tickers, save_metrics, Session, Stock, MetricFetch, ProcessedResult
from fetcher import StockFetcher

def manage_page():
    st.title("Manage Page")

    # Password protection
    if 'authenticated' not in st.session_state or not st.session_state['authenticated']:
        password = st.text_input("Enter Admin Password", type="password")
        if st.button("Submit"):
            if password == st.secrets.get("admin_password"):
                st.session_state['authenticated'] = True
                st.rerun()
            else:
                st.error("Incorrect password.")
                return
        return

    st.success("Authenticated as admin.")

    # Manual Refresh Button
    st.subheader("Manual Refresh All Stale")
    if st.button("Manual Refresh All Stale"):
        last_manual_refresh = st.session_state.get('last_manual_refresh', 0)
        estimated_time = 7200  # 2 hours
        if time.time() - last_manual_refresh < estimated_time:
            remaining = int((estimated_time - (time.time() - last_manual_refresh)) / 60)
            st.warning(f"Refresh in progress or recently completed—wait {remaining} minutes.")
        else:
            st.session_state['last_manual_refresh'] = time.time()
            with st.spinner("Refreshing..."):
                progress = st.progress(0)
                stale_tickers = get_stale_tickers()
                if not stale_tickers:
                    st.info("No stale tickers found.")
                else:
                    fetcher = StockFetcher()
                    batch_size = random.randint(5, 10)
                    total = len(stale_tickers)
                    done = 0
                    for i in range(0, total, batch_size):
                        batch = stale_tickers[i:i + batch_size]
                        for t in batch:
                            try:
                                metrics = fetcher.fetch_metrics(t)
                                if metrics:
                                    save_metrics(metrics)
                                    logging.info(f"Manual fetch: updated {t}")
                            except Exception as e:
                                logging.error(f"Manual fetch error {t}: {e}")
                            time.sleep(random.randint(5, 10))
                            done += 1
                            progress.progress(done / total)
                        time.sleep(random.randint(5, 10))
                    st.success("Manual refresh completed.")

    # Fetch New Stocks
    st.subheader("Fetch New Stocks")
    ticker_input = st.text_input("Add/Refresh Tickers (comma-separated, 1-20)")
    if st.button("Fetch"):
        tickers = [t.strip().upper() for t in ticker_input.split(',') if t.strip()]
        if len(tickers) > 20:
            st.error("Max 20 tickers.")
        elif not all(re.match(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?(-[A-Z])?$', t) for t in tickers):
            st.error("Invalid ticker format.")
        else:
            last_fetch_new = st.session_state.get('last_fetch_new', 0)
            if time.time() - last_fetch_new < 3600:
                st.warning("Rate limit: once per hour.")
            else:
                st.session_state['last_fetch_new'] = time.time()
                existing = [t for t in tickers if get_latest_metrics(t)]
                new_ones = [t for t in tickers if not get_latest_metrics(t)]
                all_to_fetch = new_ones + existing
                fetcher = StockFetcher()
                for t in all_to_fetch:
                    try:
                        metrics = fetcher.fetch_metrics(t)
                        if metrics:
                            save_metrics(metrics)
                            st.success(f"Fetched {t}")
                        else:
                            st.error(f"Failed to fetch {t}")
                    except Exception as e:
                        st.error(f"Error fetching {t}: {e}")
                    time.sleep(random.randint(5, 10))

    # Delete Stocks
    st.subheader("Delete Stocks")
    delete_input = st.text_input("Delete Tickers (comma-separated, 1-5)")
    if st.button("Delete"):
        tickers = [t.strip().upper() for t in delete_input.split(',') if t.strip()]
        if len(tickers) > 5:
            st.error("Max 5 tickers.")
        else:
            last_delete = st.session_state.get('last_delete', 0)
            if time.time() - last_delete < 300:
                st.warning("Rate limit: 5 min cooldown.")
            else:
                st.session_state['last_delete'] = time.time()
                session = Session()
                for ticker in tickers:
                    session.query(MetricFetch).filter_by(ticker=ticker).delete()
                    session.query(ProcessedResult).join(MetricFetch).filter(MetricFetch.ticker == ticker).delete()
                    session.query(Stock).filter_by(ticker=ticker).delete()
                    st.success(f"Deleted {ticker}")
                session.commit()
                session.close()
manage_page()