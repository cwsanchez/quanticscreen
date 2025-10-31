import yfinance as yf

import logging
import time

class StockFetcher:
    def __init__(self):
        logging.basicConfig(level=logging.ERROR)
        self.logger = logging.getLogger(__name__)

    def fetch_metrics(self, ticker):
        """
        Fetches stock metrics for a single ticker using yfinance (Yahoo Finance API).
        Returns dict with metrics in the expected format, or empty on error.
        Handles calculations for % metrics and includes actual $ values where needed.
        Added: Company name, industry, and sector for output table and filtering.
        """
        for attempt in range(2):
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                # Extract and format metrics
                pe = info.get('trailingPE', None)
                if pe is None:
                    market_cap = info.get('marketCap', None)
                    trailing_eps = info.get('trailingEps', None)
                    if market_cap and trailing_eps and trailing_eps != 0:
                        pe = market_cap / trailing_eps
                    else:
                        pe = 'N/A'
                        self.logger.warning(f"Missing P/E for {ticker}, fallback calculation failed.")
        
                # PEG calculation
                peg = info.get('pegRatio', None)
                if peg is None:
                    pe_for_peg = info.get('trailingPE') or info.get('forwardPE') or None
                    growth = info.get('earningsGrowth', 0)
                    if pe_for_peg is not None and growth > 0:
                        peg = pe_for_peg / (growth * 100)
                    else:
                        peg = 'N/A'
                    self.logger.warning(f"Missing original pegRatio for {ticker}, calculated as {peg}")
                else:
                    peg = peg  # Use original
        
                # P/FCF calculation
                market_cap = info.get('marketCap', 0)
                free_cashflow = info.get('freeCashflow', 0)
                if free_cashflow > 0 and market_cap > 0:
                    p_fcf = market_cap / free_cashflow
                else:
                    p_fcf = 'N/A'
                    self.logger.warning(f"Unable to calculate P/FCF for {ticker} due to missing or zero freeCashflow")
        
                metrics = {
                    "Ticker": ticker,
                    "Company Name": info.get('longName', 'N/A'),
                    "Industry": info.get('industry', 'N/A'),
                    "Sector": info.get('sector', 'N/A'),
                    "P/E": pe,
                    "Forward P/E": info.get('forwardPE', 'N/A'),
                    "ROE": info.get('returnOnEquity', 'N/A') * 100 if info.get('returnOnEquity') else 'N/A',
                    "D/E": info.get('debtToEquity', 'N/A') / 100 if info.get('debtToEquity') else 'N/A',
                    "P/B": info.get('priceToBook', 'N/A'),
                    "PEG": peg,
                    "Earnings Growth": info.get('earningsGrowth', 'N/A') * 100 if info.get('earningsGrowth') else 'N/A',
                    "Revenue Growth": info.get('revenueGrowth', 'N/A') * 100 if info.get('revenueGrowth') else 'N/A',
                    "Gross Margin": info.get('grossMargins', 'N/A') * 100 if info.get('grossMargins') else 'N/A',
                    "Net Profit Margin": info.get('profitMargins', 'N/A') * 100 if info.get('profitMargins') else 'N/A',
                    "FCF % EV TTM": (info.get('freeCashflow', 0) / info.get('enterpriseValue', 1)) * 100 if info.get('enterpriseValue') else 'N/A',
                    "EBITDA % EV TTM": (info.get('ebitda', 0) / info.get('enterpriseValue', 1)) * 100 if info.get('enterpriseValue') else 'N/A',
                    "Current Price": info.get('currentPrice', 'N/A'),
                    "52W High": info.get('fiftyTwoWeekHigh', 'N/A'),
                    "52W Low": info.get('fiftyTwoWeekLow', 'N/A'),
                    "Market Cap": info.get('marketCap', 'N/A'),
                    "EV": info.get('enterpriseValue', 'N/A'),
                    "Total Cash": info.get('totalCash', 'N/A'),
                    "Total Debt": info.get('totalDebt', 'N/A'),
                    "FCF Actual": info.get('freeCashflow', 'N/A'),
                    "EBITDA Actual": info.get('ebitda', 'N/A'),
                    "P/FCF": p_fcf,
                    "Beta": info.get('beta', 'N/A'),
                    "Dividend Yield": info.get('dividendYield', 'N/A') * 100 if info.get('dividendYield') else 'N/A',
                    "Average Volume": info.get('averageVolume', 'N/A'),
                    "RSI": latest_rsi
                }
        
                # Log missing metrics
                for key, value in metrics.items():
                    if value == 'N/A':
                        self.logger.warning(f"Missing metric {key} for {ticker}")
        
                return metrics
            except Exception as e:
                self.logger.error(f"Attempt {attempt+1} failed for {ticker}: {e}")
                if attempt < 1:
                    time.sleep(2)
        else:
            self.logger.error(f"All attempts failed for {ticker}")
            return {}

# Test
if __name__ == "__main__":
    import json
    fetcher = StockFetcher()
    print(json.dumps(fetcher.fetch_metrics("UNH"), indent=2))