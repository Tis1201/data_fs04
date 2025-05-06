#Create a simple program to test device registration
import requests
import json
import time

BASE_URL = "http://localhost:5173"
REGISTER_ENDPOINT = f"{BASE_URL}/api/device/register"

import os
from dotenv import load_dotenv
from sseclient import SSEClient
import random
import string
import requests

load_dotenv()

def generate_pin(length=6):
    """Generate a 6-digit PIN"""
    return ''.join(random.choices(string.digits, k=length))

def test_register():
    """Test device registration with PIN"""
    # Generate a 6-digit PIN
    pin = generate_pin()
    print(f"Generated PIN: {pin}")
    
    # Prepare headers with PIN
    headers = {
        'X-Device-PIN': pin,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
    }
    
    url = f"{REGISTER_ENDPOINT}?pin={pin}"  # Add pin as query parameter if needed
    
    print(f"Connecting to {url}")
    
    try:
        # Create a session to handle the request with custom headers
        session = requests.Session()
        session.headers.update(headers)
        
        # Make the initial request with the session
        response = session.get(url, stream=True)
        
        # Create SSE client with the response
        sse_client = SSEClient(response)
        print("SSE client created, waiting for events...")
        
        # Process SSE events
        try:
            for msg in sse_client.events():
                try:
                    print(f"\n--- New Event ---")
                    print(f"Event: {msg.event}")
                    
                    # Process the message data
                    if hasattr(msg, 'data') and msg.data:
                        try:
                            data = json.loads(msg.data)
                            print(f"Data: {json.dumps(data, indent=2)}")
                        except json.JSONDecodeError:
                            print(f"Data (raw): {msg.data}")
                    else:
                        print("No data in message")
                        
                    # Handle different event types
                    if msg.event == 'connected':
                        print("Successfully connected to SSE stream")
                    elif msg.event == 'error':
                        print(f"Error received: {msg.data}")
                    elif msg.event == 'registered':
                        print("Device registration successful!")
                        break  # Exit after successful registration
                    
                    # Add a small delay to prevent busy waiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    print(f"Error processing message: {str(e)}")
                    continue
                    
        except KeyboardInterrupt:
            print("\nSSE connection closed by user")
        except Exception as e:
            print(f"Error: {str(e)}")
            raise
                
    except KeyboardInterrupt:
        print("\nSSE connection closed by user")
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if 'session' in locals():
            session.close()
        print("Test completed")

if __name__ == "__main__":
    test_register()