"""Script to mint a web MQTT connection token.

Flow:
1. Log in with username/password to obtain the auth_session cookie.
2. Call the authenticated user mint endpoint to get a JWT and broker URL.
"""

from __future__ import annotations

import os
import sys
from typing import Tuple

import requests
from dotenv import load_dotenv


# Allow imports from tests/_utils
sys.path.append("tests")
from _utils.jwt_tools import pretty_print_jwt


load_dotenv()

BASE_URL = os.getenv("WEB_APP_BASE_URL", "http://localhost:5173")
USERNAME = os.getenv("SAMPLE_ADMIN_USERNAME", "admin@admin.com")
PASSWORD = os.getenv("SAMPLE_ADMIN_PASSWORD", "admin0823")

LOGIN_URL = f"{BASE_URL}/auth/login?/login"
MINT_URL = f"{BASE_URL}/api/user/mqtt/mint"


def login_and_get_session() -> requests.Session:
    """Log in via the form action and return a session with auth_session cookie set."""

    session = requests.Session()

    response = session.post(
        LOGIN_URL,
        data={"email": USERNAME, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )

    print("Login status:", response.status_code)
    try:
        payload = response.json()
        print("Login payload type:", payload.get("type"))
    except Exception:
        print("Login response (non-JSON):", response.text[:200])
        raise

    if response.status_code != 200 or payload.get("type") != "success":
        raise RuntimeError(f"Login failed: status={response.status_code}, body={response.text[:200]}")

    if not session.cookies.get("auth_session"):
        raise RuntimeError("Login succeeded but auth_session cookie was not set")

    return session


def mint_user_mqtt_credentials(session: requests.Session) -> Tuple[str, str, str]:
    """Call the user MQTT mint endpoint using the authenticated session.

    Returns (jwt, brokerUrl, mqttUsername).
    """

    response = session.post(
        MINT_URL,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        json={},
        timeout=10,
    )

    print("Mint status:", response.status_code)
    payload = response.json()
    print("Raw mint payload:")
    print(payload)

    if not payload.get("success"):
        raise RuntimeError(f"Mint failed: {payload}")

    data = payload.get("data") or {}
    jwt_token = data.get("jwt")
    broker_url = data.get("brokerUrl")
    mqtt_username = data.get("mqttUsername")

    if not jwt_token or not broker_url:
        raise RuntimeError(f"Mint response missing jwt or brokerUrl: {payload}")

    return jwt_token, broker_url, mqtt_username


def main() -> None:
    print("BASE_URL:", BASE_URL)
    print("LOGIN_URL:", LOGIN_URL)
    print("MINT_URL:", MINT_URL)
    print("USERNAME:", USERNAME)

    session = login_and_get_session()
    jwt_token, broker_url, mqtt_username = mint_user_mqtt_credentials(session)

    print("\nBroker URL:", broker_url)
    print("MQTT Username:", mqtt_username)
    print("JWT (first 40 chars):", jwt_token[:40] + "...")

    # Pretty-print decoded JWT header and payload (no signature verification)
    pretty_print_jwt(jwt_token)


if __name__ == "__main__":
    main()
