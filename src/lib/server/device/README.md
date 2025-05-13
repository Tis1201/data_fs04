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

### Device Registration & Claiming
- The `registerDevice` and `addDevice` flows ensure that each device is registered with a unique PIN and securely claimed by a user.
- Device ID and PIN are validated for correctness and uniqueness.
- Upon successful claim, an API key is generated and securely sent to the device.
- The claim and registration process uses structured logging for all major events and errors.

### Error Handling & Messaging
- Error handling is robust: all errors are logged with context and stack traces in development.
- Error and success messages are routed using either connection or user scope, depending on the stage:
    - **Claim errors**: sent to the user's connection for accurate UI feedback.
    - **Success (claimed/registered)**: sent to the user's connection or user scope for UI updates.
- Messages use a consistent JSON structure: `{ type, payload: { action, success, ... }, ... }`.
- All error messages include a code, details, and a unique requestId for traceability.

### Device Store (Frontend)
- The SvelteKit frontend uses a device store (`device-store.ts`) with a robust state machine:
    - Listens for all device events via WebSocket.
    - Handles `error`, `registered`, and `claimed` actions using a `switch` statement for maintainability.
    - Updates state reactively for UI display (claim status, error, device info).
    - TypeScript interfaces ensure type safety for all message payloads.

### Testing & Dummy Device Script
- The `/tests/device/dummy_device.py` script is used for end-to-end testing:
    - Simulates device registration, SSE connection, and claim flow.
    - Prints all received server events and errors for debugging.
    - Validates that error and success messages are delivered and formatted correctly.

### Logging & Security
- All sensitive operations are authenticated and authorized.
- All registration, claim, and connection events are logged for audit and troubleshooting.
- Device credentials (API keys) are never exposed to unauthorized users.

---

## Recent Improvements (2025-05)

- **Error Handling**: Improved error propagation and UI display for device registration and claim failures.
- **Message Routing**: All claim/registration events are routed to the correct user or connection, ensuring reliable delivery.
- **Type Safety**: Device store and backend messaging now use strict TypeScript interfaces.
- **Testing**: Dummy device script enhanced for better error reporting and flow validation.
- **Frontend**: Device claim UI now updates reactively on success or error, using the improved store logic.

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

## To Dos
- User UI claim should be sent over websocket and set the senderId, sender connectionId in the routing message
- Add api key to registered message
- When device rx registered message, send pin, device id, api key, system info to finish claim process
- Save all these information to DB
- Send a claimed message to user for updating ui

---

## Debugging

For WebRTC debugging, use Chrome's built-in WebRTC internals page:
- `chrome://webrtc-internals/` — View WebRTC peer connections, stats, and logs