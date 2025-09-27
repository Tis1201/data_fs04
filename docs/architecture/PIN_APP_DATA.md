# Pin Management & Hierarchical Rules Architecture

## Overview

This document describes the hierarchical pin management system for device apps, including admin default rules, account default rules, and user custom rules with real-time updates via Server-Sent Events (SSE).

> **Related Documentation**: For the complete device data flow and app data ingestion, see [Device Data Flow Architecture](./DEVICE_DATA_FLOW.md)

## Pin Management Flow

```
User Creates Rule → PostgreSQL → Rule Engine → Device Commands → Device Updates → SSE to UI
```

## Components

### 1. Rule Management (PostgreSQL)
- **Purpose**: Store and manage hierarchical pin rules
- **Data**: Admin rules, account rules, user custom rules
- **Performance**: Fast rule queries and user permissions

### 2. Rule Engine
- **Purpose**: Apply rules to devices based on hierarchy and targeting
- **Function**: Process rules, determine device targets, send commands
- **Performance**: Handles 100k+ devices with complex rule logic

### 3. Real-Time Communication (SSE)
- **Rule Updates**: Announce when pin rules change
- **UI Updates**: Push real-time pin status to device detail pages
- **Scalability**: Handles multiple concurrent rule management views

## Hierarchical Pin Management System

### Rule Hierarchy (Priority Order)
```
1. Admin Default Rules (Priority 1) - Highest
   ↓
2. Account Default Rules (Priority 2) - Account Level
   ↓  
3. User Custom Rules (Priority 3) - Lowest
```

### User Types & Permissions

#### Admin Users
- ✅ Can create **Admin Default Rules** (applies to ALL accounts)
- ✅ Can create **Custom Rules** (only visible to them)
- ✅ Can manage any account's rules
- ✅ Can override any rule

#### Account Users
- ✅ Can create **Account Default Rules** (applies to their account only)
- ✅ Can create **Custom Rules** (only visible to them)
- ✅ Cannot see other users' custom rules
- ✅ Cannot override admin rules

### Rule Types & Examples

#### 1. Admin Default Rule (Priority 1)
```json
{
  "id": "rule-admin-1",
  "rule_type": "admin_default",
  "created_by": "admin-user",
  "account_id": null,
  "name": "System Security Apps",
  "apps": ["com.security.app", "com.antivirus.app"],
  "target_type": "all",
  "target_value": null,
  "priority": 1
}
```
**Applies to**: ALL devices across ALL accounts

#### 2. Account Default Rule (Priority 2)
```json
{
  "id": "rule-account-1", 
  "rule_type": "account_default",
  "created_by": "account-admin",
  "account_id": "account-retail",
  "name": "Retail Account Apps",
  "apps": ["com.retail.app", "com.pos.app"],
  "target_type": "all",
  "target_value": null,
  "priority": 2
}
```
**Applies to**: ALL devices in "retail" account

#### 3. User Custom Rule (Priority 3)
```json
{
  "id": "rule-user-1",
  "rule_type": "user_custom", 
  "created_by": "user-john",
  "account_id": "account-retail",
  "name": "John's Kiosk Apps",
  "apps": ["com.kiosk.app"],
  "target_type": "tags",
  "target_value": ["kiosk"],
  "priority": 3
}
```
**Applies to**: Only devices with "kiosk" tag in retail account

### Rule Application Logic
```typescript
// When applying pins to a device
async function applyPinRules(deviceId: string, currentUserId: string) {
  const device = await getDevice(deviceId);
  
  // Get all applicable rules in priority order
  const rules = await prisma.pinRules.findMany({
    where: {
      is_active: true,
      OR: [
        { rule_type: 'admin_default' },
        { 
          rule_type: 'account_default', 
          account_id: device.accountId 
        },
        { 
          rule_type: 'user_custom',
          account_id: device.accountId,
          created_by: currentUserId // Only current user's custom rules
        }
      ]
    },
    orderBy: { priority: 'asc' }
  });
  
  // Apply rules in order (admin → account → user)
  for (const rule of rules) {
    if (ruleMatchesDevice(rule, device)) {
      await applyRuleToDevice(rule, deviceId);
    }
  }
}
```

### Target Types
- **`all`**: All devices (admin/account default rules)
- **`tags`**: Devices with specific tags (e.g., ["retail", "kiosk"])
- **`os`**: Devices with specific OS (e.g., ["android", "ios"])
- **`devices`**: Specific device IDs (e.g., ["device-1", "device-2"])

## Pin Rule Application Flow

### Step 1: User Creates Pin Rule
```typescript
// User creates a new pin rule
const newRule = {
  rule_type: "user_custom",
  name: "My Kiosk Apps",
  apps: ["com.kiosk.app", "com.display.app"],
  target_type: "tags",
  target_value: ["kiosk"],
  priority: 3
};

await prisma.pinRule.create({ data: newRule });
```

### Step 2: Rule Engine Processes Rule
```typescript
// Rule engine finds applicable devices
const applicableDevices = await findDevicesByTarget({
  target_type: "tags",
  target_value: ["kiosk"],
  account_id: currentUser.accountId
});

// Apply rule to each device
for (const device of applicableDevices) {
  await applyPinRuleToDevice(rule.id, device.id);
}
```

### Step 3: Send Pin Commands to Devices
```typescript
// Send pin commands to devices
await sendDeviceCommand(deviceId, {
  action: "pin_apps",
  apps: rule.apps,
  rule_id: rule.id
});
```

### Step 4: Device Confirms Pin Status
```typescript
// Device confirms pin status and sends back to server
// Server updates PostgreSQL with pin status
await prisma.deviceAppPins.upsert({
  where: { 
    device_id_package_name: { 
      device_id: deviceId, 
      package_name: packageName 
    } 
  },
  data: {
    device_id: deviceId,
    package_name: packageName,
    pinned_by_rule_id: rule.id,
    pinned_at: new Date()
  }
});
```

### Step 5: Real-Time UI Updates
```typescript
// Broadcast pin status to UI
sseService.broadcast(`device-${deviceId}-detail`, {
  type: 'pins_updated',
  pinned_apps: updatedPins,
  timestamp: new Date()
});
```

## Device Detail Page Data Loading

### How Device Detail Page Works
When a user opens a device detail page, the system combines data from both ClickHouse (raw app data) and PostgreSQL (pin rules) to show the complete app list with pin status.

### Step 1: Load Applicable Rules
```typescript
// Get all applicable rules for the device
const applicableRules = await prisma.pinRules.findMany({
  where: {
    is_active: true,
    OR: [
      { rule_type: 'admin_default' },
      { 
        rule_type: 'account_default', 
        account_id: device.accountId 
      },
      { 
        rule_type: 'user_custom',
        account_id: device.accountId,
        created_by: currentUserId
      }
    ]
  },
  orderBy: { priority: 'asc' }
});

// Check if device matches rule targets
const matchingRules = applicableRules.filter(rule => 
  ruleMatchesDevice(rule, device)
);
```

### Step 2: Load Raw App Data from ClickHouse
```typescript
// Get raw app data from ClickHouse
const rawApps = await clickhouse.query(`
  SELECT 
    app_name, 
    package_name, 
    version, 
    app_type, 
    last_modified
  FROM device_apps_current 
  WHERE device_id = '${deviceId}'
  ORDER BY app_name ASC
`);
```

### Step 3: Load Pin Status from PostgreSQL
```typescript
// Get current pin status from PostgreSQL
const pinnedApps = await prisma.deviceAppPins.findMany({
  where: { device_id: deviceId },
  include: { 
    rule: { 
      select: { 
        name: true, 
        rule_type: true, 
        created_by: true 
      } 
    } 
  }
});

// Create pin status map
const pinStatusMap = new Map();
pinnedApps.forEach(pin => {
  pinStatusMap.set(pin.package_name, {
    isPinned: true,
    pinnedBy: pin.rule.name,
    ruleType: pin.rule.rule_type,
    pinnedAt: pin.pinned_at
  });
});
```

### Step 4: Combine Data for UI
```typescript
// Combine raw app data with pin status
const appsWithPins = rawApps.map(app => ({
  ...app,
  isPinned: pinStatusMap.has(app.package_name),
  pinInfo: pinStatusMap.get(app.package_name) || null
}));

// Sort by pin status (pinned first) then by name
const sortedApps = appsWithPins.sort((a, b) => {
  if (a.isPinned && !b.isPinned) return -1;
  if (!a.isPinned && b.isPinned) return 1;
  return a.app_name.localeCompare(b.app_name);
});
```

### Step 5: Send to UI
```typescript
// Send combined data to UI
return {
  deviceId,
  apps: sortedApps,
  totalApps: rawApps.length,
  pinnedApps: pinnedApps.length,
  applicableRules: matchingRules.length,
  lastUpdated: new Date()
};
```

## Database Schema

### PostgreSQL Schema (Pin Management)
```sql
-- Note: Device app summaries are managed in the Device Data Flow system
-- This table is referenced here for pin management context only

-- Hierarchical pin rules system
CREATE TABLE pin_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type VARCHAR(50) NOT NULL, -- 'admin_default', 'account_default', 'user_custom'
    created_by VARCHAR(255) NOT NULL, -- user_id who created it
    account_id VARCHAR(255), -- null for admin_default, required for others
    name VARCHAR(255) NOT NULL,
    description TEXT,
    apps JSONB NOT NULL, -- ["com.app1", "com.app2"]
    target_type VARCHAR(50), -- 'all', 'tags', 'os', 'devices'
    target_value JSONB, -- ["tag:retail"] or ["android"] or ["device-1"]
    priority INTEGER NOT NULL, -- 1=admin_default, 2=account_default, 3=user_custom
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device app pins (current state after applying all rules)
CREATE TABLE device_app_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    pinned_by_rule_id UUID, -- which rule caused this pin
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_id, package_name)
);

-- User app management actions (audit trail)
CREATE TABLE user_app_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'pin', 'unpin', 'install', 'uninstall'
    package_name VARCHAR(255) NOT NULL,
    rule_id UUID, -- which rule triggered this action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Performance Characteristics

### Rule Engine Performance
- **Rule Processing**: < 100ms for complex rule evaluation
- **Device Targeting**: < 50ms for finding applicable devices
- **Bulk Operations**: Handles 10k+ devices per rule application
- **Scalability**: Supports 100k+ devices with complex rule hierarchies

### PostgreSQL Performance (Pin Rules)
- **Query Speed**: < 50ms for rule queries
- **ACID Compliance**: Reliable for rule management
- **Relationships**: Fast joins for user permissions and device targeting
- **Indexing**: Optimized for rule type, account, and user lookups

### SSE Performance (Pin Updates)
- **Latency**: < 200ms for real-time pin status updates
- **Concurrency**: Supports 1000+ concurrent rule management views
- **Bandwidth**: Efficient binary protocol for rule updates

## API Endpoints

### Pin Rule Management
```typescript
// Create pin rule
POST /api/pin-rules
{
  "rule_type": "admin_default", // or "account_default", "user_custom"
  "name": "System Security Apps",
  "description": "Essential security apps for all devices",
  "apps": ["com.security.app", "com.antivirus.app"],
  "target_type": "all", // or "tags", "os", "devices"
  "target_value": null // or ["retail", "kiosk"] or ["android"] or ["device-1"]
}

// Update pin rule
PUT /api/pin-rules/{ruleId}
{
  "name": "Updated Rule Name",
  "apps": ["com.new.app"],
  "is_active": true
}

// Delete pin rule
DELETE /api/pin-rules/{ruleId}

// Get pin rules (filtered by user permissions)
GET /api/pin-rules
// Returns: admin_default + account_default + user's custom rules

// Get pin rules for specific device
GET /api/pin-rules/device/{deviceId}
// Returns: all applicable rules for the device
```

### Device Pin Management
```typescript
// Get apps with pin status for device (combined data)
GET /api/devices/{deviceId}/apps-with-pins
// Returns: raw app data from ClickHouse + pin status from PostgreSQL

// Get current pins for device
GET /api/devices/{deviceId}/pins
// Returns: current pinned apps with rule information

// Apply pin rules to device
POST /api/devices/{deviceId}/apply-rules
// Applies all applicable rules to the device

// Bulk apply rules to multiple devices
POST /api/devices/bulk-apply-rules
{
  "device_ids": ["device-1", "device-2"],
  "rule_ids": ["rule-1", "rule-2"]
}

// Manual pin/unpin app
POST /api/devices/{deviceId}/pin
{
  "package_name": "com.app.example",
  "action": "pin" // or "unpin"
}
```

### Device Targeting
```typescript
// Target all devices
{ "target_type": "all", "target_value": null }

// Target by tags
{ "target_type": "tags", "target_value": ["retail", "kiosk"] }

// Target by OS
{ "target_type": "os", "target_value": ["android", "ios"] }

// Target specific devices
{ "target_type": "devices", "target_value": ["device-1", "device-2"] }
```

## UI Components

### Pin Management Interface

#### Admin Panel
```
┌─────────────────────────────────────┐
│ Pin Management - Admin              │
├─────────────────────────────────────┤
│ Admin Default Rules:                │
│ • System Security Apps (ALL)        │
│   Apps: Security, Antivirus         │
│   [Edit] [Delete] [View Devices]    │
│                                     │
│ Account Default Rules:              │
│ • Retail Account Apps (account-1)   │
│   Apps: POS, Inventory              │
│   [Edit] [Delete] [View Devices]    │
│                                     │
│ My Custom Rules:                    │
│ • My Kiosk Apps (tag:kiosk)         │
│   Apps: Kiosk Manager               │
│   [Edit] [Delete] [View Devices]    │
│                                     │
│ [+ Create New Rule]                 │
└─────────────────────────────────────┘
```

#### User Panel
```
┌─────────────────────────────────────┐
│ Pin Management - User               │
├─────────────────────────────────────┤
│ Account Default Rules:              │
│ • Retail Account Apps (ALL)         │
│   Apps: POS, Inventory              │
│   [View Only] [View Devices]        │
│                                     │
│ My Custom Rules:                    │
│ • My Kiosk Apps (tag:kiosk)         │
│   Apps: Kiosk Manager               │
│   [Edit] [Delete] [View Devices]    │
│                                     │
│ [+ Create New Rule]                 │
└─────────────────────────────────────┘
```

#### Rule Creation Form
```
┌─────────────────────────────────────┐
│ Create Pin Rule                     │
├─────────────────────────────────────┤
│ Rule Name: [System Security Apps]   │
│ Description: [Essential security...]│
│                                     │
│ Apps to Pin:                        │
│ ☑ com.security.app                  │
│ ☑ com.antivirus.app                 │
│ ☐ com.monitoring.app                │
│                                     │
│ Target Devices:                     │
│ ○ All Devices                       │
│ ○ By Tags: [retail] [kiosk]        │
│ ○ By OS: [android] [ios]           │
│ ○ Specific: [device-1] [device-2]  │
│                                     │
│ [Create Rule] [Cancel]              │
└─────────────────────────────────────┘
```

### Device Detail Page
```typescript
// Real-time app list component with pin management
export class DeviceAppList {
  private deviceId: string;
  private sseConnection: SSEConnection;
  
  async loadInitialData() {
    // Load combined data (apps + pin status)
    const deviceData = await this.getDeviceDataWithPins(this.deviceId);
    this.renderAppList(deviceData.apps);
    this.renderPinSummary(deviceData);
  }
  
  setupRealTimeUpdates() {
    this.sseConnection = sseService.subscribe(
      `device-${this.deviceId}-detail`,
      (update) => {
        if (update.type === 'apps_updated') {
          this.updateAppList(update.data);
        } else if (update.type === 'pins_updated') {
          this.updatePinStatus(update.pinned_apps);
        }
      }
    );
  }
  
  private async getDeviceDataWithPins(deviceId: string) {
    // This calls the server endpoint that combines ClickHouse + PostgreSQL data
    const response = await fetch(`/api/devices/${deviceId}/apps-with-pins`);
    return await response.json();
  }
  
  private renderAppList(apps: AppWithPin[]) {
    apps.forEach(app => {
      const appElement = this.createAppElement(app);
      if (app.isPinned) {
        appElement.classList.add('pinned');
        appElement.setAttribute('data-pinned-by', app.pinInfo.pinnedBy);
      }
      this.appListContainer.appendChild(appElement);
    });
  }
}
```

### App Management Actions
```typescript
// Pin/unpin app functionality
export async function toggleAppPin(deviceId: string, packageName: string) {
  const currentPinState = await getCurrentPinState(deviceId, packageName);
  
  if (currentPinState) {
    // Unpin app
    await prisma.deviceAppPins.delete({
      where: {
        device_id_package_name: {
          device_id: deviceId,
          package_name: packageName
        }
      }
    });
    
    // Send unpin command to device
    await sendDeviceCommand(deviceId, {
      action: 'unpin_app',
      package_name: packageName
    });
  } else {
    // Pin app (create new pin record)
    await prisma.deviceAppPins.create({
      data: {
        device_id: deviceId,
        package_name: packageName,
        pinned_by_rule_id: null, // Manual pin (not from rule)
        pinned_at: new Date()
      }
    });
    
    // Send pin command to device
    await sendDeviceCommand(deviceId, {
      action: 'pin_app',
      package_name: packageName
    });
  }
  
  // Record user action in PostgreSQL
  await prisma.userAppAction.create({
    data: {
      userId: currentUser.id,
      deviceId,
      action: currentPinState ? 'unpin' : 'pin',
      packageName,
      rule_id: null // Manual action
    }
  });
  
  // SSE will automatically update UI
}
```

## Monitoring and Metrics

### Key Metrics
- **Data Ingestion Rate**: Apps per second from devices
- **Query Performance**: ClickHouse query response times
- **SSE Latency**: Time from device update to UI update
- **Error Rates**: Failed insertions, SSE disconnections

### Health Checks
```typescript
async function healthCheck() {
  return {
    clickhouse: await testClickHouseConnection(),
    postgresql: await testPostgresConnection(),
    sse: await testSSEConnection(),
    dataIngestionRate: await getDataIngestionRate(),
    activeConnections: await getActiveSSEConnections()
  };
}
```

## Configuration

### Environment Variables
```bash
# ClickHouse Configuration
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER_NAME=admin
CLICKHOUSE_PASSWORD=admin0823
CLICKHOUSE_DATABASE=fs_04

# PostgreSQL Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/fs04_web

# SSE Configuration
SSE_ENABLED=true
SSE_HEARTBEAT_INTERVAL=30000
SSE_MAX_CONNECTIONS=1000
```

## Benefits

### Hierarchical Control
- **Centralized Management**: Admin controls system-wide defaults
- **Account Management**: Account admins control account-level rules
- **User Customization**: Users can create personal rules
- **Rule Precedence**: Clear priority system prevents conflicts

### Flexible Targeting
- **All Devices**: Apply rules to entire system or account
- **By Tags**: Target devices with specific tags (retail, kiosk, etc.)
- **By OS**: Target devices by operating system
- **Specific Devices**: Target individual devices manually

### Real-Time Updates
- **Instant Rule Application**: < 200ms latency for rule changes
- **Live Pin Status**: Real-time pin status updates in UI
- **Bulk Operations**: Efficient handling of large-scale rule changes
- **User Experience**: No page refresh needed for rule management

### Audit & Compliance
- **Complete Audit Trail**: Track all rule changes and applications
- **User Attribution**: Know who created/modified each rule
- **Rule History**: Complete history of rule evolution
- **Compliance**: Meet enterprise governance requirements

## Implementation Phases

### Phase 1: Database Schema
- [ ] Create hierarchical pin rules tables
- [ ] Add user permission system
- [ ] Create audit trail tables
- [ ] Set up proper indexing

### Phase 2: Rule Engine
- [ ] Implement rule precedence logic
- [ ] Add device targeting logic
- [ ] Create rule application scheduler
- [ ] Add rule validation system

### Phase 3: Pin Management API
- [ ] Create pin rule CRUD endpoints
- [ ] Implement device targeting endpoints
- [ ] Add bulk operations support
- [ ] Create rule application endpoints

### Phase 4: Real-Time Updates
- [ ] Implement SSE for rule updates
- [ ] Add real-time pin status updates
- [ ] Handle connection management
- [ ] Create rule change notifications

### Phase 5: UI Components
- [ ] Build hierarchical pin management interface
- [ ] Add rule creation/editing forms
- [ ] Implement device targeting selectors
- [ ] Create rule management dashboard

### Phase 6: Integration
- [ ] Integrate with device data flow system
- [ ] Connect to ClickHouse for pin status
- [ ] Add device command integration
- [ ] Implement rule synchronization

### Phase 7: Monitoring & Analytics
- [ ] Add rule usage analytics
- [ ] Implement performance metrics
- [ ] Set up alerting for rule failures
- [ ] Create compliance reporting

## Troubleshooting

### Common Issues
1. **SSE Connection Drops**: Implement reconnection logic
2. **ClickHouse Timeouts**: Optimize query performance
3. **Data Sync Delays**: Check batch processing intervals
4. **UI Not Updating**: Verify SSE subscription setup

### Debug Tools
- ClickHouse query logs
- SSE connection monitoring
- PostgreSQL query performance
- UI component state inspection
