# processor.py

def process_stock(metrics):
    """
    Dummy processor: Scores a single stock's metrics (Steps 2-3).
    Returns dict with base_score (expand to flags/correlations later).
    """
    # Step 2: Scoring (from your scales)
    pe = metrics.get('P/E', 0)
    pe_score = 10 if pe < 15 else 7 if pe < 20 else 5 if pe < 30 else 2 if pe < 40 else 0

    roe = metrics.get('ROE', 0)
    roe_score = 10 if roe > 15 else 7 if roe > 10 else 5 if roe > 5 else 0

    # Add others similarly... (D/E, P/B, etc.)

    # Step 3: Weights (partial for dummy)
    weights = {'P/E': 0.2, 'ROE': 0.15}  # Add full later
    base_score = (pe_score * weights['P/E']) + (roe_score * weights['ROE'])  # Scale to 0-100 later

    return {'base_score': base_score, 'metrics': metrics}  # Expand to full output

# Test
if __name__ == "__main__":
    dummy_metrics = {'P/E': 15.3, 'ROE': 21.7}  # From sim
    print(process_stock(dummy_metrics))