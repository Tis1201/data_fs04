import os
import requests

BASE_URL = "https://superset-dev.datarealities.com"
USERNAME = "admin"
PASSWORD = "ctctPUTPUT0823"

session = requests.Session()

# 1. Login to get access token (refresh=true also returns a refresh token if you need it)
login = session.post(
    f"{BASE_URL}/api/v1/security/login",
    json={
        "username": USERNAME,
        "password": PASSWORD,
        "provider": "db",
        "refresh": True,
    },
    timeout=30,
)
login.raise_for_status()
login_payload = login.json()
access_token = login_payload["access_token"]

session.headers.update({
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
})

# 2. Fetch CSRF token (required when you send JSON with a cookie session)
csrf_resp = session.get(
    f"{BASE_URL}/api/v1/security/csrf_token/",
    headers={"Referer": BASE_URL},
)
csrf_payload = csrf_resp.json()
csrf = csrf_payload.get("result")
if not csrf:
    raise RuntimeError(f"Failed to retrieve CSRF token: {csrf_payload}")

headers = {
    "X-CSRFToken": csrf,
    "Referer": BASE_URL,
}

# 3. Request the guest token for the resource you want to embed
payload = {
    "user": {
        "username": "embed-client",  # free-form; appears in audit logs
        "first_name": "Embed",
        "last_name": "Client",
    },
    "resources": [
        {"type": "dashboard", "id": "299074ce-1bb7-4096-8244-a96e03a401b1"}  # replace with your dashboard UUID/int ID
    ],
    "rls": [],  # optional row-level security rules
}

resp = session.post(
    f"{BASE_URL}/api/v1/security/guest_token/",
    json={k: v for k, v in payload.items()},
    headers=headers,
    timeout=30,
)
resp.raise_for_status()
guest_token = resp.json()["token"]
print(guest_token)