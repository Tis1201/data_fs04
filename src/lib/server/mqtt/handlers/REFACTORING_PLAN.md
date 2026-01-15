# MQTT Handlers Refactoring Plan

## Current State
- **File**: `src/lib/server/mqtt/handlers/index.ts`
- **Size**: ~1,394 lines
- **Main Issues**: 
  - Too many responsibilities in one file
  - Hard to navigate and maintain
  - Difficult to test individual components

## Proposed Structure

### Phase 1: Extract Core Types and RPC Infrastructure

#### 1.1 Create `types.ts`
**Purpose**: Centralize all shared types
**Content**:
- `RpcHandlerArgs<P>`
- `RpcHandler<P>`
- `RpcResponse<T>`
- `RegisteredRpcHandler`
- Any other shared types

**Lines**: ~28 lines

#### 1.2 Create `rpc/registry.ts`
**Purpose**: RPC operation and handler registry
**Content**:
- `rpcOperations` Map
- `rpcHandlers` Map
- `extractTopicSub()` function
- `registerRpcOperation()`
- `executeRpcOperation()`
- `registerRpcHandler()`
- `createGenericRpcHandler()`
- `registerRpcClient()`

**Lines**: ~80 lines

### Phase 2: Extract Notification Publishers

#### 2.1 Create `notifications/device_action_broadcaster.ts`
**Purpose**: Broadcast device action updates to users
**Content**:
- `broadcastDeviceActionUpdate()` function

**Lines**: ~100 lines

#### 2.2 Create `notifications/device_status_publisher.ts`
**Purpose**: Publish device connection/disconnection notifications
**Content**:
- `publishDeviceStatusNotification()` function

**Lines**: ~70 lines

### Phase 3: Extract Event Handlers

#### 3.1 Create `events/connection_handler.ts`
**Purpose**: Handle MQTT connection/disconnection events
**Content**:
- Connection event parsing logic
- Redis presence updates
- Database connection tracking
- Device status updates
- Auto-sync logic for pending configs

**Lines**: ~280 lines

### Phase 4: Extract Reply Handlers

#### 4.1 Create `replies/status_update_handler.ts`
**Purpose**: Handle `device:statusUpdate` messages
**Content**:
- Status update processing
- Progress extraction (from message text)
- Action log updates
- Progress tracking logic (which actions have progress)
- `broadcastDeviceActionUpdate()` calls

**Lines**: ~180 lines

#### 4.2 Create `replies/progress_update_handler.ts`
**Purpose**: Handle `device:progressUpdate` messages
**Content**:
- Progress update processing
- Action log updates
- Progress broadcasting

**Lines**: ~40 lines

#### 4.3 Create `replies/terminal_handler.ts`
**Purpose**: Handle terminal output messages
**Content**:
- Terminal message detection
- Terminal output forwarding
- Type field cleanup

**Lines**: ~40 lines

#### 4.4 Create `replies/rdp_handler.ts`
**Purpose**: Handle RDP messages
**Content**:
- RDP message detection
- RDP message forwarding
- Type field cleanup

**Lines**: ~35 lines

#### 4.5 Create `replies/webrtc_handler.ts`
**Purpose**: Handle WebRTC messages
**Content**:
- WebRTC message detection
- WebRTC message forwarding
- Type field cleanup

**Lines**: ~40 lines

#### 4.6 Create `replies/screenshot_handler.ts`
**Purpose**: Handle screenshot responses and errors
**Content**:
- Screenshot response detection
- Screenshot error detection
- Action log updates for screenshots
- Download URL generation
- Error forwarding with duration

**Lines**: ~180 lines

#### 4.7 Create `replies/reply_router.ts`
**Purpose**: Main router for all reply messages
**Content**:
- Ticket decoding
- Reply validation
- Routing to appropriate handlers
- Notification forwarding logic
- Type field cleanup

**Lines**: ~200 lines

### Phase 5: Extract Data Stream Handlers

#### 5.1 Create `streams/preview_data_handler.ts`
**Purpose**: Handle controller preview data streams
**Content**:
- Ticket-based routing
- Legacy session-based routing
- Preview frame forwarding

**Lines**: ~70 lines

### Phase 6: Refactor Main Dispatcher

#### 6.1 Update `index.ts`
**Purpose**: Main entry point and dispatcher
**Content**:
- `handleIncoming()` function (simplified)
- Route to appropriate handlers:
  - Connection events → `events/connection_handler.ts`
  - Raw RPC → `rpc/registry.ts`
  - Replies → `replies/reply_router.ts`
  - Data streams → `streams/preview_data_handler.ts`

**Lines**: ~150 lines (down from 1,394)

## File Structure After Refactoring

```
src/lib/server/mqtt/handlers/
├── index.ts                          # Main dispatcher (~150 lines)
├── types.ts                          # Shared types (~30 lines)
├── rpc/
│   └── registry.ts                   # RPC registry and operations (~80 lines)
├── notifications/
│   ├── device_action_broadcaster.ts  # Action update broadcaster (~100 lines)
│   └── device_status_publisher.ts    # Status notification publisher (~70 lines)
├── events/
│   └── connection_handler.ts         # Connection/disconnection events (~280 lines)
├── replies/
│   ├── reply_router.ts               # Main reply router (~200 lines)
│   ├── status_update_handler.ts      # Status update handler (~180 lines)
│   ├── progress_update_handler.ts    # Progress update handler (~40 lines)
│   ├── terminal_handler.ts           # Terminal handler (~40 lines)
│   ├── rdp_handler.ts                # RDP handler (~35 lines)
│   ├── webrtc_handler.ts             # WebRTC handler (~40 lines)
│   └── screenshot_handler.ts         # Screenshot handler (~180 lines)
├── streams/
│   └── preview_data_handler.ts       # Preview data handler (~70 lines)
├── web/                              # (existing)
├── device/                           # (existing)
└── REFACTORING_PLAN.md              # This file
```

## Implementation Order

### Step 1: Extract Types (Low Risk)
1. Create `types.ts` with all type definitions
2. Update `index.ts` to import from `types.ts`
3. Test that everything still compiles

### Step 2: Extract RPC Infrastructure (Low Risk)
1. Create `rpc/registry.ts`
2. Move RPC-related functions
3. Update imports in `index.ts` and other files
4. Test RPC operations still work

### Step 3: Extract Notification Publishers (Low Risk)
1. Create `notifications/` directory
2. Move `broadcastDeviceActionUpdate()` and `publishDeviceStatusNotification()`
3. Update imports
4. Test notifications still work

### Step 4: Extract Event Handlers (Medium Risk)
1. Create `events/connection_handler.ts`
2. Extract connection/disconnection logic
3. Update `handleIncoming()` to call new handler
4. Test connection events still work

### Step 5: Extract Reply Handlers (High Risk - Most Complex)
1. Create `replies/` directory
2. Extract each handler one at a time:
   - Start with `screenshot_handler.ts` (most isolated)
   - Then `status_update_handler.ts`
   - Then `progress_update_handler.ts`
   - Then `terminal_handler.ts`, `rdp_handler.ts`, `webrtc_handler.ts`
   - Finally `reply_router.ts` (orchestrates everything)
3. Test each handler as you extract it
4. Update `handleIncoming()` to use `reply_router.ts`

### Step 6: Extract Data Stream Handlers (Low Risk)
1. Create `streams/preview_data_handler.ts`
2. Move preview data handling logic
3. Update `handleIncoming()`
4. Test preview data still works

### Step 7: Clean Up Main Dispatcher (Low Risk)
1. Simplify `handleIncoming()` to just route to handlers
2. Remove all extracted code
3. Add clear comments for routing logic
4. Final testing

## Benefits

1. **Maintainability**: Each file has a single, clear responsibility
2. **Testability**: Individual handlers can be tested in isolation
3. **Readability**: Much easier to find and understand specific functionality
4. **Scalability**: Easy to add new handlers without touching existing code
5. **Performance**: No performance impact, just better organization

## Testing Strategy

1. **Unit Tests**: Test each extracted handler independently
2. **Integration Tests**: Test the main dispatcher routes correctly
3. **E2E Tests**: Test full flows (RPC → Reply → Notification)
4. **Manual Testing**: Test all device actions, notifications, and streams

## Migration Notes

- All exports from `index.ts` should be re-exported for backward compatibility
- Update imports gradually (can keep old imports working during transition)
- Use feature flags if needed to roll back quickly

## Estimated Effort

- **Phase 1-2**: 2-3 hours (types and infrastructure)
- **Phase 3**: 2-3 hours (event handlers)
- **Phase 4**: 4-6 hours (reply handlers - most complex)
- **Phase 5-6**: 1-2 hours (streams and cleanup)
- **Testing**: 2-3 hours
- **Total**: ~12-17 hours

## Risk Assessment

- **Low Risk**: Types, RPC registry, notifications (well-isolated)
- **Medium Risk**: Event handlers (some dependencies)
- **High Risk**: Reply handlers (complex interdependencies, need careful extraction)

## Rollback Plan

- Keep original `index.ts` in git history
- Can revert individual phases if issues arise
- Use feature flags to switch between old/new implementations
