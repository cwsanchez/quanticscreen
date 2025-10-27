# fetcher.py
import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()  # Loads GROK_API_KEY from .env

def fetch_metrics(ticker):
    """
    Fetches stock metrics for a single ticker using Grok API with agentic tools enabled.
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
    # Stricter prompt: Forces JSON output, multi-source
    prompt = f"""
    Browse Yahoo Finance and Finviz for {ticker} metrics (latest available).
    Extract and average: P/E (trailing), ROE (%), D/E, P/B, PEG, Gross Margin (%), Net Profit Margin (%), FCF % EV TTM, EBITDA % EV TTM, Current Price, 52W High, 52W Low, Market Cap, EV, Total Cash, Total Debt.
    Use N/A if missing. Output STRICT JSON only: {{"P/E": value, "ROE": value, ...}}. No other text or explanations.
    """
    payload = {
        "model": "grok-4-fast",  # Supports agentic tools; fallback to "grok-4" if needed
        "tools": ["browse_page", "web_search"],  # Enable browsing specific sites and general search
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2  # Low for factual
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        # Attempt to parse JSON; strip any leading/trailing non-JSON (e.g., if model adds intro)
        try:
            metrics = json.loads(content)
        except json.JSONDecodeError:
            # Find the first { and last } to extract potential JSON block
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end != -1:
                metrics = json.loads(content[start:end])
            else:
                raise
        return metrics
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error for {ticker}: {e} - Response: {e.response.text if e.response else 'No response'}")
        return {}
    except json.JSONDecodeError:
        print(f"JSON parse error for {ticker}: {content}")
        return {}
    except Exception as e:
        print(f"Unexpected error for {ticker}: {e}")
        return {}

# Test
if __name__ == "__main__":
    print(json.dumps(fetch_metrics("UNH"), indent=2))