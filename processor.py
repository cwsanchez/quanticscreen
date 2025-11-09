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

def get_cap_category(market_cap):
    """
    Return cap category string based on market cap.
    """
    if market_cap == 'N/A':
        return 'Unknown'
    try:
        cap = float(market_cap)
        if cap > 200e9:
            return 'Mega Cap'
        elif cap >= 10e9:
            return 'Large Cap'
        elif cap >= 2e9:
            return 'Mid Cap'
        elif cap >= 300e6:
            return 'Small Cap'
        elif cap >= 50e6:
            return 'Micro Cap'
        else:
            return 'Nano Cap'
    except (ValueError, TypeError):
        return 'Unknown'

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

def get_flag_description(flag, metrics):
    """
    Returns a descriptive string for the given flag based on key metrics.
    Handles N/A gracefully by falling back to flag name if required metrics are missing.
    """
    descriptions = {
        'Undervalued': lambda m: f"Undervalued with P/E {round(get_float(m, 'P/E'), 2)} and ROE {round(get_float(m, 'ROE'), 2)}%" if m.get('P/E', 'N/A') != 'N/A' and m.get('ROE', 'N/A') != 'N/A' else 'Undervalued',
        'Strong Balance Sheet': lambda m: f"Strong balance sheet with D/E {round(get_float(m, 'D/E'), 2)} and cash exceeding debt" if m.get('D/E', 'N/A') != 'N/A' and m.get('Total Cash', 'N/A') != 'N/A' and m.get('Total Debt', 'N/A') != 'N/A' else 'Strong Balance Sheet',
        'Quality Moat': lambda m: f"Quality moat with margins {round(get_float(m, 'Gross Margin'), 2)}%/{round(get_float(m, 'Net Profit Margin'), 2)}% and FCF/EV {round(get_float(m, 'FCF % EV TTM'), 2)}%" if all(m.get(k, 'N/A') != 'N/A' for k in ['Gross Margin', 'Net Profit Margin', 'FCF % EV TTM']) else 'Quality Moat',
        'GARP': lambda m: f"GARP with PEG {round(get_float(m, 'PEG'), 2)} and P/E {round(get_float(m, 'P/E'), 2)}" if m.get('PEG', 'N/A') != 'N/A' and m.get('P/E', 'N/A') != 'N/A' else 'GARP',
        'High-Risk Growth': lambda m: f"High-risk growth with P/E {round(get_float(m, 'P/E'), 2)} and PEG {round(get_float(m, 'PEG'), 2)}" if m.get('P/E', 'N/A') != 'N/A' and m.get('PEG', 'N/A') != 'N/A' else 'High-Risk Growth',
        'Value Trap': lambda m: f"Value trap with P/B {round(get_float(m, 'P/B'), 2)} and ROE {round(get_float(m, 'ROE'), 2)}%" if m.get('P/B', 'N/A') != 'N/A' and m.get('ROE', 'N/A') != 'N/A' else 'Value Trap',
        'Momentum Building': lambda m: f"Momentum building near 52W high with EBITDA/EV {round(get_float(m, 'EBITDA % EV TTM'), 2)}%" if m.get('Current Price', 'N/A') != 'N/A' and m.get('52W High', 'N/A') != 'N/A' and m.get('EBITDA % EV TTM', 'N/A') != 'N/A' else 'Momentum Building',
        'Debt Burden': lambda m: f"Debt burden with D/E {round(get_float(m, 'D/E'), 2)} and FCF/EV {round(get_float(m, 'FCF % EV TTM'), 2)}%" if m.get('D/E', 'N/A') != 'N/A' and m.get('FCF % EV TTM', 'N/A') != 'N/A' else 'Debt Burden'
    }
    return descriptions.get(flag, lambda m: flag)(metrics)

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

PRESETS = {
    'Overall': DEFAULT_LOGIC,
    'Value': {
        'Undervalued': {'enabled': True, 'boost': 20},
        'Strong Balance Sheet': {'enabled': True, 'boost': 15},
        'Quality Moat': {'enabled': True, 'boost': 10},
        'GARP': {'enabled': True, 'boost': 5},
        'High-Risk Growth': {'enabled': True, 'boost': -5},
        'Value Trap': {'enabled': True, 'boost': -5},
        'Momentum Building': {'enabled': True, 'boost': 0},
        'Debt Burden': {'enabled': True, 'boost': -20}
    },
    'Growth': {
        'Undervalued': {'enabled': True, 'boost': 5},
        'Strong Balance Sheet': {'enabled': True, 'boost': 5},
        'Quality Moat': {'enabled': True, 'boost': 5},
        'GARP': {'enabled': True, 'boost': 20},
        'High-Risk Growth': {'enabled': True, 'boost': 10},
        'Value Trap': {'enabled': True, 'boost': -15},
        'Momentum Building': {'enabled': True, 'boost': 10},
        'Debt Burden': {'enabled': True, 'boost': -10}
    },
    'Momentum': {
        'Undervalued': {'enabled': True, 'boost': 5},
        'Strong Balance Sheet': {'enabled': True, 'boost': 5},
        'Quality Moat': {'enabled': True, 'boost': 5},
        'GARP': {'enabled': True, 'boost': 5},
        'High-Risk Growth': {'enabled': True, 'boost': 5},
        'Value Trap': {'enabled': True, 'boost': -15},
        'Momentum Building': {'enabled': True, 'boost': 20},
        'Debt Burden': {'enabled': True, 'boost': -10}
    },
    'Quality': {
        'Undervalued': {'enabled': True, 'boost': 10},
        'Strong Balance Sheet': {'enabled': True, 'boost': 20},
        'Quality Moat': {'enabled': True, 'boost': 20},
        'GARP': {'enabled': True, 'boost': 5},
        'High-Risk Growth': {'enabled': True, 'boost': -15},
        'Value Trap': {'enabled': True, 'boost': -15},
        'Momentum Building': {'enabled': True, 'boost': 5},
        'Debt Burden': {'enabled': True, 'boost': -20}
    }
}

def process_stock(metrics, weights=None, selected_metrics=None, logic=DEFAULT_LOGIC):
    """
    Processes a single stock's metrics per algorithm steps 2-5.
    Returns dict with: base_score, final_score, flags (list), positives (str), risks (str), factor_boosts (dict for value/momentum/etc.).
    Handles N/A as 0 for scoring.
    Overall flow: Score individual metrics (0-10), weight to base (0-100), apply multi-metric correlations for boosts/penalties/flags, add factor lens boosts.
    """
    # Use the top-level get_float
    pe = get_float(metrics, 'P/E')
    forward_pe = get_float(metrics, 'Forward P/E')
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
    p_fcf = get_float(metrics, 'P/FCF')
    revenue_growth = get_float(metrics, 'Revenue Growth')
    earnings_growth = get_float(metrics, 'Earnings Growth')
    rsi = get_float(metrics, 'RSI')
    beta = get_float(metrics, 'Beta')
    dividend = get_float(metrics, 'Dividend Yield')
    avg_volume = get_float(metrics, 'Average Volume')

    if weights is None:
        weights = {'P/E': 0.2, 'ROE': 0.2, 'P/B': 0.1, 'PEG': 0.15, 'Gross Margin': 0.1, 'Net Profit Margin': 0.1, 'FCF % EV TTM': 0.1, 'EBITDA % EV TTM': 0.05}
    if selected_metrics is None:
        selected_metrics = list(weights.keys())
    metric_normalizers = {
        'P/E': lambda v: max(0, min(100, 100 - (v * 2))),  # Low better, good <50
        'ROE': lambda v: max(0, min(100, v * 4)),  # High better, good >25
        'D/E': lambda v: max(0, min(100, 100 - (v * 50))),  # Low better, good <2
        'P/B': lambda v: max(0, min(100, 100 - (v * 20))),  # Low better, good <5
        'PEG': lambda v: max(0, min(100, 100 - (v * 50))),  # Low better, good <2
        'Gross Margin': lambda v: max(0, min(100, v)),  # High better, %
        'Net Profit Margin': lambda v: max(0, min(100, v)),  # High better, %
        'FCF % EV TTM': lambda v: max(0, min(100, v * 10)),  # High better, good >10%
        'EBITDA % EV TTM': lambda v: max(0, min(100, v * 10)),  # High better
    }

    norm_scores = {metric: metric_normalizers.get(metric, lambda v: 0)(get_float(metrics, metric)) for metric in selected_metrics}
    base_score = sum(norm_scores[metric] * weights[metric] for metric in selected_metrics) / sum(weights.values()) if sum(weights.values()) > 0 else 0

    # Step 4: Correlations & Flags (Boost/Penalty %)
    flags = []
    boost_total = 0
    positives = []
    risks = ""
    for flag in logic:
        if logic[flag]['enabled'] and flag in CONDITIONS and CONDITIONS[flag](metrics):
            flags.append(flag)
            boost = logic[flag]['boost']
            boost_total += boost
            desc = get_flag_description(flag, metrics)
            positives.append(desc)
            if boost < 0:
                risks += f'{flag} ({boost}%) '

    # Step 5: Factor Lens (Extra Boosts, sub-rankings in main.py)
    factor_boosts = {
        # Value: Low P/FCF boosts value
        'value': 20 if p_fcf < 15 or (pb < 1.5 and roe > 15) else 10 if p_fcf < 20 else 0,
        # Momentum: Price near 52W high, RSI in range, high volume, ROE >15
        'momentum': 20 if price > 0.9 * high and 50 < rsi < 70 and avg_volume > 1000000 and roe > 15 else 10 if price > 0.8 * high else 0,
        # Quality: High ROE, low D/E, high margins, dividend >2%, low beta
        'quality': 20 if roe > 20 and de < 1 and gross > 40 and dividend > 2 and beta < 1 else 10 if roe > 15 and de < 1.5 else 0,
        # Growth: Low PEG, high revenue/earnings growth, reasonable forward PE, low D/E
        'growth': 20 if peg < 1.5 and revenue_growth > 10 and earnings_growth > 10 and forward_pe < 25 and de < 1 else 10 if peg < 2 else 0
    }
    factor_boost_total = sum(factor_boosts.values())

    # Final Score
    final_score = base_score + (base_score * (boost_total / 100)) + factor_boost_total

    # If positives or risks are empty, use defaults
    if not positives:
        positives = ["Solid fundamentals based on available metrics."]
    if not risks:
        risks = "Low risks based on available metrics."

    return {
        'base_score': base_score,
        'final_score': final_score,
        'flags': flags,
        'positives': positives,
        'risks': risks,
        'factor_boosts': factor_boosts,  # For sub-rankings
        'metrics': metrics,  # Original for details
        'cap_category': get_cap_category(metrics.get('Market Cap', 'N/A'))
    }

# Test
if __name__ == "__main__":
    dummy_metrics = {'P/E': 15.3, 'ROE': 21.7, 'D/E': 0.75, 'P/B': 3.5, 'PEG': 1.2, 'Gross Margin': 25, 'Net Profit Margin': 6, 'FCF % EV TTM': 4, 'EBITDA % EV TTM': 7, 'Total Cash': 10000000000, 'Market Cap': 300000000000, 'Current Price': 500, '52W High': 600, '52W Low': 400, 'Total Debt': 50000000000, 'FCF Actual': 10000000000}
    print(process_stock(dummy_metrics))