import sys
import time
from typing import Any, Dict

import os
import json
import urllib.parse
import jwt
import requests
import paho.mqtt.client as mqtt  # noqa: F401  # kept for symmetry with device client
from loguru import logger

from dotenv import load_dotenv
load_dotenv()


sys.path.append("tests")

from mqtt.device.Device import Device  # type: ignore


FACTORY_MINT_URL = os.getenv(
    "MQTT_MINT_URL_FACTORY",
)
FACTORY_TOKEN = os.getenv("SAMPLE_DEVICE_FACTORY_TOKEN")


def _mint_factory_credentials() -> requests.Response:
    """Mint factory MQTT credentials using the configured factory token.

    This mirrors the behavior from test_mint_factory_token.py but is self-contained
    so FactoryDevice does not depend on the test module.
    """
    if not FACTORY_MINT_URL:
        raise RuntimeError(
            "MQTT_MINT_URL_FACTORY env var is required for FactoryDevice"
        )

    if not FACTORY_TOKEN:
        raise RuntimeError(
            "SAMPLE_DEVICE_FACTORY_TOKEN env var is required for FactoryDevice"
        )

    headers = {
        "Authorization": f"Bearer {FACTORY_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    response = requests.post(FACTORY_MINT_URL, headers=headers, timeout=15)

    return response


class FactoryDevice:
    """Factory (pre-claim) device test client.

    Encapsulates the full factory-side claim workflow by:

    - Minting factory MQTT credentials via `_mint_factory_credentials()`
    - Creating an underlying `Device` test client with those credentials
    - Delegating connection and registration behavior to `Device`
    """

    def __init__(self) -> None:
        response = _mint_factory_credentials()
        assert response.status_code == 200, (
            f"Unexpected status code: {response.status_code} - Body: {response.text}"
        )
        payload = response.json()

        broker_url = payload['data']['brokerUrl']
        jwt_token = payload['data']['jwt']

        try:
            decoded = jwt.decode(jwt_token, options={"verify_signature": False})
            sub = decoded.get('sub')
            logger.debug(f"Factory device JWT sub: {sub}")
        except Exception as e:  # pragma: no cover - defensive logging
            logger.warning(f"Failed to decode factory device JWT: {e}")
            sub = None

        self._device = Device(broker_url, jwt_token, sub)
        # Register callbacks so business logic stays here.
        self._device.on_notification = self._handle_notification
        # self._device.on_rpc_response = self._handle_rpc_response

    @property
    def client(self) -> mqtt.Client | None:  # type: ignore[name-defined]
        return self._device.client

    def connect(self) -> None:
        parsed = urllib.parse.urlparse(self._device.brokerUrl)
        host = parsed.hostname
        port = parsed.port or 443
        ws_path = parsed.path or "/mqtt"

        client = mqtt.Client(client_id=self._device.sub, protocol=mqtt.MQTTv5, transport="websockets")
        # Use the minted MQTT JWT (connection credential) as the password
        client.username_pw_set(username=self._device.sub, password=self._device.jwt)
        client.user_data_set({"username": "factory"})
        client.ws_set_options(path=ws_path)
        if parsed.scheme == "wss":
            client.tls_set()  # Enable TLS for wss on port 443

        client.on_connect = self._device.on_connect
        client.on_message = self._device.on_message
        client.on_disconnect = self._device.on_disconnect

        logger.debug(f"[FactoryDeviceConnection] Connecting to broker: {host}:{port} (path: {ws_path})")
        client.connect(host, port, 60)
        client.loop_start()

        self._device.client = client

    def start_register(self) -> None:
        """Perform initial registration to obtain a PIN, unless already claimed.

        This is the factory-side claim initiation, using the underlying
        factory MQTT link (factory:<factoryDeviceId>).
        """
        # Wait for MQTT connection to be fully established before sending RPC.
        if not self._device.client:
            raise RuntimeError("MQTT client not connected. Call connect() first.")

        start_time = time.time()
        while time.time() - start_time < 5.0:
            # Paho client exposes is_connected() to check connection state.
            if getattr(self._device.client, "is_connected", lambda: False)():
                break
            time.sleep(0.1)
        else:
            raise TimeoutError("MQTT client did not connect within 5s; aborting get.pin request")

        response = self._device.request('get.pin', {}, timeout=5)

        logger.debug(f"RPC response: {response}")

        pin = response.get("pin")
        if not isinstance(pin, str):
            raise AssertionError('get.pin RPC response missing pin field')

        logger.debug(f'Pin: {pin}')

        # Store PIN on the underlying device client for any downstream use
        self._device.pin = pin

    def _handle_notification(self, data: Dict[str, Any]) -> None:
        """Handle notifications; for claim notifications, send device.claim.confirm."""
        ticket = data.get("ticket")

        if not ticket:
            logger.debug("Notification received without ticket; ignoring in FactoryDevice")
            return


        claims = jwt.decode(ticket, options={"verify_signature": False})

        notification_type = claims.get("type")

        logger.debug(f"Notification type: {notification_type}")

        match(notification_type):
            case "claim":
                self._handle_claim_notification(data)
            case _:
                logger.debug(f"Notification type '{notification_type}' not supported by FactoryDevice; ignoring")
                return

    def _handle_claim_notification(self, data: Dict[str, Any]) -> None:
        """Handle claim notifications; for claim notifications, send device.claim.confirm."""
        ticket = data.get("ticket")

        if not ticket:
            logger.debug("Notification received without ticket; ignoring in FactoryDevice")
            return

        logger.info("Received claim notification, sending device.claim.confirm")

        def _on_done(err: Exception | None, response: Dict[str, Any] | None) -> None:
            if err is not None:
                logger.error(f"device.claim.confirm RPC failed: {err}")
            else:
                logger.debug(f"RPC response: {response}")
                if response is None:
                    raise AssertionError('device.claim.confirm RPC returned no payload')

                assert isinstance(response, dict), 'device.claim.confirm RPC must return an object'
                self._device._handle_claim_confirm_result(response)  # type: ignore[attr-defined]

        # Use async helper so we don't block the MQTT network thread with a synchronous request
        self._device.request_async("device.claim.confirm", {"ticket": ticket}, _on_done)

    # def _handle_rpc_response(self, data: Dict[str, Any]) -> None:
    #     """Handle RPC responses, including device.claim.confirm."""
    #     if data.get("op") == "device.claim.confirm" and data.get("result"):
    #         self._device._handle_claim_confirm_result(data["result"])  # type: ignore[attr-defined]

    def wait_for_claim_confirm(self, timeout: float = 30.0, poll_interval: float = 0.5) -> Dict[str, Any]:
        """Block until the claim has been confirmed or timeout is reached.

        This relies on the underlying DeviceHandlers to:
        - Receive the claim notification
        - Send device.claim.confirm
        - Persist the claim result into self._device.claim_result
        """
        start_time = time.time()
        initial_result = getattr(self._device, "claim_result", None)

        while time.time() - start_time < timeout:
            current = getattr(self._device, "claim_result", None)
            if current and current is not initial_result:
                logger.info(f"Device claim confirmed: {current}")
                return current  # type: ignore[return-value]
            time.sleep(poll_interval)

        raise TimeoutError(f"Timed out waiting for device claim confirmation after {timeout}s")

    def stop(self) -> None:
        if self._device.client:
            self._device.client.loop_stop()
            self._device.client.disconnect()

if __name__ == "__main__":

   
    # MQTT_MINT_URL_FACTORY = os.getenv("MQTT_MINT_URL_FACTORY")
    # MQTT_MINT_URL         = os.getenv("MQTT_MINT_URL")

    # logger.info(f"MQTT_MINT_URL_FACTORY: {MQTT_MINT_URL_FACTORY}")
    # logger.info(f"MQTT_MINT_URL: {MQTT_MINT_URL}")

    

    factory_device = FactoryDevice()
    factory_device.connect()
    factory_device.start_register()
    factory_device.wait_for_claim_confirm()
    factory_device.stop()