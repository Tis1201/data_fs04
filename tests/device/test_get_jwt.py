import requests
from dotenv import load_dotenv
import os
load_dotenv()

DEVICE_API_KEY=os.getenv('DEVICE_API_KEY')

print("DEVICE_API_KEY: ", DEVICE_API_KEY)

headers = {
    "x-api-key": DEVICE_API_KEY
}

response = requests.get('http://localhost:5173/api/device/jwt', headers=headers)



print(response.status_code, response.json())

