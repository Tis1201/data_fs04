# Create a simple program to test device registration and WebRTC console input
import requests
import json
import time
import os
import sys
import asyncio
import threading
import uuid
from datetime import datetime
from dotenv import load_dotenv
from sseclient import SSEClient
import random
import string
import select

BASE_URL = "http://localhost:5173"
REGISTER_ENDPOINT = f"{BASE_URL}/api/device/register"

load_dotenv()

# Global variables for WebRTC communication
webrtc_client = None
device_id = None
running = True

def generate_pin(length=6):
    """Generate a 6-digit PIN"""
    return ''.join(random.choices(string.digits, k=length))

def console_input_thread():
    """Thread function to read console input and send via WebRTC"""
    global running, webrtc_client
    
    print("\nConsole input thread started. Type messages to send over WebRTC.")
    print("Type 'exit' to quit.")
    
    # Wait for WebRTC client to be initialized
    while running and (webrtc_client is None):
        time.sleep(0.5)
        print("Waiting for WebRTC client to be initialized...")
    
    print("WebRTC client ready. You can now type messages to send.")
    
    while running:
        try:
            # Use a direct input approach instead of select
            # This is more reliable for console input
            user_input = input("Enter message to send (or 'exit' to quit): ")
            
            if not user_input:
                continue
                
            if user_input.lower() == 'exit':
                print("Exiting console input thread...")
                running = False
                break
            
            # Send the message if WebRTC client is available
            if webrtc_client and hasattr(webrtc_client, 'send_data'):
                # Create a simple text message
                message = user_input
                
                # Use asyncio to run the coroutine in the thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                # Send the raw text message
                success = loop.run_until_complete(webrtc_client.send_data(message))
                loop.close()
                
                if success:
                    print(f"✓ Message sent: {user_input}")
                else:
                    print(f"✗ Failed to send message: {user_input}")
            else:
                print("WebRTC client not initialized or connected yet. Message not sent.")
                
        except Exception as e:
            print(f"Error in console input thread: {str(e)}")
            time.sleep(1)  # Wait before retrying

def test_register():
    """Test device registration with PIN"""
    global webrtc_client, device_id, running
    
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
    
    # Start the console input thread
    input_thread = threading.Thread(target=console_input_thread, daemon=True)
    input_thread.start()
    
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
                            
                            # Extract device ID if available
                            if msg.event == 'registered' and 'id' in data:
                                device_id = data['id']
                                print(f"Device ID: {device_id}")
                                
                                # Import and initialize WebRTC client
                                from dummy_device import DummyDevice
                                dummy_device = DummyDevice(device_id)
                                webrtc_client = dummy_device.webrtc_client
                                print("WebRTC client initialized. You can now type messages to send.")
                                
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
                        print("Continuing to listen for WebRTC messages...")
                    elif msg.event == 'message':
                        # Process WebRTC messages
                        if 'payload' in data and 'type' in data['payload']:
                            msg_type = data['payload']['type']
                            if msg_type.startswith('webrtc:'):
                                print(f"Received WebRTC message: {msg_type}")
                                
                                # Handle WebRTC messages with the dummy device
                                if webrtc_client and hasattr(dummy_device, 'handle_message'):
                                    loop = asyncio.new_event_loop()
                                    asyncio.set_event_loop(loop)
                                    loop.run_until_complete(dummy_device.handle_message(data))
                                    loop.close()
                    
                    # Add a small delay to prevent busy waiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    print(f"Error processing message: {str(e)}")
                    continue
                    
        except KeyboardInterrupt:
            print("\nSSE connection closed by user")
            running = False
        except Exception as e:
            print(f"Error: {str(e)}")
            running = False
            raise
                
    except KeyboardInterrupt:
        print("\nSSE connection closed by user")
        running = False
    except Exception as e:
        print(f"Error: {str(e)}")
        running = False
    finally:
        if 'session' in locals():
            session.close()
        running = False
        print("Test completed")

if __name__ == "__main__":
    try:
        test_register()
    except KeyboardInterrupt:
        print("\nProgram terminated by user")
        running = False
    finally:
        # Ensure we exit cleanly
        running = False
        print("Exiting program")
        sys.exit(0)