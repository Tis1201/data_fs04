import json
import os
import sys
from contextlib import closing

import requests
from dotenv import load_dotenv


load_dotenv()

SSE_URL = "https://pushpin.datarealities.com/api/device/pushpin/listen"
JWT_URL = os.getenv("JWT_EXCHANGE_URL", "https://app.datarealities.com/api/device/jwt")
DEVICE_API_KEY = "see28nvtyblifzym953orkmjilv1sm22" #os.getenv("DEVICE_API_KEY")


def _require_env(name: str, value: str | None) -> str:
    if not value:
        raise RuntimeError(f"{name} environment variable is required")
    return value


def fetch_device_jwt(api_key: str) -> str:
    headers = {"x-api-key": api_key}
    response = requests.get(JWT_URL, headers=headers, timeout=10)

    print(f"JWT exchange status: {response.status_code}")
    data = response.json()
    print("JWT exchange response:", json.dumps(data, indent=2))

    if response.status_code != 200:
        raise RuntimeError("Failed to exchange API key for JWT")

    token = data.get("data", {}).get("jwt")
    if not token:
        raise RuntimeError("Response missing JWT token")

    return token


def listen_to_sse(api_key: str) -> None:
    headers = {
        "x-api-key": api_key,
        "accept": "text/event-stream",
    }

    with closing(
        requests.get(SSE_URL, headers=headers, stream=True, timeout=(5, None))
    ) as response:
        print(f"SSE listen status: {response.status_code}")
        if response.status_code != 200:
            print("SSE listen body:", response.text)
            response.raise_for_status()

        print("Awaiting SSE events... (Ctrl+C to stop)")
        try:
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                print(line)
        except KeyboardInterrupt:
            print("\nStopped listening.")


def main() -> None:
    api_key = _require_env("DEVICE_API_KEY", DEVICE_API_KEY)

    try:
        token = fetch_device_jwt(api_key)
        print("Retrieved JWT token (truncated):", token[:32] + "...")
    except Exception as exc:  # noqa: BLE001
        print(f"JWT exchange failed: {exc}")
        sys.exit(1)

    try:
        listen_to_sse(api_key)
    except Exception as exc:  # noqa: BLE001
        print(f"SSE listen failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
