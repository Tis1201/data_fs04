import random
import requests
import json

FACTORY_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImJlYzIyYmUxLTQ1ZjgtNGQwYS1iOGM5LTFlNWQzNDI5NmNkZCJ9.eyJhdWQiOiJkZXZpY2UtcmVnaXN0ZXIiLCJ0eXAiOiJmYWN0b3J5IiwiaWF0IjoxNzU5NDYzMTE1LCJleHAiOjE3NjIwNDE2MDAsImp0aSI6IjJkNWFkNjBjLTkzNDUtNGFiMi1iODE5LTE0NzBlNmEzNzg2OSIsInNjb3BlIjoiZGV2aWNlOnJlZ2lzdGVyIiwic3ViIjoiNTA1MDU3Y2EtOGM3Yi00NzQ2LTlkNTYtM2ZjNzdlOTFhMmUyIiwiaGFyZHdhcmVNb2RlbCI6InJhZHhhIiwiZmlybXdhcmVWZXJzaW9uIjoiMDAwMDEifQ.CC9jNNX_kQZUuAA0Qt-U9cgx2xq7iUYQK3uvnGgGwut5nWKaIms2kPYAM00KWx_R9AjHCp_Sa_tk-KB3N_jG7aw3lgNp_bz8MfBbdgTLsoow7QT3w1DWcsStQlWjYae03q9rhrsKlkVZ0ODZKYyUVRZELERJbVTcspUl-_N8lyw0EdywrTw2SSkWl8EirsjCJDtYUlV8dE7WydtAenXl-O2DWSN3t7ffqStVltsdhNsg-UvrWpyCl1Feip8-DPF3AOvNfnUnIYEhpqi-U4rUTfMn1rNIHChkhh-YC0JzymCYgel0-xlq7rtGhWW1scDQ54L4avcrzk7Cd_uA3iOyPg"
# REGISTER_URL = "http://localhost:5173/api/device/pushpin/register"
REGISTER_URL = "https://pushpin-dev.datarealities.com/api/device/pushpin/register"

def generate_pin() -> str:
    """Generate a random 6-digit PIN."""
    return str(random.randint(100000, 999999))

def test_register():
    pin = generate_pin()
    print(f"Using PIN: {pin}")
    
    headers = {
        "Authorization": f"Bearer {FACTORY_TOKEN}",
        "X-Device-PIN": pin,
        "X-Device-MAC": f"00:11:22:33:44:{random.randint(10, 99)}"
    }
    response = requests.get(REGISTER_URL, headers=headers)

    try:
        # Print status code and headers first
        print(f"Status Code: {response.status_code}")
        print(json.dumps(dict(response.headers), indent=2))
        
        # Print response content for debugging
        print("Response content:")
        print(response.text[:500])  # Print first 500 chars of response
        
        # Only try to parse as JSON if content-type is application/json
        if 'application/json' in response.headers.get('content-type', ''):
            print(json.dumps(response.json(), indent=2))
        
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Response text: {response.text[:500]}")
    

if __name__ == "__main__":
    test_register()