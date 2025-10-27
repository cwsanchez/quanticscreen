# processor.py

def get_float(metrics, key):
    """
    Helper to get float value from metrics dict or 0 if N/A/missing.
    """
    val = metrics.get(key, 'N/A')
    return float(val) if val != 'N/A' else 0.0

def process_stock(metrics):
    """
    Processes a single stock's metrics per algorithm steps 2-5.
    Returns dict with: base_score, final_score, flags (list), positives (str), risks (str), factor_boosts (dict for value/momentum/etc.).
    Handles N/A as 0 for scoring.
    """
    # Use the top-level get_float
    pe = get_float(metrics, 'P/E')
    roe = get_float(metrics, 'ROE')
    de = get_float(metrics, 'D/E')
    pb = get_float(metrics, 'P/B')
    peg = get_float(metrics, 'PEG')
    gross = get_float(metrics, 'Gross Margin')
    net = get_float(metrics, 'Net Profit Margin')
    fcf_ev = get_float(metrics, 'FCF % EV TTM')
    ebitda_ev = get_float(metrics, 'EBITDA % EV TTM')
    cash = get_float(metrics, 'Total Cash')
    mcap = get_float(metrics, 'Market Cap')
    price = get_float(metrics, 'Current Price')
    high = get_float(metrics, '52W High')
    low = get_float(metrics, '52W Low')
    debt = get_float(metrics, 'Total Debt')

    # Step 2: Individual Metric Scoring (0-10)
    pe_score = 10 if pe < 15 else 7 if pe < 20 else 5 if pe < 30 else 2 if pe < 40 else 0

    roe_score = 10 if roe > 15 else 7 if roe >= 10 else 5 if roe >= 5 else 0

    de_score = 10 if de < 1 else 7 if de < 1.5 else 5 if de < 2 else 0

    pb_score = 10 if pb < 1.5 else 7 if pb < 2.5 else 5 if pb < 4 else 0

    peg_score = 10 if peg < 1 else 7 if peg < 1.5 else 5 if peg < 2 else 0

    gross_score = 10 if gross > 40 else 7 if gross >= 30 else 5 if gross >= 20 else 0

    net_score = 10 if net > 15 else 7 if net >= 10 else 5 if net >= 5 else 0

    fcf_ev_score = 10 if fcf_ev > 5 else 7 if fcf_ev >= 3 else 5 if fcf_ev >= 1 else 0

    ebitda_ev_score = 10 if ebitda_ev > 10 else 7 if ebitda_ev >= 5 else 5 if ebitda_ev >= 2 else 0

    # Balance score
    balance_score = 10 if (cash > 0.2 * mcap) or (price > 0.8 * high) else 0 if (debt > mcap) or (price < 1.1 * low) else 5

    # Step 3: Weighting & Base Score (0-100)
    weights = {
        'P/E': 0.2, 'ROE': 0.15, 'D/E': 0.1, 'P/B': 0.1, 'PEG': 0.1,
        'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.075,
        'EBITDA % EV TTM': 0.075, 'Balance': 0.05
    }
    base_score = (
        pe_score * weights['P/E'] + roe_score * weights['ROE'] + de_score * weights['D/E'] +
        pb_score * weights['P/B'] + peg_score * weights['PEG'] + gross_score * weights['Gross Margin'] +
        net_score * weights['Net Profit Margin'] + fcf_ev_score * weights['FCF % EV TTM'] +
        ebitda_ev_score * weights['EBITDA % EV TTM'] + balance_score * weights['Balance']
    ) * 10  # Scale to 0-100

    # Step 4: Correlations & Flags (Boost/Penalty %)
    flags = []
    boost_penalty = 0.0

    if pe < 15 and roe > 15:
        boost_penalty += 15
        flags.append("Strong value")

    if de < 1 and cash > 0.1 * mcap:
        boost_penalty += 10
        flags.append("Resilient")

    if gross > 40 and net > 15 and fcf_ev > 5:
        boost_penalty += 15
        flags.append("Durable")

    if peg < 1 and 15 <= pe <= 25:
        boost_penalty += 10
        flags.append("Balanced growth")

    if pe > 30 and peg < 0.8:
        boost_penalty -= 10  # Sentiment override ignored for now
        flags.append("Speculative")

    if pb < 1.5 and roe < 5:
        boost_penalty -= 10
        flags.append("Bargain risk")

    if price > 0.9 * high and ebitda_ev > 10:
        boost_penalty += 5
        flags.append("Momentum building")

    if de > 2 and fcf_ev < 3:
        boost_penalty -= 15
        flags.append("Strain")

    # Step 5: Factor Lens (Extra Boosts, sub-rankings in main.py)
    factor_boosts = {
        'value': 10 if pb < 1.5 and roe > 15 else 0,  # Value
        'momentum': 5 if price > 0.9 * high and get_float(metrics, 'FCF Actual') > 0 else 0,  # Momentum
        'quality': 10 if gross > 40 and net > 15 and de < 1 else 0,  # Quality
        'growth': 5 if peg < 1 and 1e9 < mcap < 1e11 else 0  # Growth (mid-cap ~1B-100B)
    }
    factor_boost_total = sum(factor_boosts.values())

    # Final Score
    final_score = base_score * (1 + (boost_penalty / 100)) + factor_boost_total

    # Positives/Risks (concise, tied to metrics/flags)
    positives = f"Strong ROE ({roe}%) and FCF % EV ({fcf_ev}%) indicate efficiency. Flags: {', '.join(flags) if flags else 'None'}."
    risks = f"High D/E ({de}) may strain balance sheet. Watch debt ({debt})." if de > 2 or debt > mcap else "Low risks based on metrics."

    return {
        'base_score': base_score,
        'final_score': final_score,
        'flags': flags,
        'positives': positives,
        'risks': risks,
        'factor_boosts': factor_boosts,  # For sub-rankings
        'metrics': metrics  # Original for details
    }

# Test
if __name__ == "__main__":
    dummy_metrics = {'P/E': 15.3, 'ROE': 21.7, 'D/E': 0.75, 'P/B': 3.5, 'PEG': 1.2, 'Gross Margin': 25, 'Net Profit Margin': 6, 'FCF % EV TTM': 4, 'EBITDA % EV TTM': 7, 'Total Cash': 10000000000, 'Market Cap': 300000000000, 'Current Price': 500, '52W High': 600, '52W Low': 400, 'Total Debt': 50000000000, 'FCF Actual': 10000000000}
    print(process_stock(dummy_metrics))