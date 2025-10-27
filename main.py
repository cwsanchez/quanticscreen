# main.py
import argparse
from fetcher import fetch_metrics
from processor import process_stock  # We'll add this

def main():
    parser = argparse.ArgumentParser(description="StockSimTool CLI")
    parser.add_argument('--tickers', type=str, default="UNH,NVO", help="Comma-separated tickers or file path")
    args = parser.parse_args()

    # Handle input (dummy for now; later load from file)
    tickers = args.tickers.split(',')
    results = {}
    for ticker in tickers:
        metrics = fetch_metrics(ticker)  # Or dummy from fetcher
        if metrics:
            scored = process_stock(metrics)  # From processor
            results[ticker] = scored
    print(results)  # Later: Export

if __name__ == "__main__":
    main()