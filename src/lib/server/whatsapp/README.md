# WhatsApp Integration - FS04 Web

This directory contains the server-side implementation of WhatsApp Web integration using the `@whiskeysockets/baileys` library, integrated with the FS04 Web messaging system.

## Core Architecture

### Key Components

1. **WhatsAppAccountManager** (Singleton)
   - Manages all active WhatsApp client instances
   - Handles client lifecycle (creation, retrieval, cleanup)
   - Implements automatic cleanup of stale sessions
   - Provides a singleton instance for application-wide access

2. **WhatsAppAccountClient**
   - Represents a single WhatsApp account connection
   - Manages authentication state and session lifecycle
   - Handles message sending and event propagation
   - Uses composition with `WhatsAppSession` for WebSocket management
   - Provides a clean API for UI interaction

3. **WhatsAppSession**
   - Manages the low-level WebSocket connection to WhatsApp Web
   - Handles authentication state and session persistence
   - Emits events for key lifecycle events:
     - `qrcode`: When a new QR code is available for authentication
     - `authenticated`: When authentication is successful
     - `auth_failure`: When authentication fails
     - `ready`: When the connection is fully established
     - `disconnected`: When the connection is lost
     - `message`: When a new message is received
     - `error`: When an error occurs

4. **usePrismaAuthState**
   - Implements the Baileys auth state interface
   - Persists authentication data in the database using Prisma
   - Handles encryption/decryption of sensitive data
   - Supports multiple concurrent sessions

## Data Flow

### 1. Initialization
```
Application Start → WhatsAppAccountManager (creates instance)
```

### 2. Client Creation
```
UI Request → WhatsAppAccountManager.create() → WhatsAppAccountClient → WhatsAppSession
```

### 3. Authentication Flow
```
1. WhatsAppSession → Generates QR code → WhatsAppAccountClient → UI
2. User scans QR code → WhatsApp Web → WhatsAppSession
3. WhatsAppSession → Authenticates → Saves credentials via usePrismaAuthState
4. WhatsAppSession → Emits 'authenticated' → WhatsAppAccountClient → UI
```

### 4. Message Flow
```
Incoming: WhatsApp Web → WhatsAppSession → WhatsAppAccountClient → UI
Outgoing: UI → WhatsAppAccountClient → WhatsAppSession → WhatsApp Web
```

## Database Schema

### whatsAppAuthData
- `id`: Unique identifier (UUID)
- `clientId`: Reference to the client ID
- `file`: File identifier (e.g., 'creds', 'app-state-sync-key')
- `data`: Encrypted authentication data
- `createdAt`: Timestamp of creation
- `updatedAt`: Timestamp of last update

## Error Handling

- All components implement proper error handling and logging
- Authentication failures trigger appropriate events
- Network issues are automatically handled with reconnection logic
- Database errors are logged and handled gracefully

## Security Considerations

- Authentication data is encrypted before storage
- Session data is scoped to individual clients
- Proper cleanup of resources on session end
- Rate limiting and request validation is implemented
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
