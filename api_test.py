import os
from dotenv import load_dotenv
import requests

# Load environment variables from .env file
load_dotenv()

# Get the API key
api_key = os.getenv('GROK_API_KEY')
if not api_key:
    print("Error: GROK_API_KEY not found in .env file.")
    exit(1)

# API endpoint
url = 'https://api.x.ai/v1/chat/completions'

# Headers
headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

# Simple request body (small test prompt)
data = {
    'model': 'grok-3-mini',  # Use this for a quick test; switch to 'grok-3' if needed
    'messages': [
        {'role': 'user', 'content': 'Hello, world! What is 2 + 2?'}
    ]
}

# Make the request
try:
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(response.json())
except Exception as e:
    print(f"Error during request: {e}")