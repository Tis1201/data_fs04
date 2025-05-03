#Create a simple program to test device registration
import requests

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
        'X-Device-PIN': pin
    }
    
    try:
        # Establish SSE connection
        url = REGISTER_ENDPOINT
        # Create a request session with headers
        session = requests.Session()
        session.headers.update(headers)
        
        # Get the response with the session
        response = session.get(url, stream=True)
        
        if response.status_code != 200:
            raise Exception(f"Failed to connect: {response.status_code}")
        
        print("SSE connection established")
        
        # Create SSE client from the response
        sse_client = SSEClient(response)
        
        # Process SSE events
        for msg in sse_client:
            try:
                print(f"Received event: {msg.event}")
                print(f"Received data: {msg.data}")
                
                # Handle different event types
                if msg.event == 'connected':
                    print("Successfully connected to SSE stream")
                
                if msg.event == 'error':
                    raise Exception(f"Received error: {msg.data}")
                
                # Add any specific event handling logic here
                if msg.data:
                    try:
                        import json
                        parsed_data = json.loads(msg.data)
                        print(f"Parsed data: {parsed_data}")
                    except json.JSONDecodeError:
                        print("Received data is not JSON")
                
            except Exception as e:
                print(f"Error processing message: {str(e)}")
                raise
            
    except Exception as e:
        print(f"Error: {str(e)}")
        raise
    finally:
        # Close the connection
        if 'sse_client' in locals():
            sse_client.close()
            print("Connection closed")
        if 'session' in locals():
            session.close()

if __name__ == "__main__":
    test_register()