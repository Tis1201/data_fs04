import re
from dotenv import load_dotenv
load_dotenv()
import requests

import paho.mqtt.client as mqtt

MQTT_MINT_URL           = "http://localhost:5173/api/device/mqtt/mint"
MQTT_MINT_DEVICE_ID     = "qi3hh86phpx5hhnu8wzsc58vfz7trv8u"

def mint():
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": MQTT_MINT_DEVICE_ID
    }
    response = requests.post(MQTT_MINT_URL,headers=headers)
    response.raise_for_status()
     
    result = response.json()

    # print(result)
    jwt = result['data']['jwt']

    return jwt

def test_mqtt_mint():
    jwt = mint()
    print(jwt)
    
    

if __name__ == '__main__':
    test_mqtt_mint()