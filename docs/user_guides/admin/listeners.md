# Listeners User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Listeners are event-driven components that monitor system events and trigger actions based on specific conditions. They enable automated responses to system events such as device status changes, user actions, or system alerts, providing real-time event processing and automation capabilities.

## Prerequisites

- **Admin permissions** - Full listener management access
- **Event understanding** - Knowledge of system events and triggers
- **Automation experience** - Experience with event-driven automation
- **Scripting knowledge** - Understanding of listener scripts and actions

## Getting Started

### Quick Start
1. **Navigate to Listeners** - Go to Admin → Integrations → Listeners
2. **Create New Listener** - Click "Create Listener" button
3. **Configure Listener** - Set listener name, events, and conditions
4. **Define Actions** - Define actions to execute when conditions are met
5. **Test Listener** - Test listener configuration
6. **Activate Listener** - Activate listener for use

### Navigation
- **Menu Path**: Admin → Integrations → Listeners
- **URL**: `/admin/settings/listeners`
- **Direct Access**: Click "Listeners" in the Integrations section

## Core Functionality

### Listener List View

#### Listener Information Display
- **Listener Name** - Human-readable listener name
- **Listener ID** - Unique system identifier
- **Status** - Active/Inactive/Error
- **Event Type** - Type of events being monitored
- **Trigger Count** - Number of times listener has been triggered
- **Created Date** - When listener was created
- **Last Triggered** - Last time listener was triggered
- **Success Rate** - Listener execution success rate
- **Action Count** - Number of actions configured

#### Listener Status Indicators
- 🟢 **Active** - Listener is active and monitoring events
- 🔴 **Inactive** - Listener is disabled
- 🟡 **Error** - Listener has execution errors
- ⚪ **Testing** - Listener is being tested

#### Filtering and Search
- **Search by Name** - Find listeners by name
- **Filter by Status** - Show only active/inactive listeners
- **Filter by Event Type** - Show listeners by event type
- **Filter by Date** - Show listeners by creation date
- **Filter by Usage** - Show listeners by trigger count
- **Sort Options** - Sort by name, status, trigger count, date, etc.

### Listener Detail View

#### Listener Information Tab
- **Basic Info** - Name, ID, description, status
- **Creation Info** - Created by, created date, last modified
- **Event Info** - Event types and conditions
- **Performance Info** - Trigger count, success rate, execution time

#### Listener Configuration Tab
- **Event Settings** - Event types and conditions
- **Condition Settings** - Trigger conditions and filters
- **Action Settings** - Actions to execute
- **Schedule Settings** - Listener schedule and timing
- **Security Settings** - Security and access control

#### Execution History Tab
- **Execution Events** - Historical execution events
- **Success/Failure** - Execution success and failure logs
- **Action Results** - Results of executed actions
- **Performance Metrics** - Execution performance metrics
- **Error Details** - Detailed error information

## Advanced Features

### Listener Creation

#### Basic Listener Setup
- **Listener Name** - Choose descriptive name
- **Description** - Add detailed description
- **Event Type** - Select event type to monitor
- **Status** - Set initial listener status

#### Event Configuration
- **Event Selection** - Select events to monitor
- **Event Filters** - Set event filters and conditions
- **Event Conditions** - Define trigger conditions
- **Event Validation** - Configure event validation
- **Event Priority** - Set event priority levels

#### Action Configuration
- **Action Types** - Select action types to execute
- **Action Parameters** - Configure action parameters
- **Action Sequence** - Define action execution sequence
- **Action Conditions** - Set action execution conditions
- **Action Validation** - Configure action validation

### Listener Management

#### Event Management
- **Event Monitoring** - Monitor event occurrences
- **Event Filtering** - Filter events by conditions
- **Event Processing** - Process event data
- **Event Validation** - Validate event data
- **Event Analytics** - Analyze event patterns

#### Action Management
- **Action Execution** - Execute configured actions
- **Action Monitoring** - Monitor action execution
- **Action Results** - Process action results
- **Action Error Handling** - Handle action errors
- **Action Analytics** - Analyze action performance

#### Performance Management
- **Execution Monitoring** - Monitor listener execution
- **Performance Optimization** - Optimize listener performance
- **Resource Management** - Manage listener resources
- **Load Balancing** - Balance listener load
- **Performance Analytics** - Analyze listener performance

## Listener Execution Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Listener Execution Timeout: 30 Seconds**
- **Per Execution**: Each listener execution has a **30-second timeout**
- **Timeout Behavior**: If execution takes too long → **FAILED**
- **Retry Logic**: Failed executions are retried up to 2 times
- **Total Execution Timeout**: 90 seconds for complete execution (including retries)

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Event Triggered**: Listener successfully triggered by event
- **Conditions Met**: All trigger conditions satisfied
- **Actions Executed**: All actions executed successfully
- **Results Processed**: Action results processed successfully

##### ❌ **Failure Cases**
- **Event Filter Failed**: Event doesn't match filter conditions
- **Condition Failed**: Trigger conditions not met
- **Action Failed**: Action execution failed
- **Execution Timeout**: Execution took longer than 30 seconds

### 📊 **Listener Execution Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   System Event  │    │   Listener       │    │  Check          │
│     Occurs      │───▶│   Triggered      │───▶│  Conditions     │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Execution      │◀───│  Execute Actions │◀───│  Conditions     │
│   SUCCESS       │    │  (30sec timeout) │    │  Met            │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Results        │◀───│  Process Results │◀───│  Actions        │
│   Logged        │    │  & Update Status │    │  Completed      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Execution Process**

#### **Step 1: Event Trigger**
```
System Event Occurs:
├── Event Data: Generated
├── Listener Lookup: Find matching listeners
├── Event Filtering: Apply event filters
└── Condition Check: Check trigger conditions
```

#### **Step 2: Action Execution**
```
Action Execution:
├── Start 30-second Timer
├── Execute Actions
├── Monitor Execution
├── Process Results
└── Update Execution Status
```

#### **Step 3: Execution Completion**
```
Execution Result:
├── Success → Mark as SUCCESS
├── Failure → Mark as FAILED
└── Timeout → Mark as TIMEOUT
```

## Common Workflows

### Workflow 1: Create and Configure Listener
1. **Create Listener** - Set up new listener with name and description
2. **Configure Events** - Select events to monitor
3. **Set Conditions** - Define trigger conditions
4. **Define Actions** - Configure actions to execute
5. **Test Listener** - Test listener configuration
6. **Activate Listener** - Activate listener for use
7. **Monitor Execution** - Monitor listener execution

### Workflow 2: Event Monitoring and Processing
1. **Select Listener** - Choose listener to monitor
2. **View Events** - Review monitored events
3. **Check Conditions** - Verify trigger conditions
4. **Monitor Execution** - Monitor listener execution
5. **Review Results** - Review execution results
6. **Analyze Performance** - Analyze listener performance
7. **Optimize Configuration** - Optimize listener configuration

### Workflow 3: Action Management and Execution
1. **Select Listener** - Choose listener to manage
2. **View Actions** - Review configured actions
3. **Update Actions** - Update action configuration
4. **Test Actions** - Test action execution
5. **Monitor Execution** - Monitor action execution
6. **Handle Errors** - Handle action errors
7. **Optimize Actions** - Optimize action performance

### Workflow 4: Listener Troubleshooting
1. **Identify Issue** - Determine listener problem
2. **Check Status** - Verify listener status
3. **Check Events** - Verify event monitoring
4. **Check Conditions** - Verify trigger conditions
5. **Check Actions** - Verify action configuration
6. **Check Logs** - Review execution logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Offline Alert Listener**

### **Example Listener: "Device Offline Alert"**
- **Event Type**: Device status change
- **Condition**: Device status = "offline"
- **Actions**: Send email alert, update dashboard, log event
- **Timeout**: 30 seconds per execution

### **Timeline & Expected Behavior**

#### **T+0:00 - Device Goes Offline**
```
System Event: Device Status Change
├── Device ID: "device_office_001"
├── Device Name: "Office Terminal 1"
├── Old Status: "online"
├── New Status: "offline"
└── Event Data: Generated
```

#### **T+0:01 - Listener Triggered**
```
Listener Triggered:
├── Listener ID: "listener_device_offline_001"
├── Event Type: "device.status.changed"
├── Condition Check: Status = "offline" ✓
└── Start 30-second Timer
```

#### **T+0:02 - Action Execution**
```
Action Execution:
├── Action 1: Send Email Alert
├── Action 2: Update Dashboard
├── Action 3: Log Event
├── Execution Status: RUNNING
└── Timer: 30 seconds
```

#### **T+0:05 - Actions Complete**
```
Actions Complete:
├── Action 1: Email sent successfully
├── Action 2: Dashboard updated
├── Action 3: Event logged
├── Execution Status: SUCCESS
└── Total Time: 5 seconds
```

#### **T+0:06 - Results Processed**
```
Results Processed:
├── Execution Status: SUCCESS
├── Results Logged
├── Listener Status: ACTIVE
└── Ready for Next Event
```

### **Total Execution Time: 6 seconds**
- **Event Processing**: 1 second
- **Condition Check**: 1 second
- **Action Execution**: 3 seconds
- **Results Processing**: 1 second
- **Within 30-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - Device Goes Offline**
```
System Event: Device Status Change
├── Device ID: "device_office_001"
├── Device Name: "Office Terminal 1"
├── Old Status: "online"
├── New Status: "offline"
└── Event Data: Generated
```

#### **T+0:01 - Listener Triggered**
```
Listener Triggered:
├── Listener ID: "listener_device_offline_001"
├── Event Type: "device.status.changed"
├── Condition Check: Status = "offline" ✓
└── Start 30-second Timer
```

#### **T+0:02 - Action Execution**
```
Action Execution:
├── Action 1: Send Email Alert
├── Action 2: Update Dashboard
├── Action 3: Log Event
├── Execution Status: RUNNING
└── Timer: 30 seconds
```

#### **T+0:31 - Execution Timeout**
```
Execution Timeout:
├── No response after 30 seconds
├── Execution Status: TIMEOUT
├── Retry Attempt 1: Restart execution
├── Start new 30-second Timer
└── Wait for completion
```

#### **T+1:01 - Retry Timeout**
```
Retry Timeout:
├── No response after 30 seconds (retry 1)
├── Execution Status: TIMEOUT
├── Retry Attempt 2: Restart execution
├── Start new 30-second Timer
└── Wait for completion
```

#### **T+1:31 - Final Timeout**
```
Final Timeout:
├── No response after 30 seconds (retry 2)
├── Execution Status: FAILED
├── Listener Status: ERROR
└── Execution Failed - Actions took too long
```

## Troubleshooting

### Common Issues

#### Listener Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify listener configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run listener validation

#### Event Monitoring Issues
- **Check Event Types** - Verify event types are correct
- **Check Event Filters** - Verify event filters are working
- **Check Event Conditions** - Verify trigger conditions
- **Check Event Data** - Verify event data format
- **Check Logs** - Review event monitoring logs

#### Action Execution Issues
- **Check Action Configuration** - Verify action configuration
- **Check Action Dependencies** - Verify action dependencies
- **Check Action Permissions** - Verify action permissions
- **Check Action Resources** - Verify action resources
- **Check Logs** - Review action execution logs

#### Performance Issues
- **Check Execution Time** - Monitor execution time
- **Check Success Rate** - Monitor execution success rate
- **Check Resource Usage** - Monitor resource usage
- **Check Load** - Monitor listener load
- **Check Logs** - Review performance logs

### Error Messages

#### "Listener Not Found"
- **Cause**: Listener ID doesn't exist in system
- **Solution**: Verify listener ID and check listener list

#### "Event Filter Failed"
- **Cause**: Event doesn't match filter conditions
- **Solution**: Check event filters and conditions

#### "Action Execution Failed"
- **Cause**: Action execution failed
- **Solution**: Check action configuration and dependencies

#### "Execution Timeout"
- **Cause**: Listener execution took too long
- **Solution**: Check action performance and optimize

#### "Condition Not Met"
- **Cause**: Trigger conditions not satisfied
- **Solution**: Check condition configuration and event data

## Best Practices

### Listener Design
- **Descriptive Names** - Use clear, descriptive listener names
- **Clear Conditions** - Define clear trigger conditions
- **Efficient Actions** - Use efficient action implementations
- **Error Handling** - Implement proper error handling
- **Performance Optimization** - Optimize listener performance

### Event Management
- **Event Filtering** - Use appropriate event filters
- **Event Validation** - Validate event data
- **Event Monitoring** - Monitor event patterns
- **Event Analytics** - Analyze event data
- **Event Optimization** - Optimize event processing

### Action Management
- **Action Efficiency** - Use efficient action implementations
- **Action Error Handling** - Handle action errors gracefully
- **Action Monitoring** - Monitor action execution
- **Action Analytics** - Analyze action performance
- **Action Optimization** - Optimize action performance

### Performance
- **Execution Time** - Optimize execution time
- **Resource Usage** - Optimize resource usage
- **Load Balancing** - Balance listener load
- **Monitoring** - Monitor listener performance
- **Optimization** - Continuously optimize performance

## Related Features

- **[Webhooks](./webhooks.md)** - Webhook integration for listener actions
- **[WhatsApp](./whatsapp.md)** - WhatsApp integration for notifications
- **[API Keys](./api_keys.md)** - API key management for listener actions
- **[Monitor](./monitor.md)** - System monitoring for listener performance
- **[Messaging Debug](./messaging_debug.md)** - Debug listener execution issues

## API Reference

### Listener Management API
- **GET /api/admin/settings/listeners** - List all listeners
- **POST /api/admin/settings/listeners** - Create new listener
- **GET /api/admin/settings/listeners/{id}** - Get listener details
- **PUT /api/admin/settings/listeners/{id}** - Update listener
- **DELETE /api/admin/settings/listeners/{id}** - Delete listener

### Listener Execution API
- **POST /api/admin/settings/listeners/{id}/test** - Test listener
- **GET /api/admin/settings/listeners/{id}/executions** - Get execution history
- **GET /api/admin/settings/listeners/{id}/stats** - Get listener statistics
- **POST /api/admin/settings/listeners/{id}/execute** - Execute listener manually

### Listener Events API
- **GET /api/admin/settings/listeners/events** - List available events
- **POST /api/admin/settings/listeners/{id}/events** - Subscribe to events
- **DELETE /api/admin/settings/listeners/{id}/events/{eventId}** - Unsubscribe from event
- **GET /api/admin/settings/listeners/{id}/events** - Get subscribed events

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Listener Logs** - Review listener execution logs
- **Execution Logs** - Check execution-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of listener management from creation to execution monitoring and troubleshooting.
