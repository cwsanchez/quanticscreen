def get_float(metrics, key):
    """
    Helper to get float value from metrics dict or 0 if N/A/missing.
    """
    val = metrics.get(key, 'N/A')
    return float(val) if val != 'N/A' else 0.0

def format_large(val):
    if val >= 1e9:
        return f"{round(val / 1e9, 2)}B"
    elif val >= 1e6:
        return f"{round(val / 1e6, 2)}M"
    else:
        return f"{round(val, 2)}"

CONDITIONS = {
    'Undervalued': lambda m: get_float(m, 'P/E') < 15 and get_float(m, 'ROE') > 15,
    'Strong Balance Sheet': lambda m: get_float(m, 'D/E') < 1 and get_float(m, 'Total Cash') > get_float(m, 'Total Debt'),
    'Quality Moat': lambda m: get_float(m, 'Gross Margin') > 40 and get_float(m, 'Net Profit Margin') > 15 and get_float(m, 'FCF % EV TTM') > 5,
    'GARP': lambda m: get_float(m, 'PEG') < 1.5 and get_float(m, 'P/E') < 20,
    'High-Risk Growth': lambda m: get_float(m, 'P/E') > 30 and get_float(m, 'PEG') < 1,
    'Value Trap': lambda m: get_float(m, 'P/B') < 1.5 and get_float(m, 'ROE') < 5,
    'Momentum Building': lambda m: get_float(m, 'Current Price') > 0.9 * get_float(m, '52W High') and get_float(m, 'EBITDA % EV TTM') > 5,
    'Debt Burden': lambda m: get_float(m, 'D/E') > 2 and get_float(m, 'FCF % EV TTM') < 1
}

DEFAULT_LOGIC = {
    'Undervalued': {'enabled': True, 'boost': 15},
    'Strong Balance Sheet': {'enabled': True, 'boost': 10},
    'Quality Moat': {'enabled': True, 'boost': 15},
    'GARP': {'enabled': True, 'boost': 10},
    'High-Risk Growth': {'enabled': True, 'boost': -10},
    'Value Trap': {'enabled': True, 'boost': -10},
    'Momentum Building': {'enabled': True, 'boost': 5},
    'Debt Burden': {'enabled': True, 'boost': -15}
}

def process_stock(metrics, config_dict=None):
    """
    Processes a single stock's metrics per algorithm steps 2-5.
    Returns dict with: base_score, final_score, flags (list), positives (str), risks (str), factor_boosts (dict for value/momentum/etc.).
    Handles N/A as 0 for scoring.
    Overall flow: Score individual metrics (0-10), weight to base (0-100), apply multi-metric correlations for boosts/penalties/flags, add factor lens boosts.
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

    # Load config or defaults
    if config_dict is None:
        weights = {
            'P/E': 0.2, 'ROE': 0.15, 'D/E': 0.1, 'P/B': 0.1, 'PEG': 0.1,
            'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.075,
            'EBITDA % EV TTM': 0.075, 'Balance': 0.05
        }
        selected_metrics = list(weights.keys())
        logic = DEFAULT_LOGIC
    else:
        weights = config_dict['weights']
        selected_metrics = config_dict['metrics']
        logic = config_dict['logic']

    # Normalize weights for selected only
    sum_w = sum(weights.get(m, 0) for m in selected_metrics)
    if sum_w > 0:
        weights = {m: weights[m] / sum_w for m in selected_metrics}

    # Step 2: Individual Metric Scoring (0-10)
    # (Comments on single-metric thresholds omitted as per user: only multi-metric correlations need explanation)
    metric_scores = {}
    if 'P/E' in selected_metrics:
        metric_scores['P/E'] = 10 if pe < 15 else 7 if pe < 20 else 5 if pe < 30 else 2 if pe < 40 else 0
    if 'ROE' in selected_metrics:
        metric_scores['ROE'] = 10 if roe > 15 else 7 if roe >= 10 else 5 if roe >= 5 else 0
    if 'D/E' in selected_metrics:
        metric_scores['D/E'] = 10 if de < 1 else 7 if de < 1.5 else 5 if de < 2 else 0
    if 'P/B' in selected_metrics:
        metric_scores['P/B'] = 10 if pb < 1.5 else 7 if pb < 2.5 else 5 if pb < 4 else 0
    if 'PEG' in selected_metrics:
        metric_scores['PEG'] = 10 if peg < 1 else 7 if peg < 1.5 else 5 if peg < 2 else 0
    if 'Gross Margin' in selected_metrics:
        metric_scores['Gross Margin'] = 10 if gross > 40 else 7 if gross >= 30 else 5 if gross >= 20 else 0
    if 'Net Profit Margin' in selected_metrics:
        metric_scores['Net Profit Margin'] = 10 if net > 15 else 7 if net >= 10 else 5 if net >= 5 else 0
    if 'FCF % EV TTM' in selected_metrics:
        metric_scores['FCF % EV TTM'] = 10 if fcf_ev > 5 else 7 if fcf_ev >= 3 else 5 if fcf_ev >= 1 else 0
    if 'EBITDA % EV TTM' in selected_metrics:
        metric_scores['EBITDA % EV TTM'] = 10 if ebitda_ev > 10 else 7 if ebitda_ev >= 5 else 5 if ebitda_ev >= 2 else 0
    if 'Balance' in selected_metrics:
        metric_scores['Balance'] = 10 if (cash > 0.2 * mcap) or (price > 0.8 * high) else 0 if (debt > mcap) or (price < 1.1 * low) else 5

    # Step 3: Weighting & Base Score (0-100)
    base_score = sum(metric_scores.get(m, 0) * weights.get(m, 0) for m in selected_metrics) * 10  # Scale to 0-100

    # Step 4: Correlations & Flags (Boost/Penalty %)
    flags = []
    boost_total = 0
    positives = ""
    risks = ""
    for flag in logic:
        if logic[flag]['enabled'] and flag in CONDITIONS and CONDITIONS[flag](metrics):
            flags.append(flag)
            boost = logic[flag]['boost']
            boost_total += boost
            if boost > 0:
                positives += f'{flag} (+{boost}%) '
            else:
                risks += f'{flag} ({boost}%) '

    # Step 5: Factor Lens (Extra Boosts, sub-rankings in main.py)
    factor_boosts = {
        # Identifies undervalued assets with strong equity returns.
        'value': 10 if pb < 1.5 and roe > 15 else 0,
        # Identifies upward trends with cash support.
        'momentum': 5 if price > 0.9 * high and get_float(metrics, 'FCF Actual') > 0 else 0,
        # Identifies high-quality businesses with profitability/low leverage.
        'quality': 10 if gross > 40 and net > 15 and de < 1 else 0,
        # Identifies growth at reasonable scale.
        'growth': 5 if peg < 1 and 1e9 < mcap < 1e11 else 0
    }
    factor_boost_total = sum(factor_boosts.values())

    # Final Score
    final_score = base_score + (base_score * (boost_total / 100)) + factor_boost_total

    # If positives or risks are empty, use defaults
    if not positives:
        positives = "Solid fundamentals based on available metrics."
    if not risks:
        risks = "Low risks based on available metrics."

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