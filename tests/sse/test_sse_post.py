import os
from dotenv import load_dotenv
import requests

load_dotenv()

def main():
    api_key = os.getenv('API_KEY')
    if not api_key:
        raise ValueError('API_KEY not found in .env file')
    
    # Event and data to broadcast
    event = input("Enter event name: ")
    if not event:
        print("Event name is required")
        return
    
    data = input("Enter data (optional, leave blank for empty data): ")
    if data:
        try:
            # Try to parse data as JSON if it's not empty
            data = eval(data)
        except:
            print("Invalid data format. Using as string.")
    else:
        data = {}
    
    # Prepare the request
    url = "http://localhost:5173/api/sse"
    headers = {
        'X-API-Key': api_key,
        'Content-Type': 'application/json'
    }
    payload = {
        'event': event,
        'data': data
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        print("Message broadcasted successfully!")
        print("Server response:", response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error broadcasting message: {str(e)}")
        if hasattr(e.response, 'json'):
            try:
                error_details = e.response.json()
                print("Error details:", error_details)
            except:
                pass

if __name__ == "__main__":
    main()