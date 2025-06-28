# WhatsApp Integration - FS04 Web

This directory contains the server-side implementation of WhatsApp Web integration using the `@whiskeysockets/baileys` library, integrated with the FS04 Web messaging system.

## Testing

### Test File: `test_whatsapp.ts`

Located at `/tests/whatsapp/test_whatsapp.ts`, this file provides a simple way to test the WhatsApp integration directly from the command line.

#### Features:
- Tests the complete WhatsApp Web authentication flow
- Displays QR code in the terminal for authentication
- Shows connection status and events
- Can be used to send test messages

#### Prerequisites:
```bash
npm install --save-dev qrcode-terminal
```

#### Usage:
```bash
tsx tests/whatsapp/test_whatsapp.ts
```

#### Test Flow:
1. The script initializes a WhatsApp session with a specific session ID
2. When run, it will display a QR code in the terminal
3. Scan the QR code using your phone's WhatsApp app
4. The script will show authentication status and connection events
5. Once connected, you can uncomment and modify the `sendMessage` line to test message sending

#### Example Output:
```
🔌 Initializing WhatsApp session...
=== QR Code Received ===
[QR Code Displayed]
Scan the QR code above to authenticate
========================

✅ Session authenticated successfully as UserName (1234567890)
🚀 WhatsApp client is ready!
Session info: { ... }
```

#### Notes:
- The test uses a hardcoded session ID for consistency between test runs
- Make sure your test environment has access to the database for session persistence
- The test will keep running until manually stopped (Ctrl+C)

## Core Architecture

### Key Components

1. **WhatsAppAccountManager**
   - Singleton service that manages all active WhatsApp client instances
   - Handles client creation, retrieval, and cleanup
   - Initializes clients from database on server start

2. **WhatsAppAccountClient**
   - Represents a single WhatsApp account connection
   - Manages the lifecycle of the connection
   - Handles authentication, message sending, and event emission
   - Uses composition with `WhatsAppSession` for WebSocket management

3. **WhatsAppSession**
   - Manages the WebSocket connection to WhatsApp Web
   - Handles authentication state and session persistence
   - Emits events for QR code generation, authentication, and messages
   - Uses `usePrismaAuthState` for persistent storage of session data

4. **usePrismaAuthState**
   - Implements the Baileys auth state interface
   - Stores authentication data in the database using Prisma
   - Handles encryption/decryption of sensitive data

5. **whatsappHandler**
   - Message handler for the messaging system
   - Processes incoming WhatsApp-related messages
   - Routes commands to appropriate clients
   - Manages subscriptions and cleanup

## Data Flow

1. **Connection Initialization**
   ```
   UI Request → WebSocket → whatsappHandler → WhatsAppAccountManager → WhatsAppAccountClient → WhatsAppSession
   ```

2. **Authentication Flow**
   ```
   WhatsAppSession (generates QR) → WhatsAppAccountClient (emits event) → WebSocket → UI (shows QR)
   User scans QR → WhatsAppSession (authenticates) → WhatsAppAccountClient (emits 'authenticated')
   ```

3. **Message Flow**
   ```
   Incoming: WhatsApp Web → WhatsAppSession → WhatsAppAccountClient → WebSocket → UI
   Outgoing: UI → WebSocket → whatsappHandler → WhatsAppAccountClient → WhatsAppSession → WhatsApp Web
   ```

## Database Schema

The following tables are used by the WhatsApp integration:

1. **WhatsAppAccount**
   - `id`: Primary key
   - `client_id`: Unique client identifier
   - `phone_number`: Associated phone number
   - `created_by`: User who created the account
   - `created_at`: Timestamp of creation
   - `updated_at`: Timestamp of last update
   - `status`: Current status (connecting, connected, disconnected, etc.)

2. **WhatsAppAuthData**
   - `id`: Primary key
   - `clientId`: Reference to WhatsApp client
   - `file`: Auth file identifier
   - `data`: Encrypted auth data
   - `createdAt`: Timestamp of creation
   - `updatedAt`: Timestamp of last update

## Error Handling

- All errors are caught and logged with appropriate context
- Connection errors trigger reconnection attempts with exponential backoff
- Authentication failures emit 'auth_failure' events
- Message sending errors include detailed error information

## Security Considerations

1. **Session Storage**
   - Authentication data is encrypted before storage
   - Each client has its own isolated session
   - Sessions are cleaned up on logout/disconnect

2. **Data Validation**
   - All incoming messages are validated
   - Phone numbers are normalized before use
   - Message content is sanitized

3. **Rate Limiting**
   - Implemented at the WebSocket handler level
   - Prevents abuse of the WhatsApp API

## Performance Considerations

- **Caching**: Group metadata and message retry counters are cached
- **Connection Pooling**: Reuses WebSocket connections when possible
- **Lazy Loading**: Resources are loaded on-demand
- **Batching**: Messages are batched when possible

## Monitoring and Logging

- All operations generate structured logs
- Connection state changes are logged with context
- Message delivery status is tracked and logged
- Performance metrics are collected for monitoring

## Best Practices

1. **Error Handling**
   - Always handle promise rejections
   - Include context in error messages
   - Log errors with appropriate severity

2. **Resource Management**
   - Clean up resources in `onDestroy`
   - Close WebSocket connections properly
   - Release database connections when done

3. **Security**
   - Never log sensitive data
   - Validate all inputs
   - Use parameterized queries

## Troubleshooting

### Common Issues

1. **QR Code Not Displaying**
   - Check WebSocket connection status
   - Verify server logs for errors
   - Ensure CORS is properly configured

2. **Authentication Failures**
   - Check WhatsApp account status
   - Verify phone number format
   - Check for rate limiting

3. **Message Delivery Issues**
   - Verify recipient's phone number format
   - Check for account restrictions
   - Verify internet connectivity

## Future Improvements

1. **Modularization**
   - Split large files into smaller, focused modules
   - Improve separation of concerns
   - Enhance testability

2. **Enhanced Monitoring**
   - Add more detailed metrics
   - Implement alerting for critical failures
   - Improve log analysis

3. **Performance Optimizations**
   - Implement message batching
   - Add connection pooling
   - Optimize database queries
