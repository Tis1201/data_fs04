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

# Check authorization settings and warn if ACL fallback is permissive
AUTHZ_SETTINGS_JSON=$(curl -fsS "${API_URL}/authorization/settings" -H "$AUTH_HEADER" 2>/dev/null || true)
if [ -n "$AUTHZ_SETTINGS_JSON" ]; then
  AUTHZ_NO_MATCH=$(printf '%s' "$AUTHZ_SETTINGS_JSON" | sed -n 's/.*"no_match"\s*:\s*"\([a-zA-Z]*\)".*/\1/p')
  if [ -n "$AUTHZ_NO_MATCH" ] && [ "$AUTHZ_NO_MATCH" != "deny" ]; then
    echo "WARNING: EMQX authorization.no_match is '$AUTHZ_NO_MATCH' (permissive). Consider setting it to 'deny' for restrictive ACLs."
  fi
fi

create_or_update_rule() {
  local id="$1"
  local body="$2"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/rules/${id}" -H "$AUTH_HEADER" || echo "000")
  if [ "$status" = "200" ]; then
    echo "Updating rule '${id}' via HTTP API..."
    curl -fsS -X PUT "${API_URL}/rules/${id}" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "${body}" || echo "Warning: failed to update rule '${id}'"
  else
    echo "Creating rule '${id}' via HTTP API..."
    curl -fsS -X POST "${API_URL}/rules" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "${body}" || echo "Warning: failed to create rule '${id}'"
  fi
}

RULE_CONNECTED_BODY=$(cat <<'EOF'
{
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
}
EOF
)

RULE_DISCONNECTED_BODY=$(cat <<'EOF'
{
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
}
EOF
)

create_or_update_rule "republish_connected_event" "${RULE_CONNECTED_BODY}"
create_or_update_rule "republish_disconnected_event" "${RULE_DISCONNECTED_BODY}"

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

JWT_ID="${EMQX_JWT_ID:-jwt}"

JWT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/authentication/${JWT_ID}" -H "$AUTH_HEADER" || echo "000")

if [ "$JWT_STATUS" = "200" ]; then
  echo "Updating JWT authenticator '${JWT_ID}' via HTTP API..."
  curl -fsS -X PUT "${API_URL}/authentication/${JWT_ID}" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "${JWT_BODY}" || echo "Warning: failed to update JWT authenticator '${JWT_ID}'"
else
  echo "Creating JWT authenticator '${JWT_ID}' via HTTP API..."
  curl -fsS -X POST "${API_URL}/authentication" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "${JWT_BODY}" || echo "Warning: failed to create JWT authenticator '${JWT_ID}'"
fi

echo "EMQX setup complete."
