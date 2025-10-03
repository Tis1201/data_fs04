# Unified Device Communication Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                SERVER (Centralized Logic)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │   Action API    │    │  Status API     │    │      SSE Publisher          │  │
│  │  /actions       │    │  /status        │    │                             │  │
│  │                 │    │                 │    │  • device:actionRequest     │  │
│  │ • Validates     │    │ • Receives      │    │  • device:statusUpdate      │  │
│  │ • Creates log   │    │ • Updates log   │    │  • device:progressUpdate    │  │
│  │ • Publishes SSE │    │ • Publishes SSE │    │  • device:logLine           │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
           │                        │                        │
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐
│   Frontend      │    │     Device      │    │      Frontend               │
│                 │    │                 │    │                             │
│ • API Calls     │    │ • Receives SSE  │    │ • Receives SSE              │
│ • Action UI     │    │ • Executes      │    │ • Real-time Updates         │
│ • Progress UI   │    │ • Sends API     │    │ • Status Updates            │
└─────────────────┘    └─────────────────┘    └─────────────────────────────┘
```

## Core Principles

1. **Server-Centric Design**: Server leads, device follows
2. **Centralized Logic**: All business logic resides on the server
3. **Unified Communication**: Single patterns for similar operations
4. **Real-time UI Updates**: Server pushes updates to frontend via SSE
5. **Single Log Entry**: Each action creates one log entry that gets updated

## Message Flow Patterns

### Pattern 1: Simple Action (Reboot/Restart)

```
Frontend                    Server                      Device
    │                          │                          │
    │ POST /actions            │                          │
    │ {action: "reboot"}       │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │ Create action log        │
    │                          │ (status: "initiated")    │
    │                          │                          │
    │                          │ SSE: device:actionRequest│
    │                          │ {action: "reboot",       │
    │                          │  logId: "123"}           │
    │                          │─────────────────────────▶│
    │                          │                          │
    │ Response: {opId: "123"}  │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ SSE: device:statusUpdate │                          │
    │ {action: "reboot",       │                          │
    │  status: "in_progress",  │                          │
    │  message: "Sending..."}  │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update UI: In Progress   │                          │
    │                          │                          │
    │                          │                          │ Execute reboot
    │                          │                          │ (2 seconds)
    │                          │                          │
    │                          │ POST /status             │
    │                          │ {logId: "123",           │
    │                          │  action: "reboot",       │
    │                          │  status: "complete"}     │
    │                          │◀─────────────────────────│
    │                          │                          │
    │                          │ Update action log        │
    │                          │ (status: "complete")     │
    │                          │                          │
    │ SSE: device:statusUpdate │                          │
    │ {action: "reboot",       │                          │
    │  status: "complete",     │                          │
    │  durationMs: 2000}       │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update UI: Success       │                          │
    │ (Same log entry)         │                          │
    │                          │                          │
```

### Pattern 2: Progress Action (File Push)

```
Frontend                    Server                      Device
    │                          │                          │
    │ POST /actions            │                          │
    │ {action: "pushFile",     │                          │
    │  file: "data.txt"}       │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │ Create action log        │
    │                          │ (status: "initiated")    │
    │                          │                          │
    │                          │ SSE: device:actionRequest│
    │                          │ {action: "pushFile",     │
    │                          │  logId: "456"}           │
    │                          │─────────────────────────▶│
    │                          │                          │
    │ Response: {opId: "456"}  │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ SSE: device:statusUpdate │                          │
    │ {action: "pushFile",     │                          │
    │  status: "in_progress",  │                          │
    │  message: "Starting..."} │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update UI: In Progress   │                          │
    │                          │                          │
    │                          │                          │ Start file transfer
    │                          │                          │ (25% complete)
    │                          │                          │
    │                          │ SSE: device:progressUpdate│
    │                          │ {action: "pushFile",     │
    │                          │  logId: "456",           │
    │                          │  progress: 25}           │
    │                          │◀─────────────────────────│
    │                          │                          │
    │ SSE: device:progressUpdate│                          │
    │ {action: "pushFile",     │                          │
    │  progress: 25}           │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update progress bar: 25% │                          │
    │                          │                          │
    │                          │                          │ Continue transfer
    │                          │                          │ (75% complete)
    │                          │                          │
    │                          │ SSE: device:progressUpdate│
    │                          │ {action: "pushFile",     │
    │                          │  logId: "456",           │
    │                          │  progress: 75}           │
    │                          │◀─────────────────────────│
    │                          │                          │
    │ SSE: device:progressUpdate│                          │
    │ {action: "pushFile",     │                          │
    │  progress: 75}           │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update progress bar: 75% │                          │
    │                          │                          │
    │                          │                          │ Complete transfer
    │                          │                          │
    │                          │ POST /status             │
    │                          │ {logId: "456",           │
    │                          │  action: "pushFile",     │
    │                          │  status: "complete"}     │
    │                          │◀─────────────────────────│
    │                          │                          │
    │                          │ Update action log        │
    │                          │ (status: "complete")     │
    │                          │                          │
    │ SSE: device:statusUpdate │                          │
    │ {action: "pushFile",     │                          │
    │  status: "complete",     │                          │
    │  durationMs: 5000}       │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update UI: Success       │                          │
    │ (Same log entry)         │                          │
    │                          │                          │
```

### Pattern 3: Real-Time Streaming (Logs)

```
Frontend                    Server                      Device
    │                          │                          │
    │ POST /actions            │                          │
    │ {action: "getLogs"}      │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │ Create action log        │
    │                          │ (status: "initiated")    │
    │                          │                          │
    │                          │ SSE: device:actionRequest│
    │                          │ {action: "getLogs",      │
    │                          │  logId: "789"}           │
    │                          │─────────────────────────▶│
    │                          │                          │
    │ Response: {opId: "789"}  │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ SSE: device:statusUpdate │                          │
    │ {action: "getLogs",      │                          │
    │  status: "in_progress",  │                          │
    │  message: "Starting..."} │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update UI: In Progress   │                          │
    │                          │                          │
    │                          │                          │ Start log streaming
    │                          │                          │
    │                          │ SSE: device:progressUpdate│
    │                          │ {logId: "789",           │
    │                          │  line: "App started"}    │
    │                          │◀─────────────────────────│
    │                          │                          │
    │ SSE: device:progressUpdate│                          │
    │ {line: "App started"}    │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Display: "App started"   │                          │
    │                          │                          │
    │                          │ SSE: device:progressUpdate│
    │                          │ {logId: "789",           │
    │                          │  line: "WebRTC init"}    │
    │                          │◀─────────────────────────│
    │                          │                          │
    │ SSE: device:progressUpdate│                          │
    │ {line: "WebRTC init"}    │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Display: "WebRTC init"   │                          │
    │                          │                          │
    │                          │                          │ Complete streaming
    │                          │                          │
    │                          │ POST /status             │
    │                          │ {logId: "789",           │
    │                          │  action: "getLogs",      │
    │                          │  status: "complete"}     │
    │                          │◀─────────────────────────│
    │                          │                          │
    │                          │ Update action log        │
    │                          │ (status: "complete")     │
    │                          │                          │
    │ SSE: device:statusUpdate │                          │
    │ {action: "getLogs",      │                          │
    │  status: "complete",     │                          │
    │  durationMs: 3000}       │                          │
    │◀─────────────────────────│                          │
    │                          │                          │
    │ Update UI: Complete      │                          │
    │ (Same log entry)         │                          │
    │                          │                          │
```

### Pattern 4: Terminal/Remote Desktop (WebRTC)

```
Frontend                    Server                      Device
    │                          │                          │
    │ WebRTC Connect           │                          │
    │ {type: "terminal:connect"}│                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │ TerminalHandler          │
    │                          │ processes message        │
    │                          │                          │
    │                          │ SSE: device:actionRequest│
    │                          │ {action: "terminal:connect"}│
    │                          │─────────────────────────▶│
    │                          │                          │
    │                          │                          │ WebRTC Handler
    │                          │                          │ establishes connection
    │                          │                          │
    │                          │ SSE: webrtc:offer        │
    │                          │ {sdp: "..."}             │
    │                          │◀─────────────────────────│
    │                          │                          │
    │                          │ Forward to Frontend      │
    │                          │                          │
    │ WebRTC Answer            │                          │
    │ {type: "webrtc:answer"}  │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │ SSE: webrtc:answer       │
    │                          │ {sdp: "..."}             │
    │                          │─────────────────────────▶│
    │                          │                          │
    │                          │                          │ WebRTC Connection
    │                          │                          │ Established
    │                          │                          │
    │ Terminal Data Channel    │                          │
    │ {type: "terminal:input"} │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                          │ Forward to Device        │
    │                          │                          │
    │                          │                          │ Execute terminal command
    │                          │                          │
    │                          │ SSE: terminal:output     │
    │                          │ {data: "command result"} │
    │                          │◀─────────────────────────│
    │                          │                          │
    │                          │ Forward to Frontend      │
    │                          │                          │
    │ Display: "command result"│                          │
    │◀─────────────────────────│                          │
    │                          │                          │
```

## Handler Responsibilities

### Server Side

#### Action API Handler (`/api/devices/{id}/actions`)
- **Input**: `POST /api/devices/{id}/actions`
- **Process**: Validate → Create log → Send immediate status → Publish SSE to device
- **Output**: `{operationId: "123", status: "initiated"}`

#### Status API Handler (`/api/devices/{id}/status`)
- **Input**: `POST /api/devices/{id}/status`
- **Process**: Update log → Calculate duration → Publish SSE to frontend
- **Output**: `{success: true}`

#### SSE Publisher
- **To Device**: `device:actionRequest` (action commands with logId)
- **To Frontend**: `device:statusUpdate`, `device:progressUpdate`, `device:logLine`

### Device Side

#### Device Action Handler
- **Input**: SSE `device:actionRequest` (with logId)
- **Process**: Execute action → Send API status (with same logId)
- **Output**: `POST /api/devices/{id}/status`

#### Real-Time Handlers
- **Screenshot**: Stream images via SSE
- **WebRTC**: Handle terminal/desktop via SSE
- **Logs**: Stream log lines via SSE

### Frontend Side

#### Action Handler Manager
- **Input**: SSE messages from server
- **Process**: Route to appropriate handler → Update single log entry
- **Output**: Real-time UI updates

#### Unified Handlers
- **SimpleActionHandler**: Reboot, restart (success/error)
- **ProgressActionHandler**: Install, firmware (progress bars)
- **StreamActionHandler**: Logs, files (continuous updates)
- **FileOperationHandler**: Push/pull files (progress + status)

## Key Benefits

1. **Centralized Control**: Server makes all decisions
2. **Unified Patterns**: Same flow for all actions
3. **Real-Time Updates**: No polling, immediate feedback
4. **Single Log Entry**: Each action creates one log that gets updated
5. **Server-Calculated Duration**: Accurate timing from server
6. **Clean Separation**: API for actions, SSE for streaming
7. **Consistent Error Handling**: Centralized error management
8. **Audit Trail**: All actions logged and trackable

## Current Implementation Status

✅ **Completed**:
- Unified DeviceActionHandler on device side
- Unified action/status APIs on server side
- Frontend handlers with single log entry updates
- Progress tracking for file operations
- Real-time UI updates with proper duration calculation

✅ **Working Features**:
- Reboot/Restart actions
- Screenshot streaming
- Real-time log streaming
- File operations with progress
- Single log entry per action
