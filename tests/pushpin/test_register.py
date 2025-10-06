import random
import json
import requests
import time

FACTORY_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImJlYzIyYmUxLTQ1ZjgtNGQwYS1iOGM5LTFlNWQzNDI5NmNkZCJ9.eyJhdWQiOiJkZXZpY2UtcmVnaXN0ZXIiLCJ0eXAiOiJmYWN0b3J5IiwiaWF0IjoxNzU5NDYzMTE1LCJleHAiOjE3NjIwNDE2MDAsImp0aSI6IjJkNWFkNjBjLTkzNDUtNGFiMi1iODE5LTE0NzBlNmEzNzg2OSIsInNjb3BlIjoiZGV2aWNlOnJlZ2lzdGVyIiwic3ViIjoiNTA1MDU3Y2EtOGM3Yi00NzQ2LTlkNTYtM2ZjNzdlOTFhMmUyIiwiaGFyZHdhcmVNb2RlbCI6InJhZHhhIiwiZmlybXdhcmVWZXJzaW9uIjoiMDAwMDEifQ.CC9jNNX_kQZUuAA0Qt-U9cgx2xq7iUYQK3uvnGgGwut5nWKaIms2kPYAM00KWx_R9AjHCp_Sa_tk-KB3N_jG7aw3lgNp_bz8MfBbdgTLsoow7QT3w1DWcsStQlWjYae03q9rhrsKlkVZ0ODZKYyUVRZELERJbVTcspUl-_N8lyw0EdywrTw2SSkWl8EirsjCJDtYUlV8dE7WydtAenXl-O2DWSN3t7ffqStVltsdhNsg-UvrWpyCl1Feip8-DPF3AOvNfnUnIYEhpqi-U4rUTfMn1rNIHChkhh-YC0JzymCYgel0-xlq7rtGhWW1scDQ54L4avcrzk7Cd_uA3iOyPg"
SSE_URL = "https://pushpin-dev.datarealities.com/api/device/pushpin/register"
SSE_URL = "http://localhost:7999/api/device/pushpin/register"

def generate_pin() -> str:
    """Generate a random 6-digit PIN."""
    return str(random.randint(100000, 999999))

def test_register():
    pin = generate_pin()
    device_id = "a8266803-e292-40aa-899f-1d5a30841dfd"
    print(f"Using PIN: {pin}, Device ID: {device_id}")
    
    headers = {
        "Authorization": f"Bearer {FACTORY_TOKEN}",
        "X-Device-PIN": pin,
        "X-Device-MAC": f"00:11:22:33:44:{random.randint(10, 99)}",
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache"
    }
    
    try:
        print(f"Connecting to {SSE_URL}...")
        response = requests.get(SSE_URL, headers=headers, stream=True, timeout=None)
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {response.headers}")
        print("\nReading raw stream line by line...")
        print("=" * 60)
        
        line_count = 0
        last_activity = time.time()
        
        # Read raw lines from the stream
        for line in response.iter_lines(decode_unicode=True):
            line_count += 1
            now = time.time()
            
            # Print every line we receive
            if line is not None:
                # Show timestamp and line number
                elapsed = now - last_activity
                print(f"[{line_count:04d}] [{elapsed:.2f}s] {repr(line)}")
                last_activity = now
                
                # Try to parse if it looks like JSON
                if line.strip() and not line.startswith(':'):
                    try:
                        data = json.loads(line)
                        print(f"  → JSON: {json.dumps(data, indent=4)}")
                    except json.JSONDecodeError:
                        pass
            
            # Periodic keepalive message
            if now - last_activity > 30:
                print(f"[{line_count:04d}] [IDLE] No data for 30s, still connected...")
                last_activity = now
                
    except KeyboardInterrupt:
        print("\n\nConnection closed by user")
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nTest completed")

if __name__ == "__main__":
    test_register()