import sys

sys.path.append('tests')

from dotenv import load_dotenv
load_dotenv()
import paho.mqtt.client as mqtt

from device.mqtt.device.test_mint import mint

BROKER_HOST = "localhost"
BROKER_PORT = 8080
BROKER_PATH = "/mqtt"
DEVICE_ID = "8cea34ef-07c8-461a-9b69-02ff6e460260"

def on_connect(client, userdata, flags, reason_code, properties=None):
    print("Connected to broker")
    client.subscribe(f'{DEVICE_ID}/#')

def on_message(client, userdata, message):
    print("Received message:", message.payload.decode())

def on_disconnect(client, userdata, reason_code, properties=None):
    print("Disconnected from broker")

def test_connect():

    jwt = mint()
    print(jwt)

    client = mqtt.Client(client_id=DEVICE_ID, protocol=mqtt.MQTTv5, transport='websockets')
    client.username_pw_set(username=DEVICE_ID, password=jwt)
    client.user_data_set({'username': DEVICE_ID})
    client.ws_set_options(path=BROKER_PATH)

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    client.connect(BROKER_HOST, BROKER_PORT)
    client.loop_forever()

if __name__ == '__main__':
    test_connect()
