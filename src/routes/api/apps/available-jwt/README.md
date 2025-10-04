# JWT-Authenticated Apps Endpoint

This endpoint provides JWT Bearer token authentication for device clients to retrieve available apps.

## Endpoint

```
GET /api/apps/available-jwt
```

## Features

- ✅ JWT Bearer token authentication
- ✅ Rate limiting (100 requests per minute per device)
- ✅ Same business logic as `/api/apps/available`
- ✅ Automatic role-based access control (ADMIN, MEMBER, USER)

## Authentication

The endpoint requires a valid JWT token obtained from `/api/device/jwt`.

### Headers

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

- **Limit**: 100 requests per minute per device
- **Identification**: By device ID from JWT payload
- **Headers**: Rate limit status included in response headers
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: ISO timestamp when the limit resets

## Query Parameters

| Parameter | Type   | Default | Description                    | Validation            |
|-----------|--------|---------|--------------------------------|-----------------------|
| `search`  | string | ""      | Search term for app filtering  | -                     |
| `page`    | number | 1       | Page number for pagination     | >= 1                  |
| `limit`   | number | 100     | Items per page                 | 1 <= limit <= 1000    |

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "apps": [
      {
        "package_name": "com.example.app",
        "app_name": "Example App"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 42,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "search": "",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Invalid Parameters
```json
{
  "success": false,
  "error": "Invalid parameters",
  "message": "Page must be >= 1, limit must be between 1 and 1000"
}
```

#### 401 Unauthorized - Missing/Invalid Token
```json
{
  "success": false,
  "error": "Missing or invalid Authorization header",
  "message": "Authorization header must be in format: Bearer <token>"
}
```

#### 401 Unauthorized - Expired Token
```json
{
  "success": false,
  "error": "Token expired",
  "message": "JWT has expired, please request a new token"
}
```

#### 403 Forbidden - Insufficient Permissions
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

#### 429 Too Many Requests - Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again after 2024-01-01T00:01:00.000Z",
  "retryAfter": "2024-01-01T00:01:00.000Z"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to retrieve available apps",
  "message": "Detailed error message"
}
```

## Usage Examples

### Python

```python
import requests
import os

# Step 1: Get JWT token
headers = {"x-api-key": os.getenv("DEVICE_API_KEY")}
jwt_response = requests.get('http://localhost:5173/api/device/jwt', headers=headers)
token = jwt_response.json()["data"]["jwt"]

# Step 2: Use JWT to get apps
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(
    'http://localhost:5173/api/apps/available-jwt',
    headers=headers,
    params={"search": "myapp", "page": 1, "limit": 10}
)

apps = response.json()["data"]["apps"]
print(f"Found {len(apps)} apps")
```

### cURL

```bash
# Step 1: Get JWT token
JWT_TOKEN=$(curl -s -H "x-api-key: $DEVICE_API_KEY" \
  http://localhost:5173/api/device/jwt | jq -r '.data.jwt')

# Step 2: Use JWT to get apps
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:5173/api/apps/available-jwt?search=myapp&page=1&limit=10"
```

### Go (Device Client)

```go
import (
    "encoding/json"
    "fmt"
    "net/http"
)

// Step 1: Get JWT token
func getJWT(apiKey string) (string, error) {
    req, _ := http.NewRequest("GET", "http://localhost:5173/api/device/jwt", nil)
    req.Header.Set("x-api-key", apiKey)
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    
    var result struct {
        Data struct {
            JWT string `json:"jwt"`
        } `json:"data"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Data.JWT, nil
}

// Step 2: Get apps with JWT
func getApps(jwt string, search string) ([]App, error) {
    req, _ := http.NewRequest("GET", 
        "http://localhost:5173/api/apps/available-jwt?search="+search, nil)
    req.Header.Set("Authorization", "Bearer "+jwt)
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Data struct {
            Apps []App `json:"apps"`
        } `json:"data"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Data.Apps, nil
}
```

## Access Control

### Admin Users
- Can see **all apps** from all users
- Full read access to the entire app catalog

### Member/Regular Users
- Can only see **their own apps**
- Apps are filtered by `createdBy` matching their user ID

The access control is automatically enforced based on the `systemRole` in the JWT payload.

## Testing

A comprehensive test suite is available:

```bash
cd tests/device
python test_available_apps_jwt.py
```

The test suite covers:
- ✅ JWT token acquisition
- ✅ Basic app retrieval
- ✅ Search functionality
- ✅ Pagination
- ✅ Rate limiting
- ✅ Invalid token rejection
- ✅ Missing token rejection

## Comparison with `/api/apps/available`

| Feature              | `/api/apps/available`     | `/api/apps/available-jwt`  |
|---------------------|---------------------------|----------------------------|
| Authentication      | Session cookies           | JWT Bearer token           |
| Use Case            | Web browsers              | Device clients             |
| Rate Limiting       | No                        | Yes (100/min per device)   |
| Guard Function      | `restrict()`              | `restrictJWT()`            |
| Business Logic      | Identical                 | Identical                  |

## Implementation Details

### Security Stack

1. **JWT Verification**
   - Signature validated using public key from database
   - Expiration checked
   - Issuer and audience claims validated
   - Key ID (kid) matched against active signing keys

2. **Rate Limiting**
   - Redis-based (when available)
   - In-memory fallback
   - Per-device tracking using deviceId from JWT
   - Automatic cleanup of expired entries

3. **Access Control**
   - Role-based (ADMIN, MEMBER, USER)
   - Row-level security (users see only their apps)
   - Automatic filtering based on JWT claims

### Error Handling

All errors are logged with:
- User ID
- Device ID
- Account ID
- Request parameters
- Full error stack traces

### Monitoring

The endpoint logs:
- Successful requests with counts
- Rate limit violations
- Authentication failures
- Authorization failures
- Database errors

## Related Endpoints

- `GET /api/device/jwt` - Get JWT token for device
- `GET /api/apps/available` - Session-based version for web browsers
- `GET /.well-known/jwks.json` - Public keys for JWT verification

