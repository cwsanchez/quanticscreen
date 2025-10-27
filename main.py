# main.py
import argparse
from fetcher import fetch_metrics
from processor import process_stock

def main():
    parser = argparse.ArgumentParser(description="StockSimTool CLI")
    parser.add_argument('--tickers', type=str, help="Comma-separated tickers (overrides preset)")
    args = parser.parse_args()

    # Preset small list for ease; override with arg
    preset_tickers = ['UNH', 'NVO', 'AAPL', 'MSFT', 'GOOGL']
    tickers = args.tickers.split(',') if args.tickers else preset_tickers

    # Step 1: Gather data
    results = []
    for ticker in tickers:
        metrics = fetch_metrics(ticker)
        if metrics:
            processed = process_stock(metrics)
            results.append(processed)

    # Rank by final_score desc
    results.sort(key=lambda x: x['final_score'], reverse=True)

    # Parameters from algorithm
    num_top = 20  # All if len(results) < num_top
    top_results = results[:num_top]

    # Output as per Step 7 (markdown table)
    print("#### Ranked Top Stocks" if len(results) > num_top else "#### All Ranked Stocks")
    print("| # | Company (Ticker) | Score | Quantitative Details | Flags | Positives | Risks |")
    print("|---|---------|-------|----------------------|-------|-----------|-------|")
    for i, res in enumerate(top_results, 1):
        m = res['metrics']
        details = (
            f"P/E: {m['P/E']}<br>ROE: {m['ROE']}%<br>P/B: {m['P/B']}<br>PEG: {m['PEG']}<br>"
            f"Gross: {m['Gross Margin']}%<br>FCF/EV: {m['FCF % EV TTM']}%<br>D/E: {m['D/E']}"
        )
        print(f"| {i} | {m['Company Name']} ({m['Ticker']}) | {res['final_score']:.2f} | {details} | {', '.join(res['flags'])} | {res['positives']} | {res['risks']} |")

    # Step 5: Factor Sub-Lists (Top 3-5 per factor)
    factors = ['value', 'momentum', 'quality', 'growth']
    print("\n#### Factor Sub-Lists (Top 3-5 per Factor)")
    for factor in factors:
        sorted_by_factor = sorted(results, key=lambda x: x['factor_boosts'].get(factor, 0), reverse=True)
        top_factor = sorted_by_factor[:5]  # Top 5
        print(f"**{factor.capitalize()}**:")
        for res in top_factor:
            if res['factor_boosts'][factor] > 0:
                reason = f"High score due to relevant metrics (e.g., ROE: {res['metrics']['ROE']}%, Flags: {', '.join(res['flags'])})."
                print(f"- {res['metrics']['Company Name']} ({res['metrics']['Ticker']}): {reason}")

    # Warnings (Step 7 end)
    print("\n**Warnings**:")
    high_pe = [r['metrics']['Ticker'] for r in results if get_float(r['metrics']['P/E']) > 30]
    print(f"- High P/E stocks needing review: {', '.join(high_pe) if high_pe else 'None'}.")
    print("- Monitor debt burdens and market volatility.")

if __name__ == "__main__":
    main()