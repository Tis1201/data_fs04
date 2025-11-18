import os
import sys
import uuid
import time
import threading
import json
from pathlib import Path
from typing import Any, Dict
import jwt

import pytest
import requests
from dotenv import load_dotenv
import paho.mqtt.client as mqtt
from loguru import logger

sys.path.append("tests")

from mqtt.device.mint.factory.test_mint_factory_token import _mint_factory_credentials    
from _utils.jwt_tools import pretty_print_jwt

load_dotenv()

FACTORY_TOKEN = os.getenv('SAMPLE_DEVICE_FACTORY_TOKEN')
# DEVICE_ID = "test-device-claim"  # Placeholder device ID for subscription

class Device:
    def __init__(self, brokerUrl, jwt, sub):
        self.brokerUrl = brokerUrl
        self.jwt = jwt
        self.sub = sub
        self.client = None
        self.pending_requests = {}  # request_id -> future-like dict

    def start_register(self):
        response = self.request('get.pin', {}, timeout=5)

        logger.debug(f"RPC response: {response}")

        assert response.get("result")
        assert response.get("result").get("pin")

        pin = response.get("result").get("pin")

        logger.debug(f'Pin: {pin}')


    def on_connect(self, client, userdata, flags, reason_code, properties=None):
        logger.debug("Connected to broker")
        # client.subscribe(f'{DEVICE_ID}/#')
        # Subscribe to response topic for RPC
        client.subscribe(f'device/{self.sub}/response')
        client.subscribe(f'device/{self.sub}/notifications')

    def on_message(self, client, userdata, message):
        topic = message.topic.decode() if isinstance(message.topic, bytes) else message.topic
        payload = message.payload.decode()
        logger.debug(f"Received message on {topic}: {payload}")

        # Handle RPC responses
        if topic.endswith('/response'):
            try:
                data = json.loads(payload)
                req_id = data.get('requestId')
                if req_id in self.pending_requests:
                    self.pending_requests[req_id]['response'] = data
                    self.pending_requests[req_id]['event'].set()
            except Exception as e:
                logger.error(f"Failed to parse response: {e}")

        # Handle RPC requests (device-side)
        elif topic.endswith('/requests'):
            try:
                data = json.loads(payload)
                self._handle_request(client, data)
            except Exception as e:
                logger.error(f"Failed to handle request: {e}")

    def _handle_request(self, client, request_data):
        """Process incoming RPC request and publish response."""
        req_id = request_data.get('requestId')
        op = request_data.get('op')
        params = request_data.get('params', {})

        if not req_id or not op:
            logger.warning(f"Invalid request: {request_data}")
            return

        # Simple operation handlers
        result = None
        error = None
        try:
            if op == 'ping':
                result = {'message': f"pong: {params.get('message', '')}"}
            elif op == 'echo':
                result = params
            elif op == 'add':
                a = params.get('a', 0)
                b = params.get('b', 0)
                result = {'sum': a + b}
            else:
                error = f"Unknown operation: {op}"
        except Exception as e:
            error = str(e)

        response = {
            'requestId': req_id,
            'op': op,
            'result': result,
            'error': error
        }

        response_topic = f'device/{self.sub}/response'
        client.publish(response_topic, json.dumps(response), qos=1)
        logger.debug(f"Published response to {response_topic}: {response}")

    def on_disconnect(self, client, userdata, reason_code, properties=None):
        logger.debug("Disconnected from broker")

    def request(self, op: str, params: Dict[str, Any], timeout: float = 10.0) -> Dict[str, Any]:
        """Send RPC request and wait for response."""
        if not self.client:
            raise RuntimeError("MQTT client not connected. Call connect() first.")

        request_id = str(uuid.uuid4())
        request_payload = {
            'requestId': request_id,
            'op': op,
            'params': params
        }

        # Prepare to wait for response
        self.pending_requests[request_id] = {'event': threading.Event(), 'response': None}

        # Publish request
        request_topic = f'device/{self.sub}/requests'
        self.client.publish(request_topic, json.dumps(request_payload), qos=1)
        logger.debug(f"Published request to {request_topic}: {request_payload}")

        # Wait for response with timeout
        if self.pending_requests[request_id]['event'].wait(timeout):
            response = self.pending_requests[request_id]['response']
            del self.pending_requests[request_id]
            return response
        else:
            del self.pending_requests[request_id]
            raise TimeoutError(f"No response for request {request_id} within {timeout}s")

    def connect(self):
        # Parse wss:// URL to host and port for paho-mqtt WebSocket transport
        import urllib.parse
        parsed = urllib.parse.urlparse(self.brokerUrl)
        host = parsed.hostname
        port = parsed.port or 443
        ws_path = parsed.path or "/mqtt"
        
        self.client = mqtt.Client(client_id=self.sub, protocol=mqtt.MQTTv5, transport='websockets')
        self.client.username_pw_set(username=self.sub, password=FACTORY_TOKEN)
        self.client.user_data_set({'username': "claim"})
        self.client.ws_set_options(path=ws_path)
        self.client.tls_set()  # Enable TLS for wss on port 443

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        logger.debug(f"Connecting to broker: {host}:{port} (path: {ws_path})")
        self.client.connect(host, port, 60)
        self.client.loop_start()  # Use loop_start() to allow non-blocking request() calls


def mint_factory_credentials():
    response = _mint_factory_credentials()
    assert response.status_code == 200, f"Unexpected status code: {response.status_code} - Body: {response.text}"
    payload = response.json()

    broker_url = payload['data']['brokerUrl']
    jwt_token = payload['data']['jwt']

    # Decode JWT to extract sub claim
    try:
        decoded = jwt.decode(jwt_token, options={"verify_signature": False})
        sub = decoded.get('sub')
        logger.debug(f"Device JWT sub: {sub}")
    except Exception as e:
        logger.warning(f"Failed to decode device JWT: {e}")
        sub = None

    return broker_url, jwt_token, sub


def test_claim():
    brokerUrl, jwt, sub = mint_factory_credentials()
    logger.debug(brokerUrl)
    logger.debug(f"{jwt[:10]}...")
    logger.debug(f"Device sub: {sub}")
    device = Device(brokerUrl, jwt, sub)
    device.connect()
    
    # Wait a moment for connection to establish
    time.sleep(1)
    
    try:
        # Example RPC call
        # response = device.request('ping', {'message': 'hello'}, timeout=5)
        # logger.info(f"RPC response: {response}")

        # response = device.request('get.pin', {}, timeout=5)
        # logger.info(f"RPC response: {response}")
        device.start_register()
        

    except TimeoutError as e:
        logger.warning(e)
    finally:
        device.client.loop_stop()
        device.client.disconnect()

if __name__ == "__main__":
    test_claim()