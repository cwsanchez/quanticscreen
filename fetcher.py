# fetcher.py
import os
import json
from dotenv import load_dotenv
from xai_sdk import Client  # Official SDK for agentic support

load_dotenv()  # Loads GROK_API_KEY from .env

def fetch_metrics(ticker):
    """
    Fetches stock metrics for a single ticker using Grok API with server-side agentic tools.
    Prompt targets multi-source averaging to reduce hallucinations.
    Returns dict or empty on error.
    """
    api_key = os.getenv('GROK_API_KEY')
    if not api_key:
        print("Error: GROK_API_KEY not set in .env")
        return {}

    client = Client(api_key=api_key)

    # Stricter prompt: Forces JSON output, multi-source
    prompt = f"""
    Use tools to search and browse Yahoo Finance and Finviz for {ticker} metrics (latest available).
    Extract and average values where they differ: P/E (trailing), ROE (%), D/E, P/B, PEG, Gross Margin (%), Net Profit Margin (%), FCF % EV TTM, EBITDA % EV TTM, Current Price, 52W High, 52W Low, Market Cap, EV, Total Cash, Total Debt.
    Use N/A if missing. Output STRICT JSON only: {{"P/E": value, "ROE": value, ...}}. No other text or explanations.
    """
    try:
        response = client.chat.completions.create(
            model="grok-4-fast",  # Recommended for agentic; fallback to "grok-3" if inaccessible
            messages=[{"role": "user", "content": prompt}],
            tools=["web_search"],  # Enables server-side web search + browsing
            tool_params={
                "web_search": {
                    "allowed_domains": ["finance.yahoo.com", "finviz.com"]  # Restrict to sources for efficiency/accuracy
                }
            },
            temperature=0.2  # Low for factual
        )
        print("Full API response:")
        print(json.dumps(response.model_dump(), indent=2))  # Debug: See citations, tool usage, etc.
        content = response.choices[0].message.content
        # Parse JSON; strip non-JSON if needed
        try:
            metrics = json.loads(content)
        except json.JSONDecodeError:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end != -1:
                metrics = json.loads(content[start:end])
            else:
                print(f"JSON parse error for {ticker}: {content}")
                return {}
        return metrics
    except Exception as e:
        print(f"Error for {ticker}: {e}")
        return {}

# Test
if __name__ == "__main__":
    print(json.dumps(fetch_metrics("UNH"), indent=2))