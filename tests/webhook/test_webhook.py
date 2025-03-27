import requests
import json
import time
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Get API key from environment
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    raise ValueError("API_KEY not found in environment variables")

BASE_URL = "http://localhost:5173/api/webhook"

# Test different types of requests
def test_webhook():
    # Test with JSON body
    print("\nTesting JSON POST request...")
    json_data = {
        "event": "test_event",
        "timestamp": int(time.time()),
        "data": {
            "message": "Hello, webhook!",
            "number": 42
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/test-endpoint",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json=json_data
    )
    
    print(f"Response status code: {response.status_code}")
    print(f"Response body: {response.text}")

    # Test with query parameters
    print("\nTesting with query parameters...")
    response = requests.post(
        f"{BASE_URL}/test-endpoint?param1=value1&param2=value2",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json=json_data
    )
    
    print(f"Response status code: {response.status_code}")
    print(f"Response body: {response.text}")

    # Test with different path segments
    print("\nTesting with multiple path segments...")
    response = requests.post(
        f"{BASE_URL}/level1/level2/level3",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json=json_data
    )
    
    print(f"Response status code: {response.status_code}")
    print(f"Response body: {response.text}")

if __name__ == "__main__":
    test_webhook()
