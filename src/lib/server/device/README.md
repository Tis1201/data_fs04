# Device Registration & Claim Flow (Stable Overview)

This section summarizes the latest, stable, production-ready flow for device onboarding, registration, and user claim:

## Executive Overview

1. **Device Registration & Initial Connection**
   - Device initiates an SSE connection, passing a Factory JWT Token and a generated PIN.
   - JWT Token and PIN are validated for authenticity, strength, and format.
   - A UUID is generated for the device.
   - The PIN is mapped to the device UUID in the DeviceManager (transient, with expiration).

2. **Subscription Management**
   - A subscription is created for the device: `subscription:device:uuid` → `subscriber:connection:uuid`.
   - If SSE disconnects, both the subscription and the PIN-UUID mapping are removed (resource cleanup).

3. **Device Claim by User**
   - System waits for a user to claim the device (via web/mobile UI).
   - On claim:
     - DeviceManager is updated with the User ID for the device.
     - A message is sent to `subscription:device:uuid`, routed to `subscriber:connection:connectionId` to notify the device that it has been claimed. The message includes `userInfo`, `api_key`, and `device_id`.
     - Device receives the message, stores info securely, and disconnects (causing the subscription to disappear).

4. **Device Registration Confirmation & User Notification**
   - Device calls `/device/registered` to confirm successful registration, providing metadata (OS, model, etc).
   - Routing message is sent to `user:userId` so all user connections are notified of the new device.
   - Device then connects to `/device/listen` using the API Key for ongoing communication.

5. **Security, State, and Cleanup**
   - All transitions (registration, claim, disconnect) update device and connection state.
   - Stale or orphaned records are cleaned up on disconnect or timeout.
   - All sensitive operations are authenticated and authorized; API keys are validated on every reconnect.
   - All steps return clear error messages on failure (invalid token, expired PIN, etc).
   - All registration, claim, and connection events are logged for audit and troubleshooting.

---

## Implementation Details

### Device Registration
- The `registerDevice` function ensures that each device is registered with a unique PIN.
- The function is asynchronous, using `await` for database operations to check PIN availability before registration.
- Logs are added to track the registration process and any errors encountered.

### SSE Connection
- A ping mechanism is implemented to keep the SSE connection alive.
- Error handling is in place for connection failures and message sending issues.

### Device Manager
- Manages device onboarding, PIN validation, and user claiming processes.
- Ensures devices are registered with unique PINs to prevent conflicts.

---

## Structure

| File | Purpose |
|:-----|:--------|
| `factoryTokenVerifier.ts` | Verifies the shared factory JWT token during device registration. |
| `deviceManager.ts` | Handles device onboarding, PIN validation, user claiming, API key generation, and credential issuing. |
| `deviceStore.ts` | Provides database operations for pending devices, PIN management, API key storage, and claimed device records. |
| `jwtIssuer.ts` | Centralized module for signing JWT tokens for devices and users. |
| `schemas.ts` (optional) | Defines Zod/Valibot schemas for validating device payloads and operations. |
| `utils.ts` (optional) | Utility functions for tasks like PIN expiration checks, API key generation, etc. |

## Workflow Overview

### 1. Device Registration
- Device boots up and generates its own **random PIN**.
- Device connects to the server using a **shared factory JWT**.
- Device sends:
  - **Device ID**
  - **Generated PIN**
  - **Factory JWT**
- Server verifies the JWT and temporarily registers the device and its PIN.

### 2. User Claiming
- User opens the Add Device page and enters:
  - **Device ID** (optional if PINs are globally unique)
  - **PIN** (shown on device)
- Backend validates:
  - PIN matches the pending device
  - PIN is not expired
  - Device is not already claimed
- If successful:
  - A **Device object** is created and linked to the user's account.
  - An **API Key** is generated and securely sent to the device.

### 3. Device Credentialing
- The device stores the API Key securely.
- When booting or refreshing, the device authenticates by:
  - Sending its **API Key** to request a **short-lived JWT** (typically 1 hour).
- The server issues a signed JWT.
- The device uses the JWT for secure communications.

### 4. Real-time Communication (Event Flow)
- **Initial Phase**:  
  - Devices use **Server-Sent Events (SSE)** to maintain a connection to receive commands and updates.
  - **Endpoint**: `/api/device/{deviceId}`
  - **Authentication**: JWT token in Authorization header
  - **Example Request**:
    ```bash
    curl -i -N \
      -H "Authorization: Bearer <JWT_TOKEN>" \
      http://localhost:5173/api/device/device_123
    ```
  - **Security**:
    - All requests must include a valid JWT token
    - Tokens are short-lived (typically 1 hour)
    - Device authentication required before obtaining JWT
  - **Connection Management**:
    - Automatic reconnection on disconnect
    - Heartbeat mechanism to maintain connection
    - Error handling and retry logic implemented
- **Scaling Phase**:  
  - Switch to using **PushPin** (with NGINX) to efficiently handle millions of concurrent SSE/WebSocket connections without overloading app servers.
- **Cloud-native Phase**:
  - Migrate to **AWS IoT Core** with MQTT using the same messaging structure.
  - Devices publish/subscribe to MQTT topics while preserving the same event format.

## Device Object Fields

| Field | Type | Notes |
|:------|:----|:------|
| `id` | UUID | Internal device object ID. |
| `deviceId` | string | Hardware or factory device ID. |
| `accountId` | UUID | User account that owns the device. |
| `wifiMac` | string | WiFi MAC address of device (optional). |
| `lanMac` | string | LAN MAC address (optional). |
| `firmwareVersion` | string | Firmware version reported by device. |
| `apiKey` | string | Unique secret key used for requesting JWTs. |
| `apiKeyCreatedAt` | timestamp | When the API key was issued. |
| `apiKeyRotatedAt` | timestamp | When the API key was last rotated. |
| `claimedAt` | timestamp | Timestamp when device was claimed. |
| `status` | string | Device state (e.g., active, suspended). |

## Messaging Structure

All device communications use a **common event format** (JSON), ensuring easy migration across transports (SSE, PushPin, AWS IoT).

Example incoming command:

```json
{
  "type": "command",
  "command": "reboot",
  "payload": {}
}
