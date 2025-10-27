import yfinance as yf

def fetch_metrics(ticker):
    """
    Fetches stock metrics for a single ticker using yfinance (Yahoo Finance API).
    Returns dict with metrics in the expected format, or empty on error.
    Handles calculations for % metrics and includes actual $ values where needed.
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        # Extract and format metrics
        metrics = {
            "P/E": info.get('trailingPE', 'N/A'),
            "ROE": info.get('returnOnEquity', 'N/A') * 100 if info.get('returnOnEquity') else 'N/A',  # Convert to %
            "D/E": info.get('debtToEquity', 'N/A'),
            "P/B": info.get('priceToBook', 'N/A'),
            "PEG": info.get('pegRatio', 'N/A'),
            "Gross Margin": info.get('grossMargins', 'N/A') * 100 if info.get('grossMargins') else 'N/A',  # Convert to %
            "Net Profit Margin": info.get('profitMargins', 'N/A') * 100 if info.get('profitMargins') else 'N/A',  # Convert to %
            "FCF % EV TTM": (info.get('freeCashflow', 0) / info.get('enterpriseValue', 1)) * 100 if info.get('enterpriseValue') else 'N/A',
            "EBITDA % EV TTM": (info.get('ebitda', 0) / info.get('enterpriseValue', 1)) * 100 if info.get('enterpriseValue') else 'N/A',
            "Current Price": info.get('currentPrice', 'N/A'),
            "52W High": info.get('fiftyTwoWeekHigh', 'N/A'),
            "52W Low": info.get('fiftyTwoWeekLow', 'N/A'),
            "Market Cap": info.get('marketCap', 'N/A'),
            "EV": info.get('enterpriseValue', 'N/A'),
            "Total Cash": info.get('totalCash', 'N/A'),
            "Total Debt": info.get('totalDebt', 'N/A')
        }
        # Include actual $ values as per project overview (e.g., for FCF and EBITDA)
        metrics["FCF Actual"] = info.get('freeCashflow', 'N/A')
        metrics["EBITDA Actual"] = info.get('ebitda', 'N/A')
        return metrics
    except Exception as e:
        print(f"Error fetching metrics for {ticker}: {e}")
        return {}

# Test
if __name__ == "__main__":
    import json
    print(json.dumps(fetch_metrics("UNH"), indent=2))