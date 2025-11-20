import sys
import time
from typing import Any, Dict

import os
import urllib.parse
import json
import requests
import paho.mqtt.client as mqtt  # noqa: F401
from loguru import logger

sys.path.append("tests")

from mqtt.device.Device import Device  # type: ignore
from mqtt.device.mint.factory.test_mint_device_token import _assert_success_payload  # type: ignore


class ClaimedDevice:
    """Post-claim device test client.

    Uses the stored claim state (claimed.json) to mint a device MQTT link and
    connect as device:<deviceId>.
    """

    def __init__(self) -> None:
        # Create a base Device to reuse claim_state and file handling
        self._device = Device(brokerUrl="", jwt_token="", sub="")
        # Assert that a claimed state exists; FactoryDevice should have
        # completed a claim flow and written claimed.json before this is
        # invoked.
        if not getattr(self._device, "claim_state", None):
            raise RuntimeError("No claimed state found; run FactoryDevice claim flow first.")

        claim_state: Dict[str, Any] = self._device.claim_state or {}
        device_id = claim_state.get("deviceId")
        if not device_id:
            raise RuntimeError("Claim state missing deviceId; cannot connect.")
        self.device_id = device_id

        logger.info(f"------- Device ID -----------")
        logger.info(f"{device_id}")
        logger.info(f"-----------------------------")

        self._device.on_notification = self._handle_notification
        
    @property
    def client(self) -> mqtt.Client | None:  # type: ignore[name-defined]
        return self._device.client

    def mint(self, api_key: str) -> Dict[str, Any]:
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

        # Reuse shared assertions from the mint test helper for payload shape
        _assert_success_payload(payload)

        return payload

    def connect(self) -> None:
        claim_state: Dict[str, Any] = self._device.claim_state or {}
        api_key = claim_state.get("apiKey")
        if not api_key:
            raise RuntimeError("Claim state missing apiKey; cannot mint device MQTT credentials.")

        payload = self.mint(api_key)
        data = payload.get("data") or {}
        broker_url = data.get("brokerUrl")
        jwt_token = data.get("jwt")
        mqtt_username = data.get("mqttUsername")

        if not broker_url or not jwt_token or not mqtt_username:
            raise RuntimeError(f"Device MQTT mint response missing fields: {payload}")

        # Log and update connection parameters to use the device identity
        logger.info(f"Minted device MQTT link: brokerUrl={broker_url}, mqttUsername={mqtt_username}")

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

    def publish_reply(self, payload: Dict[str, Any]) -> None:
        """Publish a reply payload to the MQTT replies topic for this claimed device."""
        if not self._device.client:
            raise RuntimeError("MQTT client not connected. Cannot publish reply.")

        topic = f"device/{self.device_id}/replies"
        self._device.client.publish(topic, json.dumps(payload), qos=1)  # type: ignore[arg-type]
        logger.debug(f"Published reply to {topic}: {payload}")


    def _handle_notification(self, data: Dict[str, Any]) -> None:

        notif_type = data.get("claims")["type"]
        ticket = data.get("ticket")

        logger.info(f"Device notification received: type={notif_type}, hasTicket={bool(ticket)}")

        match notif_type:
            case "device.screenshot":
                self._send_screenshot_response(notif_type, ticket)
            case "device.reset":
                self._send_reset_response(notif_type, ticket)

    def _send_screenshot_response(self, notif_type: str, ticket: str) -> Dict[str, Any]:
        reply_envelope: Dict[str, Any] = {
            "ticket": ticket,
            "status": "OK",
            "error": "",
            "result": {
                "type": f"{notif_type}.response",
                "data": "<base64-image>",
                "format": "png",
                "width": 1920,
                "height": 1080
            }
        }

        self.publish_reply(reply_envelope)
        return reply_envelope

    def _send_reset_response(self, notif_type: str, ticket: str) -> Dict[str, Any]:
        reply_envelope: Dict[str, Any] = {
            "ticket": ticket,
            "status": "OK",
            "error": "",
            "result": {
                "type": f"{notif_type}.response",
            }
        }

        self.publish_reply(reply_envelope)
        return reply_envelope


    def stop(self) -> None:
        if self._device.client:
            self._device.client.loop_stop()
            self._device.client.disconnect()


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    claimed_device = ClaimedDevice()
    claimed_device.connect()
    logger.info("ClaimedDevice connected; press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        claimed_device.stop()