#!/bin/bash

# Test webhook endpoint with a sample JSON payload
curl -X POST http://localhost:5173/api/webhook/m8yhmqyf-887d1669c7c24d698921a294ff88e7d9 \
  -H "Content-Type: application/json" \
  -d '{
    "event": "user.created",
    "data": {
      "userId": "123",
      "username": "testuser",
      "createdAt": "2025-05-01T06:32:36Z"
    }
  }'