import urllib.parse
from typing import Callable, Any

import paho.mqtt.client as mqtt
from loguru import logger


class DeviceConnection:
    """Encapsulates MQTT client setup and connection for a claimed device
    test client (post-claim MQTT link).
    """

    def __init__(
        self,
        broker_url: str,
        sub: str,
        password: str,
        on_connect: Callable[..., Any],
        on_message: Callable[..., Any],
        on_disconnect: Callable[..., Any],
    ) -> None:
        self.broker_url = broker_url
        self.sub = sub
        self.password = password
        self.on_connect_cb = on_connect
        self.on_message_cb = on_message
        self.on_disconnect_cb = on_disconnect
        self.client: mqtt.Client | None = None

    def connect(self) -> mqtt.Client:
        parsed = urllib.parse.urlparse(self.broker_url)
        host = parsed.hostname
        port = parsed.port or 443
        ws_path = parsed.path or "/mqtt"

        client = mqtt.Client(client_id=self.sub, protocol=mqtt.MQTTv5, transport="websockets")
        client.username_pw_set(username=self.sub, password=self.password)
        client.user_data_set({"username": "device"})
        client.ws_set_options(path=ws_path)
        client.tls_set()  # Enable TLS for wss on port 443

        client.on_connect = self.on_connect_cb
        client.on_message = self.on_message_cb
        client.on_disconnect = self.on_disconnect_cb

        logger.debug(f"[DeviceConnection] Connecting to broker: {host}:{port} (path: {ws_path})")
        client.connect(host, port, 60)
        client.loop_start()

        self.client = client
        return client
