# Device Apps Available Endpoint

**Endpoint:** `GET /api/device/apps/available`

JWT-authenticated endpoint for devices to list available apps with download information.

## Features
- JWT Bearer token authentication
- Rate limiting (100 req/min per device)
- Access control via ZenStack
- Returns resource IDs and download URLs

## Response
```json
{
  "success": true,
  "data": {
    "apps": [
      {
        "resource_id": "...",
        "package_name": "com.example.app",
        "app_name": "Example App",
        "version": "1.0.0",
        "size": 1048576,
        "type": "file",
        "format": "apk",
        "download_url": "/api/device/resources/{id}"
      }
    ]
  }
}
```

