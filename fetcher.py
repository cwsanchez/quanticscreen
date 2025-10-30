import yfinance as yf

import logging

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

            p_fcf = info.get('priceToFreeCashflow', None)
            if p_fcf is None:
                market_cap = info.get('marketCap', None)
                free_cashflow_to_equity = info.get('freeCashflowToEquity', None)
                if market_cap and free_cashflow_to_equity and free_cashflow_to_equity != 0:
                    p_fcf = market_cap / free_cashflow_to_equity
                else:
                    p_fcf = 'N/A'
                    self.logger.warning(f"Missing P/FCF for {ticker}, fallback calculation failed.")

            metrics = {
                "Ticker": ticker,
                "Company Name": info.get('longName', 'N/A'),
                "Industry": info.get('industry', 'N/A'),
                "Sector": info.get('sector', 'N/A'),
                "P/E": pe,
                "ROE": info.get('returnOnEquity', 'N/A') * 100 if info.get('returnOnEquity') else 'N/A',  # Convert to %
                "D/E": info.get('debtToEquity', 'N/A') / 100 if info.get('debtToEquity') else 'N/A',  # Convert % to ratio (e.g., 75.577 -> 0.756)
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
                "Total Debt": info.get('totalDebt', 'N/A'),
                "FCF Actual": info.get('freeCashflow', 'N/A'),
                "EBITDA Actual": info.get('ebitda', 'N/A'),
                "P/FCF": p_fcf
            }

            # Log missing metrics
            for key, value in metrics.items():
                if value == 'N/A':
                    self.logger.warning(f"Missing metric {key} for {ticker}")

            return metrics
        except Exception as e:
            self.logger.error(f"Error fetching metrics for {ticker}: {e}")
            return {}

# Test
if __name__ == "__main__":
    import json
    fetcher = StockFetcher()
    print(json.dumps(fetcher.fetch_metrics("UNH"), indent=2))