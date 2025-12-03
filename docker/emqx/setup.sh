#!/usr/bin/env bash
set -euo pipefail

# Script lives in docker/emqx; project root is two levels up
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

: "${EMQX_URL:?EMQX_URL is required (set in .env)}"
: "${EMQX_API_KEY:?EMQX_API_KEY is required (set in .env)}"
: "${EMQX_API_SECRET:?EMQX_API_SECRET is required (set in .env)}"
: "${EMQX_JWT_JWKS_ENDPOINT:?EMQX_JWT_JWKS_ENDPOINT is required (set in .env)}"

AUTH_HEADER="Authorization: Basic $(printf '%s:%s' "$EMQX_API_KEY" "$EMQX_API_SECRET" | base64)"

echo "Waiting for EMQX at ${EMQX_URL} to be ready..."
until curl -fsS "${EMQX_URL}/status" >/dev/null 2>&1; do
  sleep 2
done

echo "EMQX is ready. Configuring rules via HTTP API..."
API_URL="${EMQX_URL}/api/v5"

# Create Republish Connected Event Rule
curl -fsS -X POST "${API_URL}/rules" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "republish_connected_event",
    "sql": "SELECT clientid, username, connected_at FROM \"$events/client_connected\"",
    "actions": [
      {
        "function": "republish",
        "args": {
          "topic": "$events/client/connected",
          "qos": 1,
          "payload": "{\"clientid\": \"${clientid}\", \"username\": \"${username}\", \"connected_at\": ${connected_at}}"
        }
      }
    ],
    "enable": true,
    "description": "Republish client connected events"
  }' || echo "Warning: failed to create republish_connected_event rule"

# Create Republish Disconnected Event Rule
curl -fsS -X POST "${API_URL}/rules" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "republish_disconnected_event",
    "sql": "SELECT clientid, username, reason, disconnected_at FROM \"$events/client_disconnected\"",
    "actions": [
      {
        "function": "republish",
        "args": {
          "topic": "$events/client/disconnected",
          "qos": 1,
          "payload": "{\"clientid\": \"${clientid}\", \"username\": \"${username}\", \"reason\": \"${reason}\", \"disconnected_at\": ${disconnected_at}}"
        }
      }
    ],
    "enable": true,
    "description": "Republish client disconnected events"
  }' || echo "Warning: failed to create republish_disconnected_event rule"

# Create JWT authenticator using JWKS
echo "Configuring JWT authenticator via HTTP API..."

JWT_FROM="${EMQX_JWT_FROM:-password}"

JWT_BODY=$(cat <<EOF
{
  "mechanism": "jwt",
  "use_jwks": true,
  "endpoint": "${EMQX_JWT_JWKS_ENDPOINT}",
  "from": "${JWT_FROM}",
  "verify_claims": {
    "sub": "\${username}"
  },
  "disconnect_after_expire": false,
  "enable": true
}
EOF
)

curl -fsS -X POST "${API_URL}/authentication" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "${JWT_BODY}" || echo "Warning: failed to create JWT authenticator"

echo "EMQX setup complete."
