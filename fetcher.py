# fetcher.py
import os
import json
from dotenv import load_dotenv
from openai import OpenAI  # OpenAI SDK for xAI compatibility

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

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.x.ai/v1"  # xAI endpoint
    )

    # Stricter prompt: Forces JSON output, multi-source
    prompt = f"""
    Use tools to search and browse Yahoo Finance and Finviz for {ticker} metrics (latest available).
    Extract and average values where they differ: P/E (trailing), ROE (%), D/E, P/B, PEG, Gross Margin (%), Net Profit Margin (%), FCF % EV TTM, EBITDA % EV TTM, Current Price, 52W High, 52W Low, Market Cap, EV, Total Cash, Total Debt.
    Use N/A if missing. Output STRICT JSON only: {{"P/E": value, "ROE": value, ...}}. No other text or explanations.
    """
    try:
        response = client.chat.completions.create(
            model="grok-4-fast",  # Agentic-optimized; fallback to "grok-beta" if inaccessible
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # Low for factual
            tools=[  # Server-side tool definitions
                {
                    "type": "function",
                    "function": {
                        "name": "web_search",
                        "description": "Perform a general web search for real-time info.",
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
                        "description": "Fetch and extract content from a specific webpage URL.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "url": {"type": "string", "description": "The URL to browse."},
                                "instructions": {"type": "string", "description": "What to extract/summarize (optional)."}
                            },
                            "required": ["url"]
                        }
                    }
                }
            ],
            stream=False  # Get full response; set True for progress if needed
        )
        print("Full API response:")
        print(json.dumps(response.model_dump(), indent=2))  # Debug: Check citations, tool usage
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