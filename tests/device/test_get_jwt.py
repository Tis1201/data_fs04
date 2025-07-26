import requests
import os
import jwt  # pyjwt
import json
from dotenv import load_dotenv

load_dotenv()

DEVICE_API_KEY = os.getenv("DEVICE_API_KEY")
print("DEVICE_API_KEY:", DEVICE_API_KEY)

# Make request
headers = {
    "x-api-key": DEVICE_API_KEY
}
response = requests.get('http://localhost:5173/api/device/jwt', headers=headers)

# Parse JSON response
print(response.status_code)
data = response.json()
print("Raw response:", json.dumps(data, indent=2))

# Extract and decode JWT
if response.status_code == 200 and "jwt" in data["data"]:
    token = data["data"]["jwt"]

    # Decode header and payload (without verifying)
    header = jwt.get_unverified_header(token)
    payload = jwt.decode(token, options={"verify_signature": False})

    print("\n🔐 JWT Header:")
    print(json.dumps(header, indent=2))

    print("\n📦 JWT Payload:")
    print(json.dumps(payload, indent=2))

else:
    print("❌ JWT not found or request failed.")
