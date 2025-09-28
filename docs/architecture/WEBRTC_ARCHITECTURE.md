# WebRTC Architecture Documentation

## Overview

This document describes the complete WebRTC implementation for terminal and remote desktop functionality in the FS04 system. The architecture consists of client-side (browser) and server-side (Node.js) components, plus device-side (Go) components that work together to provide real-time terminal access and screen sharing.

## ⚠️ Current Issues

**The current implementation has significant architectural problems:**

1. **Mixed Message Handling**: WebRTC messages are handled through both WebSocket and SSE, creating confusion
2. **Inconsistent Message Flow**: Some messages go through WebSocket, others through SSE
3. **Complex State Management**: Multiple stores and handlers with overlapping responsibilities
4. **Poor Separation of Concerns**: WebRTC, terminal, and RDP logic are tightly coupled
5. **Difficult Debugging**: Messages flow through multiple layers making it hard to trace issues

**This document reflects the CURRENT (problematic) state. See `REFACTORING_PLAN.md` for the proposed clean architecture.**

## System Components

### 1. Client-Side (Browser) - TypeScript/Svelte

#### WebRTCClient (`src/lib/webrtc/WebRTCClient.ts`)
**Purpose**: Centralized WebRTC client for both admin and user routes

**Key Features**:
- Manages RTCPeerConnection lifecycle
- Handles data channel for terminal communication
- Manages video tracks for screen sharing
- Provides input methods for terminal and RDP

**Key Methods**:
```typescript
connect()                    // Initiates WebRTC connection
handleWebRTCMessage()        // Processes incoming WebRTC messages
sendTerminalInput()          // Sends terminal input via data channel
sendRDPStart()              // Initiates remote desktop session
sendMouseClick()            // Sends mouse events
sendKeyPress()              // Sends keyboard events
```

**Message Flow**:
- Sends `type: 'device'` messages with `payload.type: 'webrtc:connect'`
- Handles `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate` messages
- Creates data channel for terminal communication
- Manages video track for screen sharing

#### Device Store (`src/lib/stores/device-store.ts`)
**Purpose**: Svelte store for managing device-related state

**Key Features**:
- Listens for WebSocket messages with type 'device'
- Processes WebRTC messages and stores them in state
- Provides reactive state for UI components

**Message Processing**:
```typescript
// Listens for device messages
socketStore.on('device', (message: DeviceMessage) => {
  if (message.payload.type?.startsWith('webrtc:')) {
    // Create WebRTCMessage and update store
    const webrtcMessage: WebRTCMessage = {
      type: message.payload.type,
      deviceId: message.payload.deviceId,
      sdp: message.payload.sdp,
      candidate: message.payload.candidate,
      // ... other properties
    };
    update(state => ({ ...state, latestWebRTCMessage: webrtcMessage }));
  }
});
```

#### WebSocket Store (`src/lib/stores/websocket-store.ts`)
**Purpose**: Manages WebSocket connection and message routing

**Key Features**:
- Handles WebSocket connection lifecycle
- Routes messages to appropriate listeners
- Provides send/receive functionality

**Message Routing**:
```typescript
// Routes messages to listeners based on type
const dispatchMessage = (message: WebSocketMessage) => {
  if (messageListeners[message.type]) {
    messageListeners[message.type].forEach(cb => cb(message));
  }
  if (messageListeners['message']) {
    messageListeners['message'].forEach(cb => cb(message));
  }
};
```

### 2. Server-Side (Node.js) - TypeScript

#### Message Dispatcher (`src/lib/server/messaging/core/dispatcher.ts`)
**Purpose**: Central message routing system

**Routing Logic**:
```typescript
// Routes based on message type
if (type === 'webrtc') {
  await webrtcHandler.handle(message);
} else if (type === 'device' && payload.type?.startsWith('webrtc:')) {
  await webrtcHandler.handle(message);
} else if (type === 'device' && payload.type?.startsWith('terminal:')) {
  await terminalHandler.handle(message);
} else if (type === 'device') {
  await deviceHandler.handle(message);
}
```

#### WebRTC Handler (`src/lib/server/messaging/handlers/webrtcHandler.ts`)
**Purpose**: Dedicated handler for WebRTC messages

**Implementation**:
```typescript
export const webrtcHandler: Handler = {
  async handle(message: InMessage): Promise<void> {
    // Delegates to device message handler for actual processing
    await handleDeviceMessage(message);
  }
};
```

#### Device Message Handler (`src/lib/server/messaging/handlers/device/messageHandler.ts`)
**Purpose**: Core logic for processing device messages including WebRTC

**Key Features**:
- Handles WebRTC connection requests
- Manages terminal sessions
- Processes ICE candidates and SDP offers/answers
- Publishes status updates

**WebRTC Processing**:
```typescript
if (type === 'webrtc:connect') {
  // Create action log entry
  const created = await ActionLogger.createInitiated({
    deviceId,
    actionType: 'terminal',
    initiatedBy: message.userInfo.id,
    // ... other properties
  });
  
  // Check device online status
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device?.connected) {
    // Handle offline device
  }
  
  // Publish status update
  await publishDeviceStatus('terminal', deviceId, {
    deviceId,
    status: 'in_progress',
    // ... other properties
  });
}
```

#### Publisher (`src/lib/server/messaging/core/publisher.ts`)
**Purpose**: Publishes messages to subscribers

**Key Features**:
- Resolves recipients using router
- Handles authorization
- Delivers messages to connections

**Message Publishing**:
```typescript
async publish(message: RoutingMessage): Promise<void> {
  // Resolve recipients
  const connectionIds = await router.resolve(userInfo, scope);
  
  // Check authorization
  const isAllowed = await ScopeAuthorizer.isAllowed(scope, userInfo, type, connectionIds, sudo);
  
  // Deliver to each connection
  await Promise.all(
    filteredRecipients.map(connId => 
      ConnectionManager.sendTo(connId, outMessage)
    )
  );
}
```

#### Connection Manager (`src/lib/server/messaging/core/connectionManager.ts`)
**Purpose**: Manages live connections

**Key Methods**:
```typescript
getConnection(id: string): Connection | undefined
sendTo(connId: string, payload: any): Promise<void>
getConnectionByDeviceId(deviceId: string): Promise<Connection | undefined>
```

### 3. Device-Side (Go) - WebRTC Implementation

#### WebRTC Client (`internal/module/webrtc/client.go`)
**Purpose**: Device-side WebRTC peer connection management

**Key Features**:
- Manages Pion WebRTC peer connection
- Handles data channel for terminal communication
- Manages video streaming for screen sharing
- Processes input events

**Key Methods**:
```go
func (c *Client) HandleConnect(senderConnectionID string) error
func (c *Client) HandleOffer(offer webrtc.SessionDescription) error
func (c *Client) HandleAnswer(answer webrtc.SessionDescription) error
func (c *Client) HandleICECandidate(candidate webrtc.ICECandidateInit) error
func (c *Client) startTerminalSession() error
```

**Connection Flow**:
1. Receives `webrtc:connect` message
2. Creates video track with VP8 codec
3. Creates data channel
4. Generates SDP offer
5. Sends offer back to client

#### Terminal Session (`internal/module/webrtc/terminal.go`)
**Purpose**: Manages terminal sessions using PTY

**Key Features**:
- Creates PTY (pseudo-terminal) for shell access
- Handles terminal input/output
- Manages terminal resizing
- Sends terminal output via data channel

**Key Methods**:
```go
func NewTerminalSession(dataChannel *webrtc.DataChannel, logger *logrus.Entry) (*TerminalSession, error)
func (ts *TerminalSession) HandleInput(input string) error
func (ts *TerminalSession) SendOutput(output string)
func (ts *TerminalSession) Resize(rows, cols uint16) error
```

**Terminal Processing**:
```go
// Read from terminal and send via data channel
func (ts *TerminalSession) readFromTerminal() {
  for {
    n, err := ts.ptmx.Read(buf)
    if n > 0 {
      output := string(buf[:n])
      ts.SendOutput(output)
    }
  }
}
```

#### Input Handler (`internal/module/webrtc/input_handler.go`)
**Purpose**: Cross-platform input injection

**Key Features**:
- Platform-specific keyboard/mouse injection
- Handles terminal input events
- Manages input state

**Platform Support**:
- macOS: Uses Core Graphics for input injection
- Linux: Uses X11 for input injection

#### Video Session (`internal/module/webrtc/video.go`)
**Purpose**: Manages video streaming for screen sharing

**Key Features**:
- Screen capture using platform-specific methods
- H.264 video encoding
- RTP packet transmission
- Frame rate and quality control

## Message Flow Architecture (Current Messy State)

### 1. Connection Initiation (Mixed WebSocket + SSE)

```
Client (Browser)                    Server (Node.js)                    Device (Go)
     |                                      |                               |
     |-- WebSocket: webrtc:connect ------->|                               |
     |                                      |-- WebSocket: webrtc:connect ->|
     |                                      |                               |
     |                                      |<-- SSE: webrtc:offer ---------|
     |<-- SSE: webrtc:offer ---------------|                               |
     |                                      |                               |
     |-- WebSocket: webrtc:answer --------->|                               |
     |                                      |-- WebSocket: webrtc:answer -->|
     |                                      |                               |
     |<-- SSE: webrtc:ice-candidate -------|                               |
     |                                      |<-- SSE: webrtc:ice-candidate -|
     |                                      |                               |
     |-- WebSocket: webrtc:ice-candidate ->|                               |
     |                                      |-- WebSocket: webrtc:ice-cand->|
```

**⚠️ PROBLEM**: Mixed WebSocket (client→server) and SSE (server→client) creates confusion and debugging issues.

### 2. Terminal Communication

```
Client (Browser)                    Server (Node.js)                    Device (Go)
     |                                      |                               |
     |-- terminal:input (data channel) --->|                               |
     |                                      |-- terminal:input ------------>|
     |                                      |                               |
     |                                      |<-- terminal:output ----------|
     |<-- terminal:output (data channel) --|                               |
```

### 3. Screen Sharing

```
Client (Browser)                    Server (Node.js)                    Device (Go)
     |                                      |                               |
     |-- rdp:start (data channel) -------->|                               |
     |                                      |-- rdp:start ------------------>|
     |                                      |                               |
     |                                      |<-- video stream (RTP) --------|
     |<-- video stream (RTP) --------------|                               |
```

## Message Types and Payloads

### Client to Server Messages

#### WebRTC Connection
```typescript
{
  type: 'device',
  payload: {
    action: 'message',
    type: 'webrtc:connect',
    deviceId: 'device-uuid'
  },
  scope: 'subscription:device:device-uuid'
}
```

#### ICE Candidate
```typescript
{
  type: 'device',
  payload: {
    action: 'message',
    type: 'webrtc:ice-candidate',
    deviceId: 'device-uuid',
    candidate: { candidate: '...', sdpMid: '...', sdpMLineIndex: 0 }
  },
  scope: 'subscription:device:device-uuid'
}
```

#### WebRTC Answer
```typescript
{
  type: 'device',
  payload: {
    action: 'message',
    type: 'webrtc:answer',
    deviceId: 'device-uuid',
    sdp: 'v=0\r\no=- ...'
  },
  scope: 'subscription:device:device-uuid'
}
```

### Server to Client Messages

#### WebRTC Offer
```typescript
{
  type: 'device:terminalStatus',
  scope: 'subscription:device:device-uuid',
  payload: {
    action: 'terminalStatus',
    deviceId: 'device-uuid',
    status: 'in_progress',
    message: 'Connecting to terminal...'
  }
}
```

### Data Channel Messages

#### Terminal Input
```json
{
  "type": "terminal:input",
  "data": "ls -la\r",
  "timestamp": 1640995200000
}
```

#### Terminal Output
```json
{
  "type": "terminal:output",
  "data": "total 8\ndrwxr-xr-x  2 user user 4096 Jan  1 12:00 .\n",
  "timestamp": 1640995200000
}
```

#### RDP Start
```json
{
  "type": "rdp:start",
  "options": {
    "frameRate": 15,
    "quality": 80,
    "captureMode": "screen",
    "resolution": { "width": 1280, "height": 720 }
  },
  "timestamp": 1640995200000
}
```

## Connection Management

### WebSocket Connection Lifecycle

1. **Client Connection**: Browser establishes WebSocket connection to server
2. **Authentication**: Server authenticates user and creates connection record
3. **Subscription**: Client subscribes to device-specific channels
4. **Message Routing**: Server routes messages based on scope and type
5. **Cleanup**: Connections are cleaned up on disconnect

### Device Connection Management

1. **Device Registration**: Device registers with server via WebSocket
2. **Connection Tracking**: Server tracks device connection status
3. **Message Forwarding**: Server forwards WebRTC messages to device
4. **Status Updates**: Device sends periodic status updates

## Error Handling

### Client-Side Errors
- WebRTC connection failures
- Data channel errors
- Network connectivity issues
- Authentication failures

### Server-Side Errors
- Message routing failures
- Connection not found
- Authorization failures
- Database errors

### Device-Side Errors
- Terminal session failures
- Input injection errors
- Video capture errors
- Network connectivity issues

## Security Considerations

### Authentication
- All connections require valid authentication
- Device connections are validated against database
- User permissions are checked for device access

### Authorization
- Scope-based authorization for message routing
- Device-specific subscription channels
- Admin-only access to certain features

### Data Protection
- WebRTC connections use DTLS encryption
- Sensitive data is not logged
- Input/output is sanitized

## Performance Considerations

### Connection Pooling
- WebSocket connections are pooled and reused
- Device connections are cached
- Message routing is optimized

### Resource Management
- Terminal sessions are cleaned up on disconnect
- Video streams are optimized for bandwidth
- Memory usage is monitored and controlled

### Scalability
- Horizontal scaling via load balancers
- Database connection pooling
- Message queue for high-volume scenarios

## Debugging and Monitoring

### Logging
- Comprehensive logging at all levels
- Structured logging with context
- Performance metrics and timing

### Debug Tools
- WebRTC connection state monitoring
- Message flow tracing
- Terminal session debugging

### Health Checks
- Connection health monitoring
- Device status tracking
- System resource monitoring

## Troubleshooting Guide

### Common Issues

1. **WebRTC Connection Fails**
   - Check ICE connectivity
   - Verify STUN server accessibility
   - Check firewall settings

2. **Terminal Not Responding**
   - Verify data channel is open
   - Check terminal session status
   - Verify input handling

3. **Screen Sharing Issues**
   - Check video track creation
   - Verify codec support
   - Check bandwidth availability

### Debug Steps

1. Enable debug logging
2. Check WebSocket connection status
3. Verify message routing
4. Check device connection status
5. Monitor resource usage

## Future Enhancements

### Planned Features
- Multi-device support
- File transfer capabilities
- Audio streaming
- Mobile device support

### Performance Improvements
- Connection multiplexing
- Adaptive bitrate streaming
- Caching optimizations
- Database query optimization

### Security Enhancements
- End-to-end encryption
- Certificate pinning
- Rate limiting
- Audit logging improvements
