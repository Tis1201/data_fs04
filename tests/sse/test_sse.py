import os
from dotenv import load_dotenv
from sseclient import SSEClient

load_dotenv()

def main():
    api_key = os.getenv('API_KEY')
    if not api_key:
        raise ValueError('API_KEY not found in .env file')
    
    # Use the simpler X-API-Key header
    headers = {
        'X-API-Key': api_key
    }
    
    url = "http://localhost:5173/api/sse"
    sse_client = SSEClient(url, headers=headers)
    
    print("Connecting to SSE stream...")
    try:
        for msg in sse_client:
            try:
                # Parse the message data as JSON
                data = msg.data
                print(f"Received message: {data}")
                
                # Handle different event types
                if msg.event == 'connected':
                    print("Successfully connected to SSE stream")
                # Add more event handlers as needed
                
            except Exception as e:
                print(f"Error processing message: {str(e)}")
                continue
    except KeyboardInterrupt:
        print("\nSSE connection closed by user")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()