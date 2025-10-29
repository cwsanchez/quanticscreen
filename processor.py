from db import get_processor_config

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
def process_stock(metrics, config_name='default'):
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

    # Load config
    config = get_processor_config(config_name)
    if not config:
        raise ValueError(f"Config '{config_name}' not found")

    selected_metrics = config['metrics']
    weights = config['weights']

    # Normalize weights if sum != 1 for selected metrics
    total_weight = sum(weights.get(m, 0) for m in selected_metrics)
    if total_weight == 0:
        total_weight = 1  # Avoid division by zero
    normalized_weights = {m: weights.get(m, 0) / total_weight for m in selected_metrics}

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
    base_score = sum(metric_scores.get(m, 0) * normalized_weights.get(m, 0) for m in selected_metrics) * 10  # Scale to 0-100

    # Step 4: Correlations & Flags (Boost/Penalty %)
    flags = []
    boost_penalty = 0.0

    logic = config['logic']
    for flag, data in logic.items():
        if not data.get('enabled', False):
            continue
        boost = data.get('boost', 0)
        condition_met = False
        if flag == "Undervalued":
            # Indicates undervalued companies with strong profitability/efficiency.
            condition_met = pe < 15 and roe > 15
        elif flag == "Strong Balance Sheet":
            # Indicates strong balance sheet with low leverage/liquidity buffer.
            condition_met = de < 1 and cash > 0.1 * mcap
        elif flag == "Quality Moat":
            # Indicates quality moat with sustainable profitability/cash generation.
            condition_met = gross > 40 and net > 15 and fcf_ev > 5
        elif flag == "GARP":
            # Indicates growth at reasonable price (GARP).
            condition_met = peg < 1 and 15 <= pe <= 25
        elif flag == "High-Risk Growth":
            # Indicates high-risk growth potential.
            condition_met = pe > 30 and peg < 0.8
        elif flag == "Value Trap":
            # Indicates potential value trap (cheap but poor returns).
            condition_met = pb < 1.5 and roe < 5
        elif flag == "Momentum Building":
            # Indicates positive momentum with operational strength.
            condition_met = price > 0.9 * high and ebitda_ev > 10
        elif flag == "Debt Burden":
            # Indicates debt burden with strained cash flow.
            condition_met = de > 2 and fcf_ev < 3

        if condition_met:
            flags.append(flag)
            boost_penalty += boost

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
    final_score = base_score * (1 + (boost_penalty / 100)) + factor_boost_total

    # Positives/Risks (dynamic based on flags, rounded to 2 decimals, bullet points with \n- )
    positives_parts = []
    if "Undervalued" in flags:
        positives_parts.append(f"Undervalued with low P/E of {round(pe, 2)} and high ROE of {round(roe, 2)}%")
    if "Strong Balance Sheet" in flags:
        positives_parts.append(f"Strong balance sheet with low D/E of {round(de, 2)} and cash reserves of {format_large(cash)}")
    if "Quality Moat" in flags:
        positives_parts.append(f"Quality moat with gross margin {round(gross, 2)}%, net margin {round(net, 2)}%, and FCF/EV {round(fcf_ev, 2)}%")
    if "GARP" in flags:
        positives_parts.append(f"GARP opportunity with PEG of {round(peg, 2)} and P/E of {round(pe, 2)}")
    if "Momentum Building" in flags:
        positives_parts.append(f"Building momentum with price near 52W high and EBITDA/EV of {round(ebitda_ev, 2)}%")
    positives = "\n- " + "\n- ".join(positives_parts) if positives_parts else "Solid fundamentals based on available metrics."
    risks = f"High D/E of {round(de, 2)} may strain balance sheet, with total debt of {format_large(debt)}." if de > 2 or debt > mcap else "Low risks based on available metrics."

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