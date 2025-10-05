# Device Resource Download Endpoint

**Endpoint:** `GET /api/device/resources/[id]`

JWT-authenticated endpoint for devices to download resource files.

## Features
- JWT Bearer token authentication
- Rate limiting (50 downloads/min per device)
- Access control via ZenStack
- Supports local and cloud storage (GCS)
- Returns 302 redirect to file

## Response
- **302 Redirect** - Success, follow Location header
- **404 Not Found** - Resource doesn't exist or no access
- **403 Forbidden** - Access denied

