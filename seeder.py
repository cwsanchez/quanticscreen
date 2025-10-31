from fetcher import StockFetcher
from db import get_latest_metrics, save_metrics, init_db
from datetime import datetime, timedelta
import time
from tickers import DEFAULT_TICKERS

def batches(l, n):
    for i in range(0, len(l), n):
        yield l[i:i + n]

def seed():
    """
    Seeds the DB with top 500 tickers in batches of 20.
    Only re-fetches if cache >72h old or no data.
    """
    init_db()

    all_tickers = DEFAULT_TICKERS

    fetcher = StockFetcher()
    for batch in batches(all_tickers, 20):
        for ticker in batch:
            if not get_latest_metrics(ticker):
                metrics = fetcher.fetch_metrics(ticker)
                if metrics:
                    save_metrics(metrics)
                time.sleep(3)
        time.sleep(30)

if __name__ == "__main__":
    seed()