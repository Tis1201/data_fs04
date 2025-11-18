#!/usr/bin/env bash

set -euo pipefail

BROKER_HOST=${BROKER_HOST:-mq.datarealities.com}
BROKER_PORT=${BROKER_PORT:-443}
BROKER_PATH=${BROKER_PATH:-/mqtt}
DEVICE_ID=${DEVICE_ID:-crappy}
PIN_CODE=${PIN_CODE:-123456}

EVENT_ID="device-register-$(date +%s)"

PAYLOAD=$(cat <<EOF
{
  "eventId": "${EVENT_ID}",
  "type": "device:register",
  "payload": {
    "action": "device:register",
    "deviceId": "${DEVICE_ID}",
    "pin": "${PIN_CODE}",
    "deviceInfo": {
      "model": "py-emulator",
      "os": "linux",
      "version": "0.0.1"
    }
  }
}
EOF
)

echo "Publishing register envelope for device '${DEVICE_ID}' (eventId=${EVENT_ID})"

mqtt pub \
  -d \
  -V 5 \
  -h "${BROKER_HOST}" \
  -p "${BROKER_PORT}" \
  -s \
  -ws \
  -ws:path "${BROKER_PATH}" \
  -t "mqtt/device/${DEVICE_ID}/requests" \
  -m "${PAYLOAD}"

echo "Publish complete"