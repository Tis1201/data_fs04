import os
import sys
from pathlib import Path
from typing import Any, Dict

import jwt
import pytest
import requests
from dotenv import load_dotenv


TESTS_ROOT = Path(__file__).resolve().parents[4]
if str(TESTS_ROOT) not in sys.path:
    sys.path.append(str(TESTS_ROOT))

from _utils.jwt_tools import pretty_print_jwt  # noqa: E402


load_dotenv()


MQTT_MINT_URL = os.getenv('MQTT_MINT_URL', 'http://localhost:5173/api/device/mqtt/mint')
SAMPLE_DEVICE_API_KEY = os.getenv('SAMPLE_DEVICE_API_KEY')


def _mint_device_credentials() -> requests.Response:
    """Call the device MQTT mint endpoint using the device API key.

    This mirrors the factory mint helper but authenticates with X-API-Key
    instead of a factory JWT.
    """
    if not SAMPLE_DEVICE_API_KEY:
        pytest.skip('SAMPLE_DEVICE_API_KEY env var is required for this test')

    headers = {
        'x-api-key': SAMPLE_DEVICE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

    response = requests.post(MQTT_MINT_URL, headers=headers, json={}, timeout=15)
    return response


def _assert_success_payload(payload: Dict[str, Any]) -> None:
    assert 'data' in payload, f"Unexpected payload structure: {payload}"

    data = payload['data']
    assert isinstance(data, dict), f"Expected 'data' to be an object, got: {type(data)}"

    jwt_token = data.get('jwt')
    broker_url = data.get('brokerUrl')
    mqtt_username = data.get('mqttUsername')

    assert isinstance(jwt_token, str) and jwt_token, 'JWT token missing from response'
    assert isinstance(broker_url, str) and broker_url, 'Broker URL missing from response'
    assert isinstance(mqtt_username, str) and mqtt_username.startswith('device:'), (
        f'Unexpected mqttUsername: {mqtt_username}'
    )


def test_device_mint_endpoint_returns_credentials() -> None:
    response = _mint_device_credentials()

    assert response.status_code == 200, (
        f"Unexpected status code: {response.status_code} - Body: {response.text}"
    )

    payload = response.json()

    assert payload.get('success') is True, f"Mint did not succeed: {payload}"
    _assert_success_payload(payload)

    # Pretty-print JWT for inspection during manual runs
    pretty_print_jwt(payload['data']['jwt'])


if __name__ == '__main__':
    test_device_mint_endpoint_returns_credentials()
