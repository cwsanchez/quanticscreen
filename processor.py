# processor.py
import pandas as pd

def score_metrics(metrics):
    # Step 2: Individual scoring
    pe_score = 10 if metrics.get('P/E', 0) < 15 else ...  # Implement your scales
    # etc.
    return pe_score + ...  # Sum

def apply_weights(scores):
    # Step 3: Weights dict from your prompt
    #weights = {'P/E': 0.2, ...}
    base_score = sum(scores[k] * weights[k] for k in weights)
    return base_score

# Correlations, factors similar