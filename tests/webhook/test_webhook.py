import requests
import json
import time
import argparse
from datetime import datetime

# Base URL for the webhook API
BASE_URL = "http://localhost:5173/api/webhook"

def create_test_payload():
    """Create a test payload with current timestamp"""
    return {
        "event": "test_event",
        "timestamp": int(time.time()),
        "data": {
            "message": "Hello, webhook!",
            "number": 42,
            "testTime": datetime.now().isoformat()
        }
    }

def test_valid_webhook(postfix):
    """Test a valid webhook with the provided postfix"""
    print(f"\n🔍 Testing valid webhook with postfix: {postfix}")
    json_data = create_test_payload()
    
    # Test with JSON body
    response = requests.post(
        f"{BASE_URL}/{postfix}",
        headers={"Content-Type": "application/json"},
        json=json_data
    )
    
    print(f"📊 Response status code: {response.status_code}")
    print(f"📝 Response body: {response.text}")
    
    # Test with query parameters
    print("\n🔍 Testing with query parameters...")
    response = requests.post(
        f"{BASE_URL}/{postfix}?source=test&type=automated",
        headers={"Content-Type": "application/json"},
        json=json_data
    )
    
    print(f"📊 Response status code: {response.status_code}")
    print(f"📝 Response body: {response.text}")
    
    return response.status_code == 200

def test_invalid_webhook():
    """Test an invalid webhook postfix"""
    print("\n🔍 Testing invalid webhook postfix...")
    json_data = create_test_payload()
    
    response = requests.post(
        f"{BASE_URL}/invalid-postfix-that-doesnt-exist",
        headers={"Content-Type": "application/json"},
        json=json_data
    )
    
    print(f"📊 Response status code: {response.status_code}")
    print(f"📝 Response body: {response.text}")
    
    return response.status_code == 404

def test_different_methods(postfix):
    """Test different HTTP methods on a valid webhook"""
    print("\n🔍 Testing different HTTP methods...")
    json_data = create_test_payload()
    
    # Test GET method (should not be supported)
    response = requests.get(f"{BASE_URL}/{postfix}")
    print(f"GET - Status code: {response.status_code}")
    
    # Test PUT method
    response = requests.put(
        f"{BASE_URL}/{postfix}",
        headers={"Content-Type": "application/json"},
        json=json_data
    )
    print(f"PUT - Status code: {response.status_code}")

def run_tests():
    """Run all webhook tests"""
    parser = argparse.ArgumentParser(description='Test webhook endpoints')
    parser.add_argument('--postfix', type=str, help='The webhook postfix to test')
    args = parser.parse_args()
    
    if not args.postfix:
        print("⚠️  Please provide a webhook postfix using --postfix argument")
        print("Example: python test_webhook.py --postfix abc123-xyz789")
        return
    
    print("\n🚀 Starting webhook tests...")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"🔑 Testing with postfix: {args.postfix}")
    
    # Run tests
    valid_test = test_valid_webhook(args.postfix)
    invalid_test = test_invalid_webhook()
    test_different_methods(args.postfix)
    
    # Print summary
    print("\n📋 Test Summary:")
    print(f"✅ Valid webhook test: {'PASSED' if valid_test else 'FAILED'}")
    print(f"✅ Invalid webhook test: {'PASSED' if invalid_test else 'FAILED'}")
    print("\n🏁 Tests completed!")

if __name__ == "__main__":
    run_tests()
