# WhatsApp Integration - FS04 Web

This directory contains all server-side and client-side logic for WhatsApp integration in the FS04 Web project.

---

## Implementation Summary

- **Architecture:**
  - Built on SvelteKit (UI/backend), ZenStack (secure DB access), Baileys (WhatsApp Web API), and a modular messaging library for all real-time features.
  - WhatsApp onboarding, QR code, and account management flows are handled using SuperForms, shadcn-svelte, and Svelte stores for state.

- **Key Modules:**
  - `WhatsAppAccountManager.ts`: Manages WhatsApp client instances, sessions, and QR code generation.
  - `WhatsAppAccountClient.ts`: Represents a single WhatsApp connection, manages state and events.
  - `whatsappHandler.ts`: Implements a messaging handler for WhatsApp actions via WebSocket.

- **Onboarding Flow:**
  1. Admin UI requests QR code via WebSocket.
  2. Server creates WhatsApp client, emits QR event.
  3. UI displays QR for user to pair device.
  4. Connection/auth state is relayed live to UI.
  5. On pairing, SuperForm submits WhatsApp account details to the backend.
  6. All validation (including UUID and Zod) is handled both client and server side.
  7. State is managed centrally in a Svelte store.

- **Security & Best Practices:**
  - All DB access and mutations use ZenStack (never raw Prisma).
  - Session/auth files are server-side only.
  - All WebSocket and HTTP actions are authenticated.
  - Remove dead code/utilities if not referenced.
  - Error messages are clear, actionable, and logged.
  - UI uses skeleton loaders for non-jumpy feedback.

---

## Relationship to the Messaging Library

- The messaging library provides the backbone for all real-time communication (WebSocket, event routing, authorization).
- WhatsApp integration is implemented as a **specialized handler** (`WhatsAppHandler`) in this library.
- The flow:
  1. UI sends a message (e.g. `{ type: 'whatsapp', action: 'request_qr', ... }`) via WebSocket.
  2. The messaging dispatcher routes it to `WhatsAppHandler`.
  3. The handler processes the action (QR, message, status, etc.) and publishes responses/events back to the correct clients.
- This ensures all WhatsApp features benefit from the same security, routing, and extensibility as the rest of the platform.

---

## Troubleshooting
- If QR code does not appear, check browser console and server logs for errors.
- Ensure the WebSocket connection is established and not blocked by firewalls.
- If session issues persist, clear the `whatsapp-auth` directory and restart the server.
- For "No open session" errors when sending messages:
  - Ensure the recipient's phone number is properly formatted with `@s.whatsapp.net` suffix
  - Check that the auth state is properly storing session data
  - The first message to a new contact requires establishing a new E2E encryption session

---

## Changelog

### 2025-04-30
- **E2E Encryption Session Handling:**
  - Improved session storage and retrieval in `useZenstackAuthState.ts` to properly handle WhatsApp's E2E encryption sessions
  - Added detailed logging for session operations to aid in debugging
  - Fixed phone number formatting to ensure proper JID format with `@s.whatsapp.net` suffix
  - Enhanced error handling in message sending to provide clearer error messages

### 2025-04-29
- **Session Error Handling:**
  - Added robust error handling for WhatsApp session errors (e.g., 'No open session') to prevent server crashes and log issues instead of terminating the process.
- **System/Protocol Message Filtering:**
  - Updated `WhatsAppAccountClient.handleMessages` to filter out system-level and protocol messages (such as key exchanges, ephemeral, and protocol messages). These are no longer emitted as routing messages or sent to subscribers, but are still processed for authentication state and media download as needed.
- **Routing Logic Improvements:**
  - Only user-facing messages (text, media, etc.) are routed to subscribers. System messages are logged and skipped for routing, reducing noise and preventing 'Unknown message action' warnings.
- **Encapsulation:**
  - Utility functions for WhatsApp account state are now encapsulated within the `WhatsAppAccountClient` class as private methods, improving maintainability.

## Best Practices
- Use ZenStack for all sensitive data access and mutations.
- Authenticate all requests.
- Use a single source of truth for WhatsApp state (Svelte store).
- Keep business logic in page/server, UI logic in presentational components.
- Server actions must always return `{ form }` (and `{ form, account }` on success) for SuperForms.
- Remove unused code/utilities.
- Use skeleton loaders for loading states.
- Prefix debug logs for easier tracing.

---

## Understanding E2E Encryption in WhatsApp

WhatsApp uses the Signal Protocol for end-to-end encryption, which has several important characteristics:

- **Per-Conversation Sessions**: Each conversation (with each contact) has its own unique cryptographic session
- **Session Establishment**: The first message to a new contact requires fetching their pre-keys and establishing a session
- **Session Persistence**: All session data must be properly stored and retrieved via the auth state implementation
- **JID Format**: WhatsApp IDs must be properly formatted as `{number}@s.whatsapp.net` for individual chats

## About `useZenstackAuthState.ts`
This file implements the auth state interface required by Baileys to store and retrieve cryptographic keys, sessions, and other state. It uses ZenStack/Prisma for persistence and is critical for proper E2E encryption functionality.
