# WhatsApp Integration - FS04 Web

This directory contains the server-side and client-side logic for WhatsApp integration in the FS04 Web project.

## Structure

- **WhatsAppAccountManager.ts**: Manages WhatsApp client instances, session restoration, and QR code generation.
- **WhatsAppAccountClient.ts**: Represents a single WhatsApp account connection, handles connection state, QR code events, and messaging.
- **whatsappHandler.ts**: Handles incoming WebSocket messages for WhatsApp actions (e.g., QR code requests, message relaying).
- **useZenstackAuthState.ts**: (See below)

## How It Works

1. **Client requests QR code**: The web UI sends a `request_qr` action via WebSocket.
2. **Server creates client**: `WhatsAppAccountManager` creates a new WhatsApp client and emits a QR code event.
3. **QR code relayed to UI**: The QR code is sent back to the client and rendered as a QR image for WhatsApp pairing.
4. **Connection status**: The UI updates based on connection/authentication state changes received via WebSocket.

## Technologies Used
- [Baileys](https://github.com/WhiskeySockets/Baileys) for WhatsApp Web API
- SvelteKit for UI
- ZenStack for secure, declarative data access
- WebSockets for real-time updates

## Security Notes
- All authentication/session files are stored server-side (see `authDir` in `WhatsAppAccountManager`).
- Only authenticated users can request a WhatsApp connection.
- Use ZenStack for all sensitive data access and mutations.

## Troubleshooting
- If QR code does not appear, check browser console and server logs for errors.
- Ensure the WebSocket connection is established and not blocked by firewalls.
- If session issues persist, clear the `whatsapp-auth` directory and restart the server.

## About `useZenstackAuthState.ts`
This file appears to be a utility for integrating ZenStack authentication state with WhatsApp sessions. 

**Is it needed?**
- If you are not using ZenStack's advanced multi-user/session security features for WhatsApp, and there are no direct imports/usages in the WhatsApp account manager/client, you can safely remove it.
- If you use ZenStack for per-user data isolation or session-based access control in WhatsApp flows, keep it.

**Recommendation:**
I will check for references/usages of this file in the codebase to confirm if it is safe to delete.
