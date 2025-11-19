import sys
import time
from typing import Any, Dict

import os
import urllib.parse
import requests
import paho.mqtt.client as mqtt  # noqa: F401
from loguru import logger

sys.path.append("tests")

from mqtt.device.Device import Device  # type: ignore


class ClaimedDevice:
    """Post-claim device test client.

    Uses the stored claim state (claimed.json) to mint a device MQTT link and
    connect as device:<deviceId>.
    """

    def __init__(self) -> None:
        # Create a base Device to reuse claim_state and file handling
        self._device = Device(brokerUrl="", jwt_token="", sub="")
        if not self._device.claim_state:
            raise RuntimeError("No claim_state found; run FactoryDevice claim flow first.")

    @property
    def client(self) -> mqtt.Client | None:  # type: ignore[name-defined]
        return self._device.client

    def connect(self) -> None:
        claim_state: Dict[str, Any] = self._device.claim_state or {}
        api_key = claim_state.get("apiKey")
        if not api_key:
            raise RuntimeError("Claim state missing apiKey; cannot mint device MQTT credentials.")

        mint_url = os.getenv("MQTT_MINT_URL", "http://localhost:5173/api/device/mqtt/mint")
        if not mint_url:
            raise RuntimeError("MQTT_MINT_URL is not configured")

        response = requests.post(
            mint_url,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": api_key,
            },
            json={},
            timeout=10,
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Failed to mint device MQTT credentials: {response.status_code} - {response.text}"
            )

        payload = response.json()
        if not payload.get("success"):
            raise RuntimeError(f"Device MQTT mint did not succeed: {payload}")

        data = payload.get("data") or {}
        broker_url = data.get("brokerUrl")
        jwt_token = data.get("jwt")
        mqtt_username = data.get("mqttUsername")

        if not broker_url or not jwt_token or not mqtt_username:
            raise RuntimeError(f"Device MQTT mint response missing fields: {payload}")

        # Update connection parameters to use the device identity
        self._device.brokerUrl = broker_url
        self._device.jwt = jwt_token
        self._device.sub = mqtt_username

        parsed = urllib.parse.urlparse(self._device.brokerUrl)
        host = parsed.hostname
        port = parsed.port or 443
        ws_path = parsed.path or "/mqtt"

        client = mqtt.Client(client_id=self._device.sub, protocol=mqtt.MQTTv5, transport="websockets")
        client.username_pw_set(username=self._device.sub, password=self._device.jwt)
        client.user_data_set({"username": "device"})
        client.ws_set_options(path=ws_path)
        client.tls_set()  # Enable TLS for wss on port 443

        client.on_connect = self._device.on_connect
        client.on_message = self._device.on_message
        client.on_disconnect = self._device.on_disconnect

        logger.debug(f"[DeviceConnection] Connecting to broker: {host}:{port} (path: {ws_path})")
        client.connect(host, port, 60)
        client.loop_start()

        self._device.client = client

    def stop(self) -> None:
        if self._device.client:
            self._device.client.loop_stop()
            self._device.client.disconnect()
