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
    # Updated prompt: Encourage tool use, clarify extraction/averaging
    prompt = f"""
    Use available tools to browse Yahoo Finance and Finviz (or equivalent sources) for the latest metrics on {ticker}.
    Extract values from multiple sources if possible, average them where they differ (e.g., if P/E is 20 on one site and 22 on another, use 21).
    Metrics: P/E (trailing), ROE (%), D/E, P/B, PEG, Gross Margin (%), Net Profit Margin (%), FCF % EV TTM, EBITDA % EV TTM, Current Price, 52W High, 52W Low, Market Cap, EV, Total Cash, Total Debt.
    Use N/A if missing or unavailable. Output STRICT JSON only: {{"P/E": value, "ROE": value, ...}}. No other text.
    """
    payload = {
        "model": "grok-4-fast",  # Try this first; if issues, switch to "grok-3" below
        # "model": "grok-3",  # Fallback if grok-4-fast inaccessible (limited agentic support)
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,  # Low for factual
        "tools": [  # Server-side tool definitions
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": "Perform a general web search.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The search query."},
                            "num_results": {"type": "integer", "description": "Number of results (default 10, max 30)."}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "browse_page",
                    "description": "Fetch and summarize content from a specific webpage URL.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {"type": "string", "description": "The URL of the webpage to browse."},
                            "instructions": {"type": "string", "description": "Instructions for what to extract or summarize from the page."}
                        },
                        "required": ["url"]  # Made instructions optional to match examples/avoid issues
                    }
                }
            }
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        full_response = response.json()
        print("Full API response:")
        print(json.dumps(full_response, indent=2))  # Debug: See full details, including tool usage
        content = full_response['choices'][0]['message']['content']
        # Parse JSON; strip non-JSON
        try:
            metrics = json.loads(content)
        except json.JSONDecodeError:
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