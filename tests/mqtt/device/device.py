#Device Class
import os
import sys
import uuid
import time
import threading
import json
import socket
import platform
from pathlib import Path
from typing import Any, Dict

import jwt
import requests
from dotenv import load_dotenv
import paho.mqtt.client as mqtt
from loguru import logger

sys.path.append("tests")

from mqtt.device.mint.factory.test_mint_factory_token import _mint_factory_credentials
from _utils.jwt_tools import pretty_print_jwt  # noqa: F401
from mqtt.device.handlers import DeviceHandlers
from mqtt.device.connection import DeviceConnection

load_dotenv()

FACTORY_TOKEN = os.getenv('SAMPLE_DEVICE_FACTORY_TOKEN')


class Device:
	def __init__(self, brokerUrl: str, jwt_token: str, sub: str):
		self.brokerUrl = brokerUrl
		self.jwt = jwt_token
		self.sub = sub
		self.client: mqtt.Client | None = None
		self.pending_requests: Dict[str, Dict[str, Any]] = {}
		self.claim_file = Path(__file__).with_name('claimed.json')
		self.claim_state = self._load_claim_state()
		self.handlers = DeviceHandlers(self)
		if self.claim_state:
			logger.info(f"Loaded existing claimed state from {self.claim_file}: {self.claim_state}")

	def start_register(self) -> None:
		"""Perform initial registration to obtain a PIN, unless already claimed."""
		if self.claim_state:
			logger.info("Device already claimed; skipping registration step")
			return

		response = self.request('get.pin', {}, timeout=5)

		logger.debug(f"RPC response: {response}")

		assert response.get("result")
		assert response.get("result").get("pin")

		pin = response.get("result").get("pin")

		logger.debug(f'Pin: {pin}')

		self.pin = pin

	def on_connect(self, client, userdata, flags, reason_code, properties=None):  # type: ignore[override]
		logger.debug("Connected to broker")
		client.subscribe(f'device/{self.sub}/response')
		client.subscribe(f'device/{self.sub}/notifications')

	def on_message(self, client, userdata, message):  # type: ignore[override]
		topic = message.topic.decode() if isinstance(message.topic, bytes) else message.topic
		payload = message.payload.decode()
		logger.debug(f"Received message on {topic}: {payload}")

		if topic.endswith('/response'):
			self.handlers.handle_response(payload)
		elif topic.endswith('/requests'):
			self.handlers.handle_request(client, payload)
		elif topic.endswith('/notifications'):
			self.handlers.handle_notification(payload)

	def _build_device_info(self) -> Dict[str, Any]:
		hostname = socket.gethostname()
		os_version = platform.platform()

		return {
			'id': None,
			'deviceType': 'factory-simulator',
			'model': 'python-test-client',
			'osVersion': os_version,
			'hostname': hostname,
			'pin': getattr(self, 'pin', None),
			'senderId': self.sub,
		}

	def _load_claim_state(self) -> Dict[str, Any] | None:
		if not self.claim_file.exists():
			return None
		try:
			with self.claim_file.open('r', encoding='utf-8') as f:
				return json.load(f)
		except Exception as e:
			logger.warning(f"Failed to load claimed state from {self.claim_file}: {e}")
			return None

	def _save_claim_state(self, state: Dict[str, Any]) -> None:
		try:
			with self.claim_file.open('w', encoding='utf-8') as f:
				json.dump(state, f, indent=2)
			self.claim_state = state
			logger.info(f"Saved claimed state to {self.claim_file}: {state}")
		except Exception as e:
			logger.error(f"Failed to save claimed state to {self.claim_file}: {e}")

	def _handle_claim_confirm_result(self, result: Dict[str, Any]) -> None:
		factory_device_id = None
		if isinstance(self.sub, str) and ':' in self.sub:
			_, factory_device_id = self.sub.split(':', 1)

		state = {
			'deviceId': result.get('deviceId'),
			'apiKey': result.get('apiKey'),
			'accountId': result.get('accountId'),
			'factoryDeviceId': factory_device_id,
			'claimedAt': time.time(),
		}

		self._save_claim_state(state)

	def on_disconnect(self, client, userdata, reason_code, properties=None):  # type: ignore[override]
		logger.debug("Disconnected from broker")

	def request(self, op: str, params: Dict[str, Any], timeout: float = 10.0) -> Dict[str, Any]:
		if not self.client:
			raise RuntimeError("MQTT client not connected. Call connect() first.")

		request_id = str(uuid.uuid4())
		request_payload = {
			'requestId': request_id,
			'op': op,
			'params': params
		}

		self.pending_requests[request_id] = {'event': threading.Event(), 'response': None}

		request_topic = f'device/{self.sub}/requests'
		self.client.publish(request_topic, json.dumps(request_payload), qos=1)  # type: ignore[arg-type]
		logger.debug(f"Published request to {request_topic}: {request_payload}")

		if self.pending_requests[request_id]['event'].wait(timeout):
			response = self.pending_requests[request_id]['response']
			del self.pending_requests[request_id]
			return response  # type: ignore[return-value]
		else:
			del self.pending_requests[request_id]
			raise TimeoutError(f"No response for request {request_id} within {timeout}s")

	def connect(self) -> None:
		connection = DeviceConnection(
			broker_url=self.brokerUrl,
			sub=self.sub,
			password=FACTORY_TOKEN or "",
			on_connect=self.on_connect,
			on_message=self.on_message,
			on_disconnect=self.on_disconnect,
		)
		self.client = connection.connect()


def mint_factory_credentials():
	response = _mint_factory_credentials()
	assert response.status_code == 200, f"Unexpected status code: {response.status_code} - Body: {response.text}"
	payload = response.json()

	broker_url = payload['data']['brokerUrl']
	jwt_token = payload['data']['jwt']

	try:
		decoded = jwt.decode(jwt_token, options={"verify_signature": False})
		sub = decoded.get('sub')
		logger.debug(f"Device JWT sub: {sub}")
	except Exception as e:
		logger.warning(f"Failed to decode device JWT: {e}")
		sub = None

	return broker_url, jwt_token, sub