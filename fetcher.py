# fetcher.py
import requests
import os
from dotenv import load_dotenv

load_dotenv()  # Load API key from .env: GROK_API_KEY=your_key

def fetch_metrics(ticker):
    # Mock API call to Grok for now (replace with real)
    # Real: Use prompt like our algorithm's Step 1, but targeted
    url = "https://api.x.ai/v1/chat/completions"  # Grok API endpoint
    headers = {"Authorization": f"Bearer {os.getenv('GROK_API_KEY')}"}
    prompt = f"Fetch and average P/E, ROE%, D/E, P/B, PEG, Gross%, FCF % EV, from Yahoo and Finviz for {ticker} as of {os.date.today()}. Output as JSON."
    data = {"model": "grok-beta", "messages": [{"role": "user", "content": prompt}]}
    response = requests.post(url, headers=headers, json=data)
    if response.ok:
        metrics = response.json()['choices'][0]['message']['content']  # Parse JSON
        return metrics  # Dict like {'P/E': 15.3, ...}
    else:
        return {}  # Error handling

# Dummy test
if __name__ == "__main__":
    print(fetch_metrics("UNH"))  # Use sim data as dummy return for now