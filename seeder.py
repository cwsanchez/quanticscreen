from fetcher import StockFetcher
from db import get_latest_metrics, save_metrics, init_db
from datetime import datetime, timedelta
import time
from tickers import DEFAULT_TICKERS

def batches(l, n):
    for i in range(0, len(l), n):
        yield l[i:i + n]

def seed(force=False):
    """
    Seeds the DB with top 700 tickers in batches of 30.
    Only re-fetches if cache >72h old or no data, unless force=True.
    """
    if force:
        import os
        if os.path.exists('stock_screen.db'):
            print("Clearing old DB for fix")
            os.remove('stock_screen.db')
    init_db()

    all_tickers = DEFAULT_TICKERS

    fetcher = StockFetcher()
    for batch in batches(all_tickers, 30):
        for ticker in batch:
            if force or not get_latest_metrics(ticker):
                metrics = fetcher.fetch_metrics(ticker)
                if metrics:
                    save_metrics(metrics)
                time.sleep(2)
        time.sleep(20)

if __name__ == "__main__":
    seed()