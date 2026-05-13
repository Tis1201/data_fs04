# Redis Debug User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Advanced

## Overview

Redis Debug provides comprehensive debugging and monitoring tools for Redis operations in the IoT Management System. It enables administrators to diagnose Redis connection issues, monitor data flow, and troubleshoot real-time communication problems across the Redis pub/sub system.

## Prerequisites

- **Admin permissions** - Full Redis debug access
- **Redis knowledge** - Understanding of Redis operations
- **Pub/Sub understanding** - Knowledge of Redis pub/sub patterns
- **Network debugging** - Experience with network debugging tools

## Getting Started

### Quick Start
1. **Navigate to Redis Debug** - Go to Admin → Monitor & Debug → Redis Debug
2. **View Redis Status** - Review Redis connection status
3. **Monitor Data Flow** - Monitor Redis data flow
4. **Check Channels** - Check Redis pub/sub channels
5. **Analyze Issues** - Analyze Redis issues
6. **Apply Fixes** - Apply debugging fixes

### Navigation
- **Menu Path**: Admin → Monitor & Debug → Redis Debug
- **URL**: `/admin/monitor/redis_debug`
- **Direct Access**: Click "Redis Debug" in the Monitor & Debug section

## Core Functionality

### Redis Status Dashboard

#### Redis Connection Information
- **Connection Status** - Connected/Disconnected/Error
- **Redis Version** - Redis server version
- **Connection Count** - Number of active connections
- **Memory Usage** - Redis memory usage
- **CPU Usage** - Redis CPU usage
- **Operations Count** - Number of operations per second
- **Key Count** - Number of keys in Redis
- **Expired Keys** - Number of expired keys

#### Redis Performance Metrics
- **Response Time** - Average response time
- **Throughput** - Operations per second
- **Hit Rate** - Cache hit rate
- **Miss Rate** - Cache miss rate
- **Memory Efficiency** - Memory usage efficiency
- **Connection Efficiency** - Connection usage efficiency
- **Performance Score** - Overall performance score

#### Redis Health Indicators
- 🟢 **Healthy** - Redis is healthy and performing well
- 🟡 **Warning** - Redis has performance warnings
- 🔴 **Critical** - Redis has critical issues
- ⚪ **Unknown** - Redis status is unknown

### Redis Channel Monitoring

#### Channel Information Display
- **Channel Name** - Redis pub/sub channel name
- **Subscriber Count** - Number of subscribers
- **Message Count** - Number of messages sent
- **Last Message** - Last message timestamp
- **Message Rate** - Messages per second
- **Channel Status** - Active/Inactive/Error
- **Data Size** - Channel data size
- **Memory Usage** - Channel memory usage

#### Channel Status Indicators
- 🟢 **Active** - Channel is active and receiving messages
- 🔴 **Inactive** - Channel is inactive
- 🟡 **Error** - Channel has errors
- ⚪ **Unknown** - Channel status is unknown

#### Filtering and Search
- **Search by Channel** - Find channels by name
- **Filter by Status** - Show only active/inactive channels
- **Filter by Activity** - Show channels by activity level
- **Filter by Date** - Show channels by date
- **Sort Options** - Sort by name, status, activity, date, etc.

### Redis Data Flow Monitoring

#### Data Flow Information
- **Data Type** - Type of data being processed
- **Data Source** - Source of the data
- **Data Destination** - Destination of the data
- **Data Size** - Size of the data
- **Processing Time** - Time to process data
- **Success Rate** - Data processing success rate
- **Error Rate** - Data processing error rate

#### Data Flow Status Indicators
- 🟢 **Flowing** - Data is flowing normally
- 🔴 **Blocked** - Data flow is blocked
- 🟡 **Slow** - Data flow is slow
- ⚪ **Unknown** - Data flow status is unknown

## Advanced Features

### Redis Connection Debugging

#### Connection Analysis
- **Connection Establishment** - Analyze connection establishment
- **Connection Stability** - Analyze connection stability
- **Connection Performance** - Analyze connection performance
- **Connection Errors** - Analyze connection errors
- **Connection Patterns** - Analyze connection patterns

#### Connection Monitoring
- **Connection Count** - Monitor connection count
- **Connection Duration** - Monitor connection duration
- **Connection Usage** - Monitor connection usage
- **Connection Efficiency** - Monitor connection efficiency
- **Connection Health** - Monitor connection health

#### Connection Optimization
- **Connection Pooling** - Optimize connection pooling
- **Connection Reuse** - Optimize connection reuse
- **Connection Timeout** - Optimize connection timeout
- **Connection Limits** - Optimize connection limits
- **Connection Performance** - Optimize connection performance

### Redis Data Flow Analysis

#### Data Flow Monitoring
- **Data Flow Rate** - Monitor data flow rate
- **Data Flow Latency** - Monitor data flow latency
- **Data Flow Throughput** - Monitor data flow throughput
- **Data Flow Errors** - Monitor data flow errors
- **Data Flow Performance** - Monitor data flow performance

#### Data Flow Analysis
- **Data Flow Patterns** - Analyze data flow patterns
- **Data Flow Bottlenecks** - Identify data flow bottlenecks
- **Data Flow Optimization** - Optimize data flow
- **Data Flow Alerts** - Set data flow alerts
- **Data Flow Reports** - Generate data flow reports

#### Data Flow Troubleshooting
- **Data Flow Issues** - Troubleshoot data flow issues
- **Data Flow Debugging** - Debug data flow problems
- **Data Flow Testing** - Test data flow functionality
- **Data Flow Validation** - Validate data flow
- **Data Flow Monitoring** - Monitor data flow health

## Redis Debug Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Redis Connection Timeout: 5 Seconds**
- **Per Connection**: Each Redis connection has a **5-second timeout**
- **Timeout Behavior**: If connection takes too long → **FAILED**
- **Retry Logic**: Failed connections are retried up to 3 times
- **Total Connection Timeout**: 15 seconds for complete Redis connection

#### **Redis Operation Timeout: 2 Seconds**
- **Per Operation**: Each Redis operation has a **2-second timeout**
- **Timeout Behavior**: If operation takes too long → **FAILED**
- **Retry Logic**: Failed operations are retried up to 2 times
- **Total Operation Timeout**: 6 seconds for complete Redis operation

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Connection Established**: Redis connection established successfully
- **Operation Completed**: Redis operation completed successfully
- **Data Flowing**: Data is flowing through Redis
- **No Errors**: No connection or operation errors

##### ❌ **Failure Cases**
- **Connection Timeout**: Redis connection took too long
- **Operation Timeout**: Redis operation took too long
- **Network Issues**: Network connectivity problems
- **Redis Server Error**: Redis server-side errors
- **Client Error**: Client-side errors

### 📊 **Redis Debug Operations Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Redis         │    │   Connection     │    │  Redis          │
│   Connection    │───▶│   Establishment  │───▶│   Connected     │
│   Request       │    │  (5sec timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Redis          │◀───│  Redis           │◀───│  Redis          │
│   Operation     │    │   Operation      │    │   Data          │
│   Complete      │    │  (2sec timeout)  │    │   Flowing       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Redis          │◀───│  Redis           │◀───│  Redis          │
│   Monitoring    │    │   Debugging      │    │   Active        │
│   Active        │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Redis Debug Process**

#### **Step 1: Redis Connection**
```
Redis Connection Request:
├── Start 5-second Timer
├── Establish Redis Connection
├── Authenticate Connection
├── Verify Connection
└── Start Operation Monitoring
```

#### **Step 2: Redis Operation**
```
Redis Operation:
├── Start 2-second Timer
├── Execute Redis Command
├── Monitor Operation
├── Process Response
└── Update Operation Status
```

#### **Step 3: Redis Monitoring**
```
Redis Monitoring:
├── Monitor Connection Status
├── Monitor Data Flow
├── Monitor Performance
├── Monitor Errors
└── Update Debug Information
```

## Common Workflows

### Workflow 1: Redis Connection Debugging
1. **Select Connection** - Choose Redis connection to debug
2. **View Connection Info** - Review connection information
3. **Check Connection Status** - Verify connection status
4. **Monitor Data Flow** - Monitor Redis data flow
5. **Analyze Issues** - Analyze connection issues
6. **Apply Fixes** - Apply debugging fixes
7. **Verify Resolution** - Verify issues are resolved

### Workflow 2: Redis Data Flow Analysis
1. **Select Data Flow** - Choose data flow to analyze
2. **View Data Flow Info** - Review data flow information
3. **Monitor Data Flow** - Monitor data flow in real-time
4. **Analyze Patterns** - Analyze data flow patterns
5. **Identify Issues** - Identify data flow issues
6. **Optimize Flow** - Optimize data flow
7. **Monitor Results** - Monitor optimization results

### Workflow 3: Redis Performance Monitoring
1. **Select Redis Instance** - Choose Redis instance to monitor
2. **View Performance Metrics** - Review performance metrics
3. **Analyze Performance Trends** - Analyze performance trends
4. **Identify Bottlenecks** - Identify performance bottlenecks
5. **Optimize Performance** - Optimize Redis performance
6. **Test Changes** - Test performance changes
7. **Monitor Results** - Monitor performance results

### Workflow 4: Redis Troubleshooting
1. **Identify Issue** - Determine Redis problem
2. **Check Connection Status** - Verify connection status
3. **Check Data Flow** - Verify data flow
4. **Check Redis Server** - Verify Redis server status
5. **Check Network** - Verify network connectivity
6. **Check Logs** - Review Redis logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Status Redis Debug**

### **Example Redis Operation: "Device Status Update"**
- **Operation Type**: Redis SET
- **Key**: "device:status:device_001"
- **Value**: "offline"
- **Channel**: "device:status"
- **Purpose**: Update device status in Redis

### **Timeline & Expected Behavior**

#### **T+0:00 - Redis Connection Request**
```
System Request: Redis Operation
├── Operation: SET
├── Key: "device:status:device_001"
├── Value: "offline"
├── Start 5-second Timer
└── Begin Redis Connection
```

#### **T+0:01 - Connection Established**
```
Redis Connection Established:
├── Connection Status: CONNECTED
├── Redis Version: 6.2.7
├── Connection ID: "redis_conn_001"
└── Connection Ready for Operations
```

#### **T+0:02 - Redis Operation**
```
Redis Operation:
├── Start 2-second Timer
├── Command: SET device:status:device_001 offline
├── Operation Status: EXECUTING
└── Wait for Response
```

#### **T+0:03 - Operation Complete**
```
Operation Complete:
├── Response: OK
├── Operation Time: 1 second
├── Operation Status: SUCCESS
└── Data Updated in Redis
```

#### **T+0:04 - Pub/Sub Notification**
```
Pub/Sub Notification:
├── Channel: "device:status"
├── Message: {"deviceId": "device_001", "status": "offline"}
├── Subscribers: 3
└── Notification Sent
```

### **Total Operation Time: 4 seconds**
- **Connection Establishment**: 1 second
- **Redis Operation**: 1 second
- **Pub/Sub Notification**: 2 seconds
- **Within 5-second connection timeout**

### **Data Flow Example**

#### **T+0:00 - Data Flow Start**
```
Data Flow: Device Status Update
├── Source: Device Management System
├── Destination: Redis Database
├── Data Type: Device Status
└── Data Flow Started
```

#### **T+0:01 - Data Processing**
```
Data Processing:
├── Data Validation: VALID
├── Data Format: JSON
├── Data Size: 50 bytes
└── Data Processing: SUCCESS
```

#### **T+0:02 - Data Storage**
```
Data Storage:
├── Redis Operation: SET
├── Key: "device:status:device_001"
├── Value: "offline"
└── Data Storage: SUCCESS
```

#### **T+0:03 - Data Broadcasting**
```
Data Broadcasting:
├── Channel: "device:status"
├── Subscribers: 3
├── Message: {"deviceId": "device_001", "status": "offline"}
└── Data Broadcasting: SUCCESS
```

### **Total Data Flow Time: 3 seconds**
- **Data Processing**: 1 second
- **Data Storage**: 1 second
- **Data Broadcasting**: 1 second
- **Within 2-second operation timeout**

### **Failure Scenario Example**

#### **T+0:00 - Redis Connection Request**
```
System Request: Redis Operation
├── Operation: SET
├── Key: "device:status:device_001"
├── Value: "offline"
├── Start 5-second Timer
└── Begin Redis Connection
```

#### **T+0:01 - Connection Attempt**
```
Connection Attempt:
├── Redis Server: Unresponsive
├── Network Status: Poor
├── Connection Status: FAILING
└── Retry Attempt 1
```

#### **T+0:06 - Connection Timeout**
```
Connection Timeout:
├── No response after 5 seconds
├── Connection Status: TIMEOUT
├── Retry Attempt 2: Restart connection
└── Start new 5-second Timer
```

#### **T+0:11 - Retry Timeout**
```
Retry Timeout:
├── No response after 5 seconds (retry 1)
├── Connection Status: TIMEOUT
├── Retry Attempt 3: Restart connection
└── Start new 5-second Timer
```

#### **T+0:16 - Final Timeout**
```
Final Timeout:
├── No response after 5 seconds (retry 2)
├── Connection Status: FAILED
├── Redis Debug Status: ERROR
└── Redis Operation Failed - Server unresponsive
```

## Troubleshooting

### Common Issues

#### Redis Connection Failures
- **Check Redis Server** - Verify Redis server is running
- **Check Network** - Verify network connectivity
- **Check Authentication** - Verify Redis authentication
- **Check Firewall** - Verify firewall settings
- **Check Logs** - Review connection logs

#### Redis Operation Failures
- **Check Operation Format** - Verify operation format
- **Check Data Format** - Verify data format
- **Check Redis Memory** - Verify Redis memory usage
- **Check Redis Performance** - Verify Redis performance
- **Check Logs** - Review operation logs

#### Data Flow Issues
- **Check Data Source** - Verify data source is working
- **Check Data Format** - Verify data format is correct
- **Check Data Processing** - Verify data processing
- **Check Data Storage** - Verify data storage
- **Check Logs** - Review data flow logs

#### Performance Issues
- **Check Redis Performance** - Monitor Redis performance
- **Check Network Performance** - Monitor network performance
- **Check Data Volume** - Monitor data volume
- **Check Operation Load** - Monitor operation load
- **Check Logs** - Review performance logs

### Error Messages

#### "Redis Connection Failed"
- **Cause**: Unable to connect to Redis server
- **Solution**: Check Redis server status and network connectivity

#### "Redis Operation Timeout"
- **Cause**: Redis operation took too long
- **Solution**: Check Redis performance and operation complexity

#### "Data Flow Blocked"
- **Cause**: Data flow is blocked
- **Solution**: Check data source and processing pipeline

#### "Redis Memory Full"
- **Cause**: Redis memory is full
- **Solution**: Check Redis memory usage and cleanup

#### "Debug Data Unavailable"
- **Cause**: Debug data not available
- **Solution**: Check debug tools and data collection

## Best Practices

### Redis Debug Design
- **Comprehensive Monitoring** - Monitor all Redis operations
- **Real-time Analysis** - Analyze Redis operations in real-time
- **Performance Tracking** - Track Redis performance
- **Error Detection** - Detect Redis errors quickly
- **Automated Alerts** - Set up automated alerts

### Connection Management
- **Connection Monitoring** - Monitor connection status
- **Connection Optimization** - Optimize connection performance
- **Connection Troubleshooting** - Troubleshoot connection issues
- **Connection Analytics** - Analyze connection patterns
- **Connection Maintenance** - Maintain connection health

### Data Flow Management
- **Data Flow Monitoring** - Monitor data flow
- **Data Flow Optimization** - Optimize data flow
- **Data Flow Troubleshooting** - Troubleshoot data flow issues
- **Data Flow Analytics** - Analyze data flow patterns
- **Data Flow Performance** - Monitor data flow performance

### Debug Management
- **Debug Tools** - Use appropriate debug tools
- **Debug Data** - Collect comprehensive debug data
- **Debug Analysis** - Analyze debug data effectively
- **Debug Reporting** - Generate debug reports
- **Debug Optimization** - Optimize debug performance

## Related Features

- **[SSE Debug](./sse_debug.md)** - Debug SSE connection issues
- **[Messaging Debug](./messaging_debug.md)** - Debug messaging issues
- **[Monitor](./monitor.md)** - System monitoring
- **[Webhooks](./webhooks.md)** - Webhook message delivery
- **[WhatsApp](./whatsapp.md)** - WhatsApp message delivery

## API Reference

### Redis Debug Management API
- **GET /api/admin/monitor/redis_debug** - Get Redis debug status
- **GET /api/admin/monitor/redis_debug/connections** - Get Redis connections
- **GET /api/admin/monitor/redis_debug/operations** - Get Redis operations
- **GET /api/admin/monitor/redis_debug/performance** - Get Redis performance

### Redis Debug Operations API
- **POST /api/admin/monitor/redis_debug/test** - Test Redis connection
- **GET /api/admin/monitor/redis_debug/logs** - Get Redis debug logs
- **GET /api/admin/monitor/redis_debug/metrics** - Get Redis metrics
- **POST /api/admin/monitor/redis_debug/analyze** - Analyze Redis operations

### Redis Debug Configuration API
- **GET /api/admin/monitor/redis_debug/config** - Get Redis debug configuration
- **PUT /api/admin/monitor/redis_debug/config** - Update Redis debug configuration
- **GET /api/admin/monitor/redis_debug/tools** - Get Redis debug tools
- **POST /api/admin/monitor/redis_debug/optimize** - Optimize Redis performance

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Redis Debug Logs** - Review Redis debug operation logs
- **Connection Logs** - Check connection-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of Redis debugging from connection monitoring to data flow analysis and troubleshooting.
