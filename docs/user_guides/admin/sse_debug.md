# SSE Debug User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Advanced

## Overview

SSE Debug provides comprehensive debugging and monitoring tools for Server-Sent Events (SSE) connections in the IoT Management System. It enables administrators to diagnose connection issues, monitor event flow, and troubleshoot real-time communication problems.

## Prerequisites

- **Admin permissions** - Full SSE debug access
- **SSE knowledge** - Understanding of Server-Sent Events
- **WebRTC understanding** - Knowledge of WebRTC technology
- **Network debugging** - Experience with network debugging tools

## Getting Started

### Quick Start
1. **Navigate to SSE Debug** - Go to Admin → Monitor & Debug → SSE Debug
2. **View Connection List** - Review active SSE connections
3. **Select Connection** - Choose connection to debug
4. **Monitor Events** - Monitor real-time event flow
5. **Analyze Issues** - Analyze connection issues
6. **Apply Fixes** - Apply debugging fixes

### Navigation
- **Menu Path**: Admin → Monitor & Debug → SSE Debug
- **URL**: `/admin/monitor/sse_debug`
- **Direct Access**: Click "SSE Debug" in the Monitor & Debug section

## Core Functionality

### SSE Connection List

#### Connection Information Display
- **Connection ID** - Unique connection identifier
- **User** - Associated user account
- **Device** - Associated device (if applicable)
- **Status** - Connected/Disconnected/Error
- **Created Date** - When connection was established
- **Last Activity** - Last activity timestamp
- **Event Count** - Number of events sent
- **Error Count** - Number of errors encountered
- **IP Address** - Client IP address
- **User Agent** - Client user agent

#### Connection Status Indicators
- 🟢 **Connected** - Connection is active
- 🔴 **Disconnected** - Connection is closed
- 🟡 **Error** - Connection has errors
- ⚪ **Connecting** - Connection is being established

#### Filtering and Search
- **Search by User** - Find connections by user
- **Search by Device** - Find connections by device
- **Filter by Status** - Show only active/inactive connections
- **Filter by Date** - Show connections by date
- **Filter by Errors** - Show connections with errors
- **Sort Options** - Sort by status, date, activity, errors, etc.

### SSE Connection Detail

#### Connection Information Tab
- **Basic Info** - Connection ID, user, device, status
- **Creation Info** - Created by, created date, last modified
- **Activity Info** - Last activity, event count, error count
- **Network Info** - IP address, user agent, connection details

#### Event Monitoring Tab
- **Live Events** - Real-time event stream
- **Event History** - Historical event log
- **Event Statistics** - Event statistics and metrics
- **Event Filters** - Filter events by type or content
- **Event Export** - Export event data

#### Debug Information Tab
- **Connection Logs** - Connection establishment logs
- **Error Logs** - Connection error logs
- **Performance Metrics** - Connection performance metrics
- **Network Diagnostics** - Network diagnostic information
- **Debug Tools** - Debug tools and utilities

## Advanced Features

### SSE Connection Debugging

#### Connection Analysis
- **Connection Establishment** - Analyze connection establishment
- **Connection Stability** - Analyze connection stability
- **Connection Performance** - Analyze connection performance
- **Connection Errors** - Analyze connection errors
- **Connection Patterns** - Analyze connection patterns

#### Event Flow Analysis
- **Event Timing** - Analyze event timing
- **Event Frequency** - Analyze event frequency
- **Event Content** - Analyze event content
- **Event Delivery** - Analyze event delivery
- **Event Processing** - Analyze event processing

#### Network Diagnostics
- **Network Connectivity** - Test network connectivity
- **Network Latency** - Measure network latency
- **Network Bandwidth** - Measure network bandwidth
- **Network Stability** - Test network stability
- **Network Errors** - Analyze network errors

### SSE Performance Monitoring

#### Performance Metrics
- **Connection Time** - Time to establish connection
- **Event Latency** - Time to deliver events
- **Event Throughput** - Events per second
- **Error Rate** - Connection error rate
- **Uptime** - Connection uptime

#### Performance Analysis
- **Performance Trends** - Analyze performance trends
- **Performance Bottlenecks** - Identify performance bottlenecks
- **Performance Optimization** - Optimize performance
- **Performance Alerts** - Set performance alerts
- **Performance Reports** - Generate performance reports

#### Performance Tuning
- **Connection Tuning** - Tune connection parameters
- **Event Tuning** - Tune event delivery
- **Network Tuning** - Tune network settings
- **Buffer Tuning** - Tune buffer settings
- **Timeout Tuning** - Tune timeout settings

## SSE Debug Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **SSE Connection Timeout: 30 Seconds**
- **Per Connection**: Each SSE connection has a **30-second timeout**
- **Timeout Behavior**: If connection takes too long → **FAILED**
- **Retry Logic**: Failed connections are retried up to 3 times
- **Total Connection Timeout**: 90 seconds for complete SSE connection

#### **SSE Event Delivery Timeout: 5 Seconds**
- **Per Event**: Each event delivery has a **5-second timeout**
- **Timeout Behavior**: If delivery takes too long → **FAILED**
- **Retry Logic**: Failed deliveries are retried up to 2 times
- **Total Event Timeout**: 15 seconds for complete event delivery

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Connection Established**: SSE connection established successfully
- **Events Delivered**: Events delivered successfully
- **Connection Stable**: Connection is stable and performing well
- **No Errors**: No connection or delivery errors

##### ❌ **Failure Cases**
- **Connection Timeout**: SSE connection took too long
- **Event Delivery Timeout**: Event delivery took too long
- **Network Issues**: Network connectivity problems
- **Server Errors**: Server-side errors
- **Client Errors**: Client-side errors

### 📊 **SSE Debug Operations Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SSE           │    │   Connection     │    │  SSE            │
│   Connection    │───▶│   Establishment  │───▶│   Connected     │
│   Request       │    │  (30sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Event          │◀───│  Event           │◀───│  Event          │
│   Delivered     │    │   Delivery       │    │   Generated     │
│  (5sec timeout) │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  SSE            │◀───│  SSE             │◀───│  SSE            │
│   Monitoring    │    │   Debugging      │    │   Active        │
│   Active        │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed SSE Debug Process**

#### **Step 1: SSE Connection**
```
SSE Connection Request:
├── Start 30-second Timer
├── Establish SSE Connection
├── Negotiate Connection Parameters
├── Verify Connection
└── Start Event Monitoring
```

#### **Step 2: Event Delivery**
```
Event Delivery:
├── Start 5-second Timer
├── Send Event to Client
├── Monitor Event Delivery
├── Verify Event Receipt
└── Update Event Statistics
```

#### **Step 3: SSE Monitoring**
```
SSE Monitoring:
├── Monitor Connection Status
├── Monitor Event Flow
├── Monitor Performance
├── Monitor Errors
└── Update Debug Information
```

## Common Workflows

### Workflow 1: SSE Connection Debugging
1. **Select Connection** - Choose SSE connection to debug
2. **View Connection Info** - Review connection information
3. **Check Connection Status** - Verify connection status
4. **Monitor Events** - Monitor real-time event flow
5. **Analyze Issues** - Analyze connection issues
6. **Apply Fixes** - Apply debugging fixes
7. **Verify Resolution** - Verify issues are resolved

### Workflow 2: Event Flow Analysis
1. **Select Connection** - Choose connection to analyze
2. **View Event History** - Review event history
3. **Analyze Event Patterns** - Analyze event patterns
4. **Check Event Timing** - Check event timing
5. **Identify Issues** - Identify event delivery issues
6. **Optimize Event Flow** - Optimize event delivery
7. **Monitor Results** - Monitor optimization results

### Workflow 3: Performance Monitoring
1. **Select Connection** - Choose connection to monitor
2. **View Performance Metrics** - Review performance metrics
3. **Analyze Performance Trends** - Analyze performance trends
4. **Identify Bottlenecks** - Identify performance bottlenecks
5. **Optimize Performance** - Optimize connection performance
6. **Test Changes** - Test performance changes
7. **Monitor Results** - Monitor performance results

### Workflow 4: SSE Troubleshooting
1. **Identify Issue** - Determine SSE problem
2. **Check Connection Status** - Verify connection status
3. **Check Event Flow** - Verify event flow
4. **Check Network** - Verify network connectivity
5. **Check Server Status** - Verify server status
6. **Check Logs** - Review SSE logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Status SSE Debug**

### **Example SSE Connection: "Device Status Updates"**
- **Connection ID**: "sse_device_status_001"
- **User**: "admin@company.com"
- **Device**: "Office Terminal 1"
- **Event Type**: Device status updates
- **Purpose**: Real-time device monitoring

### **Timeline & Expected Behavior**

#### **T+0:00 - SSE Connection Request**
```
Client Request: SSE Connection
├── Connection ID: "sse_device_status_001"
├── User: "admin@company.com"
├── Start 30-second Timer
└── Begin SSE Connection
```

#### **T+0:05 - Connection Established**
```
SSE Connection Established:
├── Connection Status: CONNECTED
├── Event Stream: Active
├── Connection ID: "sse_device_status_001"
└── Connection Ready for Events
```

#### **T+0:10 - Event Delivery**
```
Event Delivery:
├── Event Type: "device.status.changed"
├── Event Data: {"deviceId": "device_001", "status": "online"}
├── Start 5-second Timer
└── Send Event to Client
```

#### **T+0:12 - Event Delivered**
```
Event Delivered:
├── Event Status: DELIVERED
├── Delivery Time: 2 seconds
├── Client Response: Received
└── Event Delivery: SUCCESS
```

#### **T+0:15 - SSE Monitoring**
```
SSE Monitoring:
├── Connection Status: ACTIVE
├── Event Count: 1
├── Error Count: 0
└── SSE Debug: Active
```

### **Total Connection Time: 15 seconds**
- **Connection Establishment**: 5 seconds
- **Event Delivery**: 2 seconds
- **SSE Monitoring**: 8 seconds
- **Within 30-second connection timeout**

### **Event Delivery Example**

#### **T+0:00 - Event Generation**
```
System Event: Device Status Change
├── Device ID: "device_001"
├── Status: "offline"
├── Event Type: "device.status.changed"
└── Event Data: Generated
```

#### **T+0:01 - Event Delivery Start**
```
Event Delivery Start:
├── Event: "device.status.changed"
├── Data: {"deviceId": "device_001", "status": "offline"}
├── Start 5-second Timer
└── Send Event to Client
```

#### **T+0:03 - Event Delivered**
```
Event Delivered:
├── Event Status: DELIVERED
├── Delivery Time: 2 seconds
├── Client Response: Received
└── Event Delivery: SUCCESS
```

### **Total Event Delivery: 3 seconds**
- **Event Generation**: 1 second
- **Event Delivery**: 2 seconds
- **Within 5-second delivery timeout**

### **Failure Scenario Example**

#### **T+0:00 - SSE Connection Request**
```
Client Request: SSE Connection
├── Connection ID: "sse_device_status_001"
├── User: "admin@company.com"
├── Start 30-second Timer
└── Begin SSE Connection
```

#### **T+0:05 - Connection Attempt**
```
Connection Attempt:
├── WebRTC Connection: Attempting
├── Server Status: Unresponsive
├── Network Status: Poor
└── Connection Status: FAILING
```

#### **T+0:31 - Connection Timeout**
```
Connection Timeout:
├── No response after 30 seconds
├── Connection Status: TIMEOUT
├── Retry Attempt 1: Restart connection
└── Start new 30-second Timer
```

#### **T+1:01 - Retry Timeout**
```
Retry Timeout:
├── No response after 30 seconds (retry 1)
├── Connection Status: TIMEOUT
├── Retry Attempt 2: Restart connection
└── Start new 30-second Timer
```

#### **T+1:31 - Final Timeout**
```
Final Timeout:
├── No response after 30 seconds (retry 2)
├── Connection Status: FAILED
├── SSE Debug Status: ERROR
└── SSE Connection Failed - Server unresponsive
```

## Troubleshooting

### Common Issues

#### SSE Connection Failures
- **Check Server Status** - Verify server is running
- **Check Network** - Verify network connectivity
- **Check Firewall** - Verify firewall settings
- **Check WebRTC** - Verify WebRTC support
- **Check Logs** - Review connection logs

#### Event Delivery Failures
- **Check Connection Status** - Verify connection is active
- **Check Event Format** - Verify event format
- **Check Client Status** - Verify client is responsive
- **Check Network Latency** - Verify network latency
- **Check Logs** - Review delivery logs

#### Performance Issues
- **Check Connection Load** - Monitor connection load
- **Check Event Volume** - Monitor event volume
- **Check Network Performance** - Monitor network performance
- **Check Server Performance** - Monitor server performance
- **Check Logs** - Review performance logs

#### Debug Issues
- **Check Debug Tools** - Verify debug tools are working
- **Check Debug Data** - Verify debug data is available
- **Check Debug Logs** - Verify debug logs are being generated
- **Check Debug Performance** - Monitor debug performance
- **Check Logs** - Review debug logs

### Error Messages

#### "SSE Connection Failed"
- **Cause**: Unable to establish SSE connection
- **Solution**: Check server status and network connectivity

#### "Event Delivery Timeout"
- **Cause**: Event delivery took too long
- **Solution**: Check network performance and client status

#### "Connection Timeout"
- **Cause**: SSE connection took too long
- **Solution**: Check server performance and network connectivity

#### "Event Format Error"
- **Cause**: Event format is invalid
- **Solution**: Check event format and data structure

#### "Debug Data Unavailable"
- **Cause**: Debug data not available
- **Solution**: Check debug tools and data collection

## Best Practices

### SSE Debug Design
- **Comprehensive Monitoring** - Monitor all SSE connections
- **Real-time Analysis** - Analyze connections in real-time
- **Performance Tracking** - Track connection performance
- **Error Detection** - Detect connection errors quickly
- **Automated Alerts** - Set up automated alerts

### Connection Management
- **Connection Monitoring** - Monitor connection status
- **Connection Optimization** - Optimize connection performance
- **Connection Troubleshooting** - Troubleshoot connection issues
- **Connection Maintenance** - Maintain connection health
- **Connection Analytics** - Analyze connection patterns

### Event Management
- **Event Monitoring** - Monitor event delivery
- **Event Optimization** - Optimize event delivery
- **Event Troubleshooting** - Troubleshoot event issues
- **Event Analytics** - Analyze event patterns
- **Event Performance** - Monitor event performance

### Debug Management
- **Debug Tools** - Use appropriate debug tools
- **Debug Data** - Collect comprehensive debug data
- **Debug Analysis** - Analyze debug data effectively
- **Debug Reporting** - Generate debug reports
- **Debug Optimization** - Optimize debug performance

## Related Features

- **[Messaging Debug](./messaging_debug.md)** - Debug messaging issues
- **[Redis Debug](./redis_debug.md)** - Debug Redis data flow
- **[Monitor](./monitor.md)** - System monitoring
- **[Streams](./streams.md)** - Stream monitoring
- **[Preview](./preview.md)** - Preview monitoring

## API Reference

### SSE Debug Management API
- **GET /api/admin/monitor/sse_debug** - Get SSE debug status
- **GET /api/admin/monitor/sse_debug/connections** - Get SSE connections
- **GET /api/admin/monitor/sse_debug/events** - Get SSE events
- **GET /api/admin/monitor/sse_debug/performance** - Get SSE performance

### SSE Debug Operations API
- **POST /api/admin/monitor/sse_debug/connect** - Test SSE connection
- **GET /api/admin/monitor/sse_debug/logs** - Get SSE debug logs
- **GET /api/admin/monitor/sse_debug/metrics** - Get SSE metrics
- **POST /api/admin/monitor/sse_debug/analyze** - Analyze SSE connection

### SSE Debug Configuration API
- **GET /api/admin/monitor/sse_debug/config** - Get SSE debug configuration
- **PUT /api/admin/monitor/sse_debug/config** - Update SSE debug configuration
- **GET /api/admin/monitor/sse_debug/tools** - Get SSE debug tools
- **POST /api/admin/monitor/sse_debug/test** - Test SSE debug tools

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **SSE Debug Logs** - Review SSE debug operation logs
- **Connection Logs** - Check connection-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of SSE debugging from connection monitoring to event analysis and troubleshooting.
