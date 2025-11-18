import os
import sys
import jwt
from pathlib import Path
from typing import Any, Dict

import pytest
import requests
from dotenv import load_dotenv


TESTS_ROOT = Path(__file__).resolve().parents[4]
if str(TESTS_ROOT) not in sys.path:
    sys.path.append(str(TESTS_ROOT))

from _utils.jwt_tools import pretty_print_jwt


load_dotenv()


FACTORY_MINT_URL = os.getenv('FACTORY_MINT_URL', 'http://localhost:5173/api/device/mqtt/mint/factory')
FACTORY_TOKEN = os.getenv('SAMPLE_DEVICE_FACTORY_TOKEN')


def _mint_factory_credentials() -> requests.Response:
    if not FACTORY_TOKEN:
        pytest.skip('SAMPLE_DEVICE_FACTORY_TOKEN env var is required for this test')

    headers = {
        'Authorization': f'Bearer {FACTORY_TOKEN}',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }

    response = requests.post(FACTORY_MINT_URL, headers=headers, timeout=15)

    

    return response


def _assert_success_payload(payload: Dict[str, Any]) -> None:
    assert 'data' in payload, f"Unexpected payload structure: {payload}"

    data = payload['data']
    assert isinstance(data, dict), f"Expected 'data' to be an object, got: {type(data)}"

    jwt_token = data.get('jwt')
    broker_url = data.get('brokerUrl')
    assert isinstance(jwt_token, str) and jwt_token, 'JWT token missing from response'
    assert isinstance(broker_url, str) and broker_url, 'Broker URL missing from response'


def test_factory_mint_endpoint_returns_credentials() -> None:
    response = _mint_factory_credentials()

    assert response.status_code == 200, f"Unexpected status code: {response.status_code} - Body: {response.text}"

    payload = response.json()

    pretty_print_jwt(payload['data']['jwt'])

    # _assert_success_payload(payload)


if __name__ == '__main__':
    test_factory_mint_endpoint_returns_credentials()
