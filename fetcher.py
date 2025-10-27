# fetcher.py
import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()  # Loads GROK_API_KEY from .env

def fetch_metrics(ticker):
    """
    Fetches stock metrics for a single ticker using Grok API.
    Prompt targets multi-source averaging to reduce hallucinations.
    Returns dict or empty on error.
    """
    api_key = os.getenv('GROK_API_KEY')
    if not api_key:
        print("Error: GROK_API_KEY not set in .env")
        return {}

    url = "https://api.x.ai/v1/chat/completions"  # xAI endpoint
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    # Targeted prompt: Mimics algorithm Step 1, outputs JSON
    prompt = f"""
    Browse 2+ sources like Yahoo Finance and Finviz for {ticker} metrics as of October 26, 2025.
    Extract and average: P/E (trailing), ROE%, D/E, P/B, PEG, Gross Margin%, Net Profit Margin%, FCF % EV TTM, EBITDA % EV TTM, Current Price (52W High/Low), Market Cap, EV, Total Cash, Total Debt.
    Use N/A if missing. Output ONLY as JSON dict with keys like 'P/E', 'ROE', etc. No other text.
    """
    payload = {
        "model": "grok-beta",  # Or latest model from docs
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2  # Low for factual accuracy
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()  # Raise on 4xx/5xx
        content = response.json()['choices'][0]['message']['content']
        # Parse JSON (assume API returns it clean)
        metrics = json.loads(content)
        return metrics
    except requests.exceptions.RequestException as e:
        print(f"API error for {ticker}: {e}")
        return {}
    except json.JSONDecodeError:
        print(f"JSON parse error for {ticker}: {content}")
        return {}

# Dummy test (use sim data if API not ready)
if __name__ == "__main__":
    # Mock return for offline (from your UNH sim in stock-screen-3-2)
    dummy_metrics = {
        'P/E': 15.68,
        'ROE': 21.65,
        'D/E': 0.76,
        'P/B': 4.56,
        'PEG': 'N/A',
        'Gross Margin': 20.84,
        'Net Profit Margin': 'N/A',  # Add from sims as needed
        'FCF % EV': 14.99,
        'EBITDA % EV': 'N/A',
        'Current Price': 'N/A',  # Placeholder; expand later
        '52W High': 'N/A',
        '52W Low': 'N/A',
        'Market Cap': 'N/A',
        'EV': 'N/A',
        'Total Cash': 'N/A',
        'Total Debt': 'N/A'
    }
    print(json.dumps(dummy_metrics, indent=2))  # Run to test
    # Uncomment for real: print(fetch_metrics("UNH"))