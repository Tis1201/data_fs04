# Device Management Architecture

**Last Updated**: 2025-10-12  
**Status**: ✅ Production Ready

## Overview

This document provides a comprehensive guide to device management, covering device registration, authentication, lifecycle management, API endpoints, and security features for handling 100k+ devices in production.

---

## 🏗️ Device Management Architecture

### Complete Device Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DEVICE LIFECYCLE MANAGEMENT                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        DEVICE REGISTRATION                            │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Factory   │  │   Device    │  │   PIN       │  │   SSE       │    │    │
│  │  │    JWT      │  │   Client    │  │ Generation  │  │ Connection  │    │    │
│  │  │src/lib/     │  │   (Go)      │  │src/lib/     │  │src/routes/  │    │    │
│  │  │server/      │  │             │  │server/      │  │api/device/  │    │    │
│  │  │device/      │  │ • Factory   │  │device/      │  │register/    │    │    │
│  │  │deviceJWT    │  │   JWT       │  │devicePin    │  │+server.ts   │    │    │
│  │  │Checker.ts   │  │ • PIN       │  │Checker.ts   │  │             │    │    │
│  │  │             │  │ • MAC       │  │             │  │ • Verify    │    │    │
│  │  │ • Verify    │  │ • Device    │  │ • Validate  │  │   JWT       │    │    │
│  │  │   JWT       │  │   Info      │  │   PIN       │  │ • Create    │    │    │
│  │  │ • Extract   │  │             │  │   Format    │  │   Device    │    │    │
│  │  │   Claims    │  │             │  │   Strength  │  │ • SSE       │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        DEVICE CLAIMING                                │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │     UI      │  │   Device    │  │   Device    │  │   Device    │    │    │
│  │  │   Claim     │  │  Manager    │  │  Database   │  │  Response   │    │    │
│  │  │src/routes/  │  │src/lib/     │  │prisma/      │  │src/routes/  │    │    │
│  │  │admin/iot/   │  │server/      │  │schema.prisma│  │api/device/  │    │    │
│  │  │devices/     │  │device/      │  │             │  │add/         │    │    │
│  │  │claim/       │  │deviceManager│  │ • Device    │  │+server.ts   │    │    │
│  │  │+page.svelte │  │.ts          │  │   Table     │  │             │    │    │
│  │  │             │  │             │  │ • API Key   │  │ • Update    │    │    │
│  │  │ • Enter     │  │ • Claim     │  │   Generation│  │   Device    │    │    │
│  │  │   PIN       │  │   Device    │  │ • User      │  │ • Send      │    │    │
│  │  │ • Validate  │  │ • Generate  │  │   Assignment│  │   API Key   │    │    │
│  │  │   Access    │  │   API Key   │  │ • Account   │  │ • Notify    │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        DEVICE AUTHENTICATION                          │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Device    │  │   API Key   │  │   Device    │  │   JWT       │    │    │
│  │  │   Client    │  │   Auth      │  │   Service   │  │   Token     │    │    │
│  │  │   (Go)      │  │src/lib/     │  │src/lib/     │  │src/routes/  │    │    │
│  │  │             │  │server/      │  │server/      │  │api/device/  │    │    │
│  │  │ • API Key   │  │device/      │  │device/      │  │jwt/         │    │    │
│  │  │   Header    │  │deviceAuth.ts│  │deviceService│  │+server.ts   │    │    │
│  │  │ • Device    │  │             │  │.ts          │  │             │    │    │
│  │  │   Info      │  │ • Validate  │  │             │  │ • Generate  │    │    │
│  │  │ • Status    │  │   API Key   │  │ • Get       │  │   JWT       │    │    │
│  │  │   Updates   │  │ • Get       │  │   Device    │  │ • Device    │    │    │
│  │  │             │  │   Device    │  │   Info      │  │   Claims    │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        DEVICE OPERATIONS                              │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Apps      │  │  Resources  │  │   Status    │  │   Messages  │    │    │
│  │  │ Management  │  │  Download   │  │ Management  │  │   & Data    │    │    │
│  │  │src/routes/  │  │src/routes/  │  │src/lib/     │  │src/routes/  │    │    │
│  │  │api/device/  │  │api/device/  │  │server/      │  │api/device/  │    │    │
│  │  │apps/        │  │resources/   │  │device/      │  │message/     │    │    │
│  │  │available/   │  │[id]/        │  │deviceStatus │  │+server.ts   │    │    │
│  │  │+server.ts   │  │+server.ts   │  │Manager.ts   │  │             │    │    │
│  │  │             │  │             │  │             │  │ • Receive   │    │    │
│  │  │ • List      │  │ • Download  │  │ • Track     │  │   Messages  │    │    │
│  │  │   Apps      │  │   Files     │  │   Status    │  │ • Push      │    │    │
│  │  │ • Rate      │  │ • Access    │  │ • Update    │  │   Data      │    │    │
│  │  │   Limit     │  │   Control   │  │   Database  │  │ • Real-time │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Device Registration**: Factory JWT validation, PIN generation, SSE connection
2. **Device Claiming**: User PIN entry, device assignment, API key generation
3. **Device Authentication**: API key validation, JWT token generation
4. **Device Operations**: App management, resource downloads, status tracking

---

## 📱 Complete Device Flow: Register → Listen → JWT

### Overview

The complete device flow consists of three main phases:
1. **Device Registration** - Using factory JWT token
2. **Device Listening** - Establishing SSE connection for real-time communication
3. **JWT Token Acquisition** - Getting access tokens for API calls

### Phase 1: Device Registration

#### Factory JWT Authentication

**File**: [`src/lib/server/device/deviceJWTChecker.ts`](../../src/lib/server/device/deviceJWTChecker.ts)

- **JWT Verification** with RS/ES algorithms
- **Key Management** via database lookup (kid header)
- **Required Claims**: `aud: 'device-register'`, `typ: 'factory'`, `scope: 'device:register'`
- **Signature Validation** using stored public keys

#### PIN Generation & Validation

**File**: [`src/lib/server/device/devicePinChecker.ts`](../../src/lib/server/device/devicePinChecker.ts)

- **PIN Format**: 6-digit numeric code
- **Strength Validation**: Prevents weak PINs
- **TTL Management**: 1-hour expiration
- **Uniqueness**: Prevents duplicate PINs

#### Device Registration Endpoint

**File**: [`src/routes/api/device/register/+server.ts`](../../src/routes/api/device/register/+server.ts)

##### Registration Flow

1. **Factory JWT Verification** - Validate device manufacturer token
2. **PIN Validation** - Check PIN format and strength
3. **MAC Address Check** - Prevent duplicate device registration
4. **Preclaim Validation** - Check if device is pre-claimed
5. **SSE Connection** - Establish real-time communication
6. **Device Storage** - Store device metadata in Redis
7. **Subscription Creation** - Set up message routing

##### Request Headers

```http
Authorization: Bearer <factory_jwt_token>
X-Device-PIN: 123456
X-Device-MAC: AA:BB:CC:DD:EE:FF
```

##### Response

```json
{
  "success": true,
  "data": {
    "deviceId": "device_uuid",
    "pin": "123456",
    "status": "PENDING_CLAIM",
    "expiresAt": "2025-01-12T03:47:56Z"
  }
}
```

### Phase 2: Device Listening (SSE Connection)

#### Device Listen Endpoint

**File**: [`src/routes/api/device/listen/+server.ts`](../../src/routes/api/device/listen/+server.ts)

##### Listen Flow

1. **API Key Authentication** - Validate device API key
2. **SSE Connection** - Establish Server-Sent Events stream
3. **Message Subscription** - Subscribe to device-specific channels
4. **Real-time Communication** - Receive server commands and updates

##### Request Headers

```http
x-api-key: <device_api_key>
```

##### Response

Server-Sent Events stream with real-time messages:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "device:claim", "action": "claim", "deviceId": "device_uuid", "payload": {...}}

data: {"type": "device:status", "action": "status", "deviceId": "device_uuid", "payload": {...}}
```

#### Pushpin Listen Endpoint (Alternative)

**File**: [`src/routes/api/device/pushpin/listen/+server.ts`](../../src/routes/api/device/pushpin/listen/+server.ts)

- **Pushpin Integration** - Uses Pushpin proxy for WebSocket/SSE
- **GRIP Headers** - For message routing and connection management
- **Same Authentication** - Uses API key for device validation

### Phase 3: JWT Token Acquisition

#### JWT Token Endpoint

**File**: [`src/routes/api/device/jwt/+server.ts`](../../src/routes/api/device/jwt/+server.ts)

##### JWT Generation Flow

1. **API Key Authentication** - Validate device API key via `restrictDevice` guard
2. **Device Lookup** - Find device in database by API key
3. **Signing Key Retrieval** - Get active JWT signing key from database
4. **Token Generation** - Create JWT with device claims
5. **Token Response** - Return JWT token for API access

##### Request Headers

```http
x-api-key: <device_api_key>
```

##### Response

```json
{
  "success": true,
  "data": {
    "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "deviceId": "device_uuid"
  }
}
```

##### JWT Token Claims

```json
{
  "deviceId": "device_uuid",
  "accountId": "account_uuid", 
  "userId": "user_uuid",
  "deviceName": "Device Name",
  "iss": "fs04",
  "aud": "https://fs04.datarealities.com",
  "sub": "device_uuid",
  "exp": 1641974400,
  "iat": 1641970800,
  "kid": "signing_key_id"
}
```

### Complete Device Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE DEVICE FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        PHASE 1: REGISTRATION                          │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Device    │  │   Factory   │  │   Server    │  │   Database  │    │    │
│  │  │   Client    │  │    JWT      │  │ Registration│  │   Storage   │    │    │
│  │  │   (Go)      │  │   Token     │  │src/routes/  │  │             │    │    │
│  │  │             │  │             │  │api/device/  │  │ • Device    │    │    │
│  │  │ • Generate  │  │ • Verify    │  │register/    │  │   Record    │    │    │
│  │  │   PIN       │  │   JWT       │  │+server.ts   │  │ • SSE       │    │    │
│  │  │ • Send      │  │ • Extract   │  │             │  │   Stream    │    │    │
│  │  │   Request   │  │   Claims    │  │ • Validate  │  │ • Redis     │    │    │
│  │  │ • Wait for  │  │ • Check     │  │   JWT       │  │   Cache     │    │    │
│  │  │   Claim     │  │   Scope     │  │ • Create    │  │             │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        PHASE 2: LISTENING                             │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Device    │  │   API Key   │  │   SSE       │  │   Message   │    │    │
│  │  │   Client    │  │   Auth      │  │ Connection  │  │   Router    │    │    │
│  │  │   (Go)      │  │             │  │src/routes/  │  │src/lib/     │    │    │
│  │  │             │  │ • Validate  │  │api/device/  │  │server/      │    │    │
│  │  │ • Connect   │  │   Key       │  │listen/      │  │messaging/   │    │    │
│  │  │   SSE       │  │ • Get       │  │+server.ts   │  │             │    │    │
│  │  │ • Receive   │  │   Device    │  │             │  │ • Route     │    │    │
│  │  │   Messages  │  │   Info      │  │ • Stream    │  │   Messages  │    │    │
│  │  │ • Handle    │  │ • Check     │  │ • Subscribe │  │ • Publish   │    │    │
│  │  │   Commands  │  │   Status    │  │ • Cleanup   │  │ • Broadcast │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        PHASE 3: JWT TOKEN                             │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Device    │  │   API Key   │  │   JWT       │  │   API       │    │    │
│  │  │   Client    │  │   Auth      │  │ Generator   │  │   Access    │    │    │
│  │  │   (Go)      │  │             │  │src/routes/  │  │             │    │    │
│  │  │             │  │ • Validate  │  │api/device/  │  │ • Apps      │    │    │
│  │  │ • Request   │  │   Key       │  │jwt/         │  │   API       │    │    │
│  │  │   JWT       │  │ • Get       │  │+server.ts   │  │ • Resources │    │    │
│  │  │ • Use JWT   │  │   Device    │  │             │  │   API       │    │    │
│  │  │   for APIs  │  │   Claims    │  │ • Generate  │  │ • Messages  │    │    │
│  │  │ • Refresh   │  │ • Check     │  │   Token     │  │   API       │    │    │
│  │  │   Token     │  │   Expiry    │  │ • Sign      │  │ • Status    │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Device Flow Code Examples

#### Go Device Client Example

```go
// Phase 1: Device Registration
func registerDevice(factoryJWT, pin, mac string) (*DeviceRegistration, error) {
    req, _ := http.NewRequest("GET", "http://localhost:5173/api/device/register", nil)
    req.Header.Set("Authorization", "Bearer "+factoryJWT)
    req.Header.Set("X-Device-PIN", pin)
    req.Header.Set("X-Device-MAC", mac)
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Data struct {
            DeviceID string `json:"deviceId"`
            PIN      string `json:"pin"`
            Status   string `json:"status"`
        } `json:"data"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    
    return &DeviceRegistration{
        DeviceID: result.Data.DeviceID,
        PIN:      result.Data.PIN,
        Status:   result.Data.Status,
    }, nil
}

// Phase 2: Device Listening
func listenForMessages(apiKey string) {
    req, _ := http.NewRequest("GET", "http://localhost:5173/api/device/listen", nil)
    req.Header.Set("x-api-key", apiKey)
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()
    
    scanner := bufio.NewScanner(resp.Body)
    for scanner.Scan() {
        line := scanner.Text()
        if strings.HasPrefix(line, "data: ") {
            var message map[string]interface{}
            json.Unmarshal([]byte(line[6:]), &message)
            handleMessage(message)
        }
    }
}

// Phase 3: JWT Token Acquisition
func getJWTToken(apiKey string) (string, error) {
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

// Using JWT for API calls
func getAvailableApps(jwtToken string) ([]App, error) {
    req, _ := http.NewRequest("GET", "http://localhost:5173/api/apps/available-jwt", nil)
    req.Header.Set("Authorization", "Bearer "+jwtToken)
    
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

#### Python Device Client Example

```python
import requests
import json
import time

class DeviceClient:
    def __init__(self, base_url="http://localhost:5173"):
        self.base_url = base_url
        self.api_key = None
        self.jwt_token = None
    
    # Phase 1: Device Registration
    def register(self, factory_jwt, pin, mac):
        headers = {
            "Authorization": f"Bearer {factory_jwt}",
            "X-Device-PIN": pin,
            "X-Device-MAC": mac
        }
        
        response = requests.get(f"{self.base_url}/api/device/register", headers=headers)
        response.raise_for_status()
        
        data = response.json()["data"]
        print(f"Device registered: {data['deviceId']}")
        return data
    
    # Phase 2: Device Listening
    def listen(self, api_key):
        self.api_key = api_key
        headers = {"x-api-key": api_key}
        
        response = requests.get(f"{self.base_url}/api/device/listen", 
                              headers=headers, stream=True)
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line.startswith(b"data: "):
                message = json.loads(line[6:])
                self.handle_message(message)
    
    # Phase 3: JWT Token Acquisition
    def get_jwt_token(self):
        if not self.api_key:
            raise ValueError("API key not set")
        
        headers = {"x-api-key": self.api_key}
        response = requests.get(f"{self.base_url}/api/device/jwt", headers=headers)
        response.raise_for_status()
        
        self.jwt_token = response.json()["data"]["jwt"]
        return self.jwt_token
    
    # Using JWT for API calls
    def get_available_apps(self):
        if not self.jwt_token:
            self.get_jwt_token()
        
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = requests.get(f"{self.base_url}/api/apps/available-jwt", headers=headers)
        response.raise_for_status()
        
        return response.json()["data"]["apps"]
    
    def handle_message(self, message):
        message_type = message.get("type")
        
        if message_type == "device:claim":
            # Device has been claimed, store API key
            self.api_key = message["payload"]["apiKey"]
            print(f"Device claimed! API key: {self.api_key}")
        
        elif message_type == "device:status":
            # Handle status update request
            self.send_status_update()
        
        elif message_type == "device:pushFile":
            # Handle file push request
            self.handle_file_push(message["payload"])
        
        # Add more message handlers as needed

# Usage example
if __name__ == "__main__":
    client = DeviceClient()
    
    # Phase 1: Register device
    factory_jwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    pin = "123456"
    mac = "AA:BB:CC:DD:EE:FF"
    
    registration = client.register(factory_jwt, pin, mac)
    
    # Phase 2: Listen for messages (this will block until device is claimed)
    try:
        client.listen(registration.get("apiKey", "temp-key"))
    except KeyboardInterrupt:
        print("Stopping device client...")
    
    # Phase 3: Get JWT and use APIs
    jwt_token = client.get_jwt_token()
    apps = client.get_available_apps()
    print(f"Available apps: {len(apps)}")
```

### Flow Summary

1. **Registration**: Device uses factory JWT token to register and get a PIN
2. **Listening**: Device establishes SSE connection using API key to receive real-time commands
3. **JWT Acquisition**: Device uses API key to get JWT tokens for API access
4. **API Usage**: Device uses JWT tokens to access protected endpoints like apps, resources, etc.

The key distinction is:
- **Factory JWT Token**: Used only for device registration (one-time use)
- **API Key**: Used for device authentication and JWT token generation (persistent)
- **JWT Token**: Used for API access (short-lived, needs refresh)

---

## 🔐 Device Authentication

### API Key Authentication

**File**: [`src/lib/server/device/deviceAuth.ts`](../../src/lib/server/device/deviceAuth.ts)

- **API Key Validation** from `x-api-key` header
- **Device Lookup** with user information
- **Access Control** via ZenStack policies
- **Audit Logging** for security events

### JWT Token Generation

**File**: [`src/routes/api/device/jwt/+server.ts`](../../src/routes/api/device/jwt/+server.ts)

- **Device JWT Creation** with device claims
- **Token Expiration** management
- **Scope-based Access** control
- **Refresh Token** support

### Device Service

**File**: [`src/lib/server/device/deviceService.ts`](../../src/lib/server/device/deviceService.ts)

- **Device Lookup** by API key or ID
- **User Information** retrieval
- **Account Association** management
- **Error Handling** and logging

---

## 🏷️ Device Lifecycle Management

### Device Manager

**File**: [`src/lib/server/device/deviceManager.ts`](../../src/lib/server/device/deviceManager.ts)

#### Key Features

- **Device Registration** with PIN mapping
- **Device Claiming** with user assignment
- **API Key Generation** and rotation
- **Status Management** and tracking
- **Audit Logging** for all operations

#### Device Claiming Process

1. **PIN Validation** - Verify PIN exists and is valid
2. **User Assignment** - Associate device with user account
3. **API Key Generation** - Create unique API key
4. **Database Update** - Store device information
5. **Notification** - Send claim confirmation to device
6. **Cleanup** - Remove PIN from temporary storage

### Device Status Manager

**File**: [`src/lib/server/device/deviceStatusManager.ts`](../../src/lib/server/device/deviceStatusManager.ts)

- **Connection Tracking** - Monitor device online/offline status
- **Status Publishing** - Broadcast status changes via Redis
- **Health Monitoring** - Track device health metrics
- **Automatic Cleanup** - Remove stale connections

---

## 📊 Device Database Schema

### Device Model

**File**: [`prisma/schema.prisma`](../../prisma/schema.prisma)

```prisma
model Device {
  id                   String                   @id() @default(cuid())
  createdAt            DateTime                 @default(now())
  updatedAt            DateTime                 @updatedAt()
  name                 String
  description          String?
  status               String                   @default("ACTIVE")
  expiresAt            DateTime?
  lastUsedAt           DateTime?
  createdBy            String
  user                 User                     @relation(fields: [createdBy], references: [id])
  accountId            String?
  account              Account?                 @relation(fields: [accountId], references: [id])
  companyId            String?
  company              Company?                 @relation(fields: [companyId], references: [id])
  deviceType           String?
  model                String?
  manufacturer         String?
  osVersion            String?
  firmwareVersion      String?
  hardwareId           String?
  macAddress           String?
  wifiMac              String?
  lanMac               String?
  ipAddress            String?
  apiKey               String?                  @unique()
  apiKeyCreatedAt      DateTime?
  apiKeyRotatedAt      DateTime?
  claimedAt            DateTime?
  claimedBy            String?
  connected            Boolean                  @default(false)
  connectedAt          DateTime?
  disconnectedAt       DateTime?
  
  @@index([createdBy])
  @@index([hardwareId])
  @@index([status])
  @@index([accountId])
  @@index([apiKey])
}
```

### Preclaim Device Model

```prisma
model PreclaimDevice {
  id          String      @id() @default(cuid())
  macId       String
  name        String?
  description String?
  status      ClaimStatus @default(PENDING)
  expiresAt   DateTime?
  claimedAt   DateTime?
  claimedBy   String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt()
  accountId   String
  account     Account     @relation(fields: [accountId], references: [id])
  setId       String
  set         PreclaimSet @relation(fields: [setId], references: [id])
  deviceId    String?
  device      Device?     @relation(fields: [deviceId], references: [id])
  
  @@unique([setId, macId])
  @@index([macId])
  @@index([status])
  @@index([expiresAt])
  @@index([accountId])
}
```

---

## 🔌 Device API Endpoints

### Device Registration

#### `GET /api/device/register`

**Purpose**: Register new device with factory JWT and PIN

**Headers**:
```http
Authorization: Bearer <factory_jwt_token>
X-Device-PIN: 123456
X-Device-MAC: AA:BB:CC:DD:EE:FF
```

**Response**:
```json
{
  "success": true,
  "data": {
    "deviceId": "device_uuid",
    "pin": "123456",
    "status": "PENDING_CLAIM",
    "expiresAt": "2025-01-12T03:47:56Z"
  }
}
```

### Device Addition

#### `POST /api/device/add`

**Purpose**: Add device information after claiming

**Headers**:
```http
x-api-key: <device_api_key>
```

**Body**:
```json
{
  "deviceType": "ANDROID",
  "model": "Pixel 7",
  "manufacturer": "Google",
  "osVersion": "13",
  "firmwareVersion": "1.0.0",
  "hardwareId": "hardware_id",
  "wifiMac": "AA:BB:CC:DD:EE:FF",
  "lanMac": "AA:BB:CC:DD:EE:FF",
  "ipAddress": "192.168.1.100",
  "additionalInfo": {}
}
```

### Device Authentication

#### `POST /api/device/jwt`

**Purpose**: Generate JWT token for device

**Headers**:
```http
x-api-key: <device_api_key>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "expiresIn": 3600,
    "deviceId": "device_uuid"
  }
}
```

### Device Apps

#### `GET /api/device/apps/available`

**Purpose**: List available apps for device

**Headers**:
```http
Authorization: Bearer <device_jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "apps": [
      {
        "resource_id": "resource_uuid",
        "package_name": "com.example.app",
        "app_name": "Example App",
        "version": "1.0.0",
        "size": 1048576,
        "type": "file",
        "format": "apk",
        "download_url": "/api/device/resources/resource_uuid"
      }
    ]
  }
}
```

### Device Resources

#### `GET /api/device/resources/[id]`

**Purpose**: Download resource files

**Headers**:
```http
Authorization: Bearer <device_jwt_token>
```

**Response**: 302 Redirect to file location

### Device Messages

#### `POST /api/device/message`

**Purpose**: Send messages from device to server

**Headers**:
```http
x-api-key: <device_api_key>
```

**Body**:
```json
{
  "type": "status_update",
  "data": {
    "status": "online",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

### Device SSE Connection

#### `GET /api/device/pushpin/listen`

**Purpose**: Establish SSE connection for real-time communication

**Headers**:
```http
x-api-key: <device_api_key>
```

**Response**: Server-Sent Events stream

---

## 📨 Server-to-Device Actions & Device Responses

### Server Actions to Devices

The server can send various actions to devices via SSE/WebSocket connections. Each action has specific payloads and expected device responses.

#### 1. Device Claiming Actions

**Action**: `claim`
**Purpose**: Notify device that it has been claimed by a user

**Server → Device Message**:
```json
{
  "type": "device:claim",
  "action": "claim",
  "deviceId": "device_uuid",
  "payload": {
    "userInfo": {
      "userId": "user_uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "apiKey": "device_api_key",
    "accountId": "account_uuid",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:registered",
  "action": "register",
  "deviceId": "device_uuid",
  "payload": {
    "deviceType": "ANDROID",
    "model": "Pixel 7",
    "manufacturer": "Google",
    "osVersion": "13",
    "firmwareVersion": "1.0.0",
    "hardwareId": "hardware_id",
    "wifiMac": "AA:BB:CC:DD:EE:FF",
    "lanMac": "AA:BB:CC:DD:EE:FF",
    "ipAddress": "192.168.1.100",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 2. Status Update Actions

**Action**: `status`
**Purpose**: Request device status update or receive status from device

**Server → Device Message**:
```json
{
  "type": "device:status",
  "action": "status",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:status",
  "action": "status",
  "deviceId": "device_uuid",
  "payload": {
    "status": "online",
    "batteryLevel": 85,
    "storage": {
      "total": 128000000000,
      "free": 64000000000
    },
    "network": {
      "connected": true,
      "type": "wifi",
      "signal": -45
    },
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 3. File Operations

**Action**: `pushFile`
**Purpose**: Push file to device

**Server → Device Message**:
```json
{
  "type": "device:pushFile",
  "action": "pushFile",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "fileId": "file_uuid",
    "fileName": "app.apk",
    "fileSize": 1048576,
    "fileType": "application/vnd.android.package-archive",
    "destination": "/sdcard/Downloads/",
    "checksum": "sha256:abc123...",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:pushFile",
  "action": "pushFile",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "message": "File received successfully",
    "filePath": "/sdcard/Downloads/app.apk",
    "checksum": "sha256:abc123...",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Action**: `pullFile`
**Purpose**: Pull file from device

**Server → Device Message**:
```json
{
  "type": "device:pullFile",
  "action": "pullFile",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "filePath": "/sdcard/DCIM/screenshot.png",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:pullFile",
  "action": "pullFile",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "fileName": "screenshot.png",
    "fileSize": 2048576,
    "fileData": "base64_encoded_data...",
    "checksum": "sha256:def456...",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 4. App Management

**Action**: `installApp`
**Purpose**: Install application on device

**Server → Device Message**:
```json
{
  "type": "device:installApp",
  "action": "installApp",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "appId": "app_uuid",
    "packageName": "com.example.app",
    "version": "1.0.0",
    "filePath": "/sdcard/Downloads/app.apk",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:installApp",
  "action": "installApp",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "message": "App installed successfully",
    "packageName": "com.example.app",
    "version": "1.0.0",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 5. Firmware Updates

**Action**: `updateFirmware`
**Purpose**: Update device firmware

**Server → Device Message**:
```json
{
  "type": "device:updateFirmware",
  "action": "updateFirmware",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "firmwareId": "firmware_uuid",
    "version": "2.0.0",
    "filePath": "/sdcard/Downloads/firmware.bin",
    "checksum": "sha256:ghi789...",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:updateFirmware",
  "action": "updateFirmware",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "message": "Firmware updated successfully",
    "oldVersion": "1.0.0",
    "newVersion": "2.0.0",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 6. Log Retrieval

**Action**: `getLogs`
**Purpose**: Request device logs

**Server → Device Message**:
```json
{
  "type": "device:getLogs",
  "action": "getLogs",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "format": "zip",
    "logTypes": ["system", "application", "crash"],
    "timeRange": {
      "start": "2025-01-11T00:00:00Z",
      "end": "2025-01-12T00:00:00Z"
    },
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:getLogs",
  "action": "getLogs",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "logId": "log_uuid",
    "format": "zip",
    "fileSize": 1048576,
    "logsData": "base64_encoded_zip...",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 7. WebRTC Communication

**Action**: `webrtc:connect`
**Purpose**: Initiate WebRTC connection for terminal/remote desktop

**Server → Device Message**:
```json
{
  "type": "device:webrtc:connect",
  "action": "webrtc:connect",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "connectionType": "terminal",
    "offer": {
      "type": "offer",
      "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
    },
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:webrtc:answer",
  "action": "webrtc:answer",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "answer": {
      "type": "answer",
      "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
    },
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 8. Screenshot Capture

**Action**: `screenshot:request`
**Purpose**: Request device screenshot

**Server → Device Message**:
```json
{
  "type": "device:screenshot:request",
  "action": "screenshot:request",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "format": "png",
    "quality": 80,
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:screenshot:response",
  "action": "screenshot:response",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "imageData": "base64_encoded_image...",
    "format": "png",
    "width": 1080,
    "height": 1920,
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 9. Bundle Status Updates

**Action**: `bundleStatus`
**Purpose**: Update bundle installation progress

**Server → Device Message**:
```json
{
  "type": "device:bundleStatus",
  "action": "bundleStatus",
  "deviceId": "device_uuid",
  "payload": {
    "bundleId": "bundle_uuid",
    "waveId": "wave_uuid",
    "status": "installing",
    "progress": 50,
    "message": "Installing app 2 of 4",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:bundleStatus",
  "action": "bundleStatus",
  "deviceId": "device_uuid",
  "payload": {
    "bundleId": "bundle_uuid",
    "waveId": "wave_uuid",
    "status": "completed",
    "progress": 100,
    "message": "All apps installed successfully",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### 10. System Commands

**Action**: `reboot`
**Purpose**: Reboot device

**Server → Device Message**:
```json
{
  "type": "device:reboot",
  "action": "reboot",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "delay": 30,
    "reason": "maintenance",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

**Device Response**:
```json
{
  "type": "device:reboot",
  "action": "reboot",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "message": "Device will reboot in 30 seconds",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

### Device Response Patterns

#### Success Response Pattern
```json
{
  "type": "device:{action}",
  "action": "{action}",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": true,
    "message": "Operation completed successfully",
    "data": { /* action-specific data */ },
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### Error Response Pattern
```json
{
  "type": "device:{action}",
  "action": "{action}",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "success": false,
    "error": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { /* additional error details */ },
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

#### Progress Update Pattern
```json
{
  "type": "device:{action}:progress",
  "action": "{action}",
  "deviceId": "device_uuid",
  "payload": {
    "requestId": "request_uuid",
    "progress": 75,
    "message": "Processing step 3 of 4",
    "currentStep": "installing",
    "totalSteps": 4,
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

### Action Timeouts

| Action | Timeout | Description |
|--------|---------|-------------|
| `claim` | 30s | Device claiming process |
| `register` | 60s | Device registration |
| `status` | 10s | Status update request |
| `pushFile` | 5min | File upload to device |
| `pullFile` | 5min | File download from device |
| `installApp` | 10min | App installation |
| `updateFirmware` | 30min | Firmware update |
| `getLogs` | 5min | Log retrieval |
| `webrtc:connect` | 30s | WebRTC connection setup |
| `screenshot:request` | 2min | Screenshot capture |
| `bundleStatus` | 1min | Bundle status update |
| `reboot` | 60s | Device reboot |

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `DEVICE_OFFLINE` | Device not connected | Retry when online |
| `INVALID_REQUEST` | Malformed request | Fix request format |
| `PERMISSION_DENIED` | Insufficient permissions | Check user roles |
| `FILE_NOT_FOUND` | File doesn't exist | Verify file path |
| `INSUFFICIENT_STORAGE` | Not enough storage | Free up space |
| `INSTALLATION_FAILED` | App install failed | Check app compatibility |
| `NETWORK_ERROR` | Network connectivity issue | Check network |
| `TIMEOUT` | Operation timed out | Retry operation |
| `UNKNOWN_ERROR` | Unexpected error | Check logs |

---

## 🔒 Security Features

### Factory JWT Security

- **RSA/ECDSA Signatures** - Strong cryptographic validation
- **Key Rotation** - Support for multiple signing keys
- **Audience Validation** - Restrict to device registration
- **Scope-based Access** - Fine-grained permissions

### API Key Security

- **Unique Keys** - Each device has unique API key
- **Key Rotation** - Support for API key rotation
- **Rate Limiting** - Prevent abuse and DoS attacks
- **Audit Logging** - Track all API key usage

### Device Authentication

- **MAC Address Validation** - Prevent device spoofing
- **PIN Expiration** - Time-limited registration windows
- **Preclaim Validation** - Verify device pre-authorization
- **Access Control** - ZenStack-based permissions

### Network Security

- **HTTPS Only** - Encrypted communication
- **CORS Configuration** - Restrict cross-origin requests
- **Rate Limiting** - Prevent abuse
- **IP Whitelisting** - Optional IP-based restrictions

---

## 📈 Performance & Scalability

### Connection Management

- **Connection Pooling** - Efficient resource usage
- **Load Balancing** - Distribute device connections
- **Auto-scaling** - Handle traffic spikes
- **Health Checks** - Monitor service health

### Database Optimization

- **Indexed Queries** - Fast device lookups
- **Connection Pooling** - Efficient database usage
- **Read Replicas** - Distribute read load
- **Caching** - Redis for frequently accessed data

### Message Processing

- **Batch Processing** - Efficient message handling
- **Queue Management** - Reliable message delivery
- **Dead Letter Queues** - Handle failed messages
- **Monitoring** - Track message throughput

---

## 🧪 Testing & Monitoring

### Device Testing

**Load Testing Script**: [`load-test-device-registration.js`](../../load-test-device-registration.js)

- **Concurrent Registration** - Test multiple device registrations
- **Connection Limits** - Verify system capacity
- **Error Handling** - Test failure scenarios
- **Performance Metrics** - Measure response times

### Monitoring

- **Device Metrics** - Track device counts and status
- **API Performance** - Monitor response times
- **Error Rates** - Track failure rates
- **Security Events** - Monitor authentication failures

### Health Checks

- **Database Connectivity** - Verify database access
- **Redis Connectivity** - Check cache availability
- **External Services** - Monitor dependencies
- **Device Connectivity** - Track device online status

---

## 🔧 Troubleshooting

### Common Issues

1. **Device Registration Failures**
   - Check factory JWT validity
   - Verify PIN format and expiration
   - Ensure MAC address uniqueness
   - Check preclaim status

2. **Authentication Errors**
   - Validate API key format
   - Check device status in database
   - Verify user permissions
   - Review audit logs

3. **Connection Issues**
   - Check network connectivity
   - Verify SSE endpoint availability
   - Review Pushpin configuration
   - Monitor connection limits

4. **Performance Problems**
   - Check database query performance
   - Monitor Redis memory usage
   - Review connection pool settings
   - Analyze load balancer metrics

### Debug Commands

**Device Status Check**:
```bash
# Check device in database
psql -c "SELECT id, name, status, connected, apiKey FROM Device WHERE macAddress = 'AA:BB:CC:DD:EE:FF';"

# Check Redis device data
redis-cli GET "device:device_uuid"
```

**API Key Validation**:
```bash
# Test API key authentication
curl -H "x-api-key: device_api_key" http://localhost:3000/api/device/jwt
```

**SSE Connection Test**:
```bash
# Test SSE connection
curl -H "x-api-key: device_api_key" http://localhost:3000/api/device/pushpin/listen
```

---

## 📚 Related Documentation

- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Complete system design
- [Real-Time Communication](./REAL_TIME_COMMUNICATION.md) - SSE, WebSocket, and WebRTC
- [Troubleshooting](./TROUBLESHOOTING.md) - All fixes and debugging guides

---

## 🔑 Key Takeaways

1. **Factory JWT Security** - Strong authentication for device registration
2. **PIN-based Claiming** - Simple user-friendly device claiming process
3. **API Key Management** - Secure device authentication and authorization
4. **Real-time Communication** - SSE for device status and control
5. **Scalable Architecture** - Handle 100k+ devices with proper load balancing
6. **Comprehensive Monitoring** - Track device health and performance
7. **Security First** - Multiple layers of security and validation
8. **Audit Trail** - Complete logging of all device operations

---

**Status**: ✅ Production ready with comprehensive security and monitoring.
