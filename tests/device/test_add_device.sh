#!/bin/bash

# Test script for adding a device
# Usage: ./test_add_device.sh

# Base URL of your API
BASE_URL="http://localhost:5173"

# Endpoint
ENDPOINT="/api/device/add"

# Make the POST request with the test data
curl -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "3b60525a-57c9-48ab-85cc-ec414ae34300",
    "deviceType": "dummy",
    "model": "arm64",
    "osVersion": "darwin 15.4.1",
    "hostname": "Bernards-MacBook-Air-2.local",
    "pin": "378944",
    "senderId": "cmc4msp7r000810g1ya5u3od2",
    "senderConnectionId": "33ace02e-3f1c-480e-a78d-c4424ea0b2c4",
    "senderConnectionProtocol": "sse",
    "timestamp": "2025-07-05T05:59:56Z",
    "hardwareId": "19C0A090-5A8B-58ED-8DB7-C6DF95D2ECDB",
    "networkInfo": {
      "hostname": "Bernards-MacBook-Air-2.local",
      "localIp": "192.168.0.125",
      "publicIp": "Unknown",
      "mac": "19C0A090-5A8B-58ED-8DB7-C6DF95D2ECDB"
    },
    "systemInfo": {
      "bootTime": "2025-06-27 13:48:52 +0800 +08",
      "cpuModel": "Bernards-MacBook-Air-2.local",
      "platformID": "Standalone Workstation"
    }
  }' | jq .