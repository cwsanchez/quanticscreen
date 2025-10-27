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
    Use server-side tools to search and browse Yahoo Finance and Finviz for {ticker} metrics (latest available).
    Extract values from both sources, average where they differ (e.g., if P/E is 20 on Yahoo and 22 on Finviz, use 21).
    Metrics: P/E (trailing), ROE (%), D/E, P/B, PEG, Gross Margin (%), Net Profit Margin (%), FCF % EV TTM, EBITDA % EV TTM, Current Price, 52W High, 52W Low, Market Cap, EV, Total Cash, Total Debt.
    Use N/A if missing. Output STRICT JSON only: {{"P/E": value, "ROE": value, ...}}. No other text or explanations.
    """
    try:
        response = client.chat.completions.create(
            model="grok-4-fast",  # Agentic-optimized; fallback to "grok-beta" if inaccessible
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # Low for factual
            tools=[  # Correct format for built-in server-side tools
                {"type": "web_search"},
                {"type": "browse_page"}
            ],
            tool_choice="auto",  # Encourages autonomous use
            stream=True  # Recommended for agentic observability
        )
        # Collect streamed content and debug tool calls
        full_content = ""
        print("Streaming response chunks:")
        for chunk in response:
            delta = chunk.choices[0].delta
            if delta.content:
                full_content += delta.content
                print(delta.content, end="", flush=True)  # Stream to console for visibility
            if delta.tool_calls:
                print(f"\nTool call detected: {json.dumps(delta.tool_calls, indent=2)}")  # Debug tool invocations
        print("\nFull collected content:")
        print(full_content)
        # Parse JSON from collected content; strip non-JSON if needed
        try:
            metrics = json.loads(full_content)
        except json.JSONDecodeError:
            start = full_content.find('{')
            end = full_content.rfind('}') + 1
            if start != -1 and end != -1:
                metrics = json.loads(full_content[start:end])
            else:
                print(f"JSON parse error for {ticker}: {full_content}")
                return {}
        return metrics
    except Exception as e:
        print(f"Error for {ticker}: {e}")
        return {}

# Test
if __name__ == "__main__":
    print(json.dumps(fetch_metrics("UNH"), indent=2))