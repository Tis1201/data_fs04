FACTORY_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImJlYzIyYmUxLTQ1ZjgtNGQwYS1iOGM5LTFlNWQzNDI5NmNkZCJ9.eyJhdWQiOiJkZXZpY2UtcmVnaXN0ZXIiLCJ0eXAiOiJmYWN0b3J5IiwiaWF0IjoxNzU5NDYzMTE1LCJleHAiOjE3NjIwNDE2MDAsImp0aSI6IjJkNWFkNjBjLTkzNDUtNGFiMi1iODE5LTE0NzBlNmEzNzg2OSIsInNjb3BlIjoiZGV2aWNlOnJlZ2lzdGVyIiwic3ViIjoiNTA1MDU3Y2EtOGM3Yi00NzQ2LTlkNTYtM2ZjNzdlOTFhMmUyIiwiaGFyZHdhcmVNb2RlbCI6InJhZHhhIiwiZmlybXdhcmVWZXJzaW9uIjoiMDAwMDEifQ.CC9jNNX_kQZUuAA0Qt-U9cgx2xq7iUYQK3uvnGgGwut5nWKaIms2kPYAM00KWx_R9AjHCp_Sa_tk-KB3N_jG7aw3lgNp_bz8MfBbdgTLsoow7QT3w1DWcsStQlWjYae03q9rhrsKlkVZ0ODZKYyUVRZELERJbVTcspUl-_N8lyw0EdywrTw2SSkWl8EirsjCJDtYUlV8dE7WydtAenXl-O2DWSN3t7ffqStVltsdhNsg-UvrWpyCl1Feip8-DPF3AOvNfnUnIYEhpqi-U4rUTfMn1rNIHChkhh-YC0JzymCYgel0-xlq7rtGhWW1scDQ54L4avcrzk7Cd_uA3iOyPg"
REGISTER_URL  = "http://localhost:5173/api/device/pushpin/register"

import requests
import json

def test_register():
    headers = {
        "Authorization": f"Bearer {FACTORY_TOKEN}",
        "X-Device-PIN": "666456",
        "X-Device-MAC": "00:11:22:33:44:55"
    }
    response = requests.get(REGISTER_URL, headers=headers)

    try:
        print(json.dumps(response.json(), indent=2))
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(e)
    

if __name__ == "__main__":
    test_register()