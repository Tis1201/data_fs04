# Streams User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Streams provide real-time video and audio streaming capabilities for IoT devices. They enable remote monitoring, surveillance, and communication through live video feeds, allowing administrators to monitor device environments and interact with devices in real-time.

## Prerequisites

- **Admin permissions** - Full stream management access
- **Video streaming knowledge** - Understanding of video streaming concepts
- **WebRTC understanding** - Knowledge of WebRTC technology
- **Network awareness** - Understanding of network requirements for streaming

## Getting Started

### Quick Start
1. **Navigate to Streams** - Go to Admin → Vision → Streams
2. **View Stream List** - Review available streams
3. **Create New Stream** - Create new stream for device
4. **Configure Stream** - Set stream parameters and quality
5. **Start Stream** - Start streaming from device
6. **Monitor Stream** - Monitor stream quality and performance

### Navigation
- **Menu Path**: Admin → Vision → Streams
- **URL**: `/admin/vision/streams`
- **Direct Access**: Click "Streams" in the Vision section

## Core Functionality

### Stream List View

#### Stream Information Display
- **Stream Name** - Human-readable stream name
- **Stream ID** - Unique system identifier
- **Device** - Associated device
- **Status** - Active/Inactive/Error
- **Stream Type** - Video/Audio/Both
- **Quality** - Stream quality (HD, SD, etc.)
- **Created Date** - When stream was created
- **Last Active** - Last time stream was active
- **Viewer Count** - Number of active viewers
- **Bitrate** - Current stream bitrate

#### Stream Status Indicators
- 🟢 **Active** - Stream is active and streaming
- 🔴 **Inactive** - Stream is stopped
- 🟡 **Error** - Stream has errors
- ⚪ **Connecting** - Stream is connecting

#### Filtering and Search
- **Search by Name** - Find streams by name
- **Search by Device** - Find streams by device
- **Filter by Status** - Show only active/inactive streams
- **Filter by Type** - Show streams by type
- **Filter by Quality** - Show streams by quality
- **Sort Options** - Sort by name, status, device, quality, etc.

### Stream Detail View

#### Stream Information Tab
- **Basic Info** - Name, ID, device, status
- **Creation Info** - Created by, created date, last modified
- **Stream Info** - Type, quality, bitrate, resolution
- **Performance Info** - Viewer count, uptime, performance metrics

#### Stream Configuration Tab
- **Stream Settings** - Stream-specific settings
- **Quality Settings** - Video/audio quality configuration
- **Network Settings** - Network and bandwidth settings
- **Security Settings** - Stream security settings
- **Metadata** - Additional stream metadata

#### Stream Monitoring Tab
- **Live View** - Live stream view
- **Performance Metrics** - Stream performance metrics
- **Viewer Analytics** - Viewer analytics and statistics
- **Error Logs** - Stream error logs
- **Quality Metrics** - Stream quality metrics

## Advanced Features

### Stream Creation

#### Basic Stream Setup
- **Stream Name** - Choose descriptive name
- **Description** - Add detailed description
- **Device Selection** - Select source device
- **Stream Type** - Select stream type (video/audio/both)
- **Quality** - Set stream quality
- **Status** - Set initial stream status

#### Stream Configuration
- **Video Settings** - Configure video parameters
- **Audio Settings** - Configure audio parameters
- **Network Settings** - Configure network parameters
- **Security Settings** - Configure security settings
- **Quality Settings** - Configure quality parameters

#### Stream Optimization
- **Bitrate Optimization** - Optimize stream bitrate
- **Quality Adaptation** - Configure quality adaptation
- **Network Adaptation** - Configure network adaptation
- **Performance Tuning** - Tune stream performance
- **Resource Management** - Manage stream resources

### Stream Management

#### Stream Lifecycle
- **Stream Creation** - Create new streams
- **Stream Activation** - Activate streams
- **Stream Monitoring** - Monitor stream performance
- **Stream Optimization** - Optimize stream performance
- **Stream Cleanup** - Clean up inactive streams

#### Stream Quality
- **Quality Monitoring** - Monitor stream quality
- **Quality Adaptation** - Adapt quality to network conditions
- **Quality Optimization** - Optimize stream quality
- **Quality Metrics** - Track quality metrics
- **Quality Alerts** - Set quality alerts

#### Stream Security
- **Access Control** - Control stream access
- **Authentication** - Authenticate stream viewers
- **Encryption** - Encrypt stream data
- **Privacy Protection** - Protect stream privacy
- **Security Monitoring** - Monitor stream security

## Stream Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Stream Connection Timeout: 30 Seconds**
- **Per Stream**: Each stream connection has a **30-second timeout**
- **Timeout Behavior**: If connection takes too long → **FAILED**
- **Retry Logic**: Failed connections are retried up to 3 times
- **Total Connection Timeout**: 90 seconds for complete stream connection

#### **Stream Quality Check Timeout: 10 Seconds**
- **Per Check**: Each quality check has a **10-second timeout**
- **Timeout Behavior**: If check takes too long → **SKIPPED**
- **Retry Logic**: Failed checks are retried up to 2 times
- **Total Quality Check Timeout**: 30 seconds for complete quality check

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Stream Connected**: Stream successfully connected to device
- **Quality Good**: Stream quality is acceptable
- **Viewers Connected**: Viewers can access stream
- **Stream Stable**: Stream is stable and performing well

##### ❌ **Failure Cases**
- **Connection Timeout**: Stream connection took too long
- **Device Offline**: Source device is offline
- **Network Issues**: Network connectivity problems
- **Quality Poor**: Stream quality is unacceptable
- **Resource Exhausted**: Insufficient system resources

### 📊 **Stream Connection Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Stream        │    │   Device         │    │  Stream         │
│   Request       │───▶│   Connection     │───▶│   Connected     │
│                 │    │  (30sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Stream Quality │◀───│  Quality Check   │◀───│  Stream Data    │
│   Verified      │    │  (10sec timeout) │    │   Flowing       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Viewers        │◀───│  Stream          │◀───│  Stream         │
│   Connected     │    │   Broadcasting   │    │   Active        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Stream Connection Process**

#### **Step 1: Stream Connection**
```
Stream Request:
├── Start 30-second Timer
├── Connect to Device
├── Establish WebRTC Connection
├── Negotiate Stream Parameters
└── Verify Connection
```

#### **Step 2: Quality Check**
```
Connection Established:
├── Start 10-second Timer
├── Check Stream Quality
├── Verify Video/Audio
├── Test Network Performance
└── Validate Stream Parameters
```

#### **Step 3: Stream Broadcasting**
```
Quality Verified:
├── Start Stream Broadcasting
├── Enable Viewer Access
├── Monitor Stream Performance
└── Update Stream Status
```

## Common Workflows

### Workflow 1: Create and Start Stream
1. **Create Stream** - Set up new stream with name and device
2. **Configure Settings** - Set stream quality and parameters
3. **Test Connection** - Test connection to device
4. **Start Stream** - Start streaming from device
5. **Monitor Quality** - Monitor stream quality
6. **Enable Viewers** - Enable viewer access
7. **Monitor Performance** - Monitor stream performance

### Workflow 2: Stream Quality Management
1. **Select Stream** - Choose stream to manage
2. **View Quality Metrics** - Review current quality metrics
3. **Adjust Quality** - Adjust stream quality settings
4. **Monitor Performance** - Monitor performance impact
5. **Optimize Settings** - Optimize stream settings
6. **Test Changes** - Test quality changes
7. **Apply Configuration** - Apply optimized configuration

### Workflow 3: Stream Monitoring and Maintenance
1. **Select Stream** - Choose stream to monitor
2. **View Performance** - Review stream performance
3. **Check Quality** - Check stream quality
4. **Monitor Viewers** - Monitor viewer activity
5. **Review Logs** - Review stream logs
6. **Identify Issues** - Identify performance issues
7. **Take Action** - Take corrective actions

### Workflow 4: Stream Troubleshooting
1. **Identify Issue** - Determine stream problem
2. **Check Stream Status** - Verify stream status
3. **Check Device Status** - Verify device status
4. **Check Network** - Verify network connectivity
5. **Check Quality** - Verify stream quality
6. **Check Logs** - Review stream logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Office Security Stream**

### **Example Stream: "Office Security Camera"**
- **Device**: "Office Security Camera 1"
- **Stream Type**: Video
- **Quality**: HD (1080p)
- **Bitrate**: 2 Mbps
- **Viewers**: Security team

### **Timeline & Expected Behavior**

#### **T+0:00 - Stream Request**
```
Admin Action: Start Office Security Stream
├── Device: "Office Security Camera 1"
├── Quality: HD (1080p)
├── Start 30-second Timer
└── Begin Stream Connection
```

#### **T+0:05 - Device Connection**
```
Device Connection:
├── WebRTC Connection: Established
├── Device Status: Online
├── Camera Status: Active
└── Connection Status: CONNECTED
```

#### **T+0:10 - Stream Quality Check**
```
Stream Quality Check:
├── Start 10-second Timer
├── Video Quality: HD (1080p)
├── Frame Rate: 30 fps
├── Bitrate: 2 Mbps
└── Quality Status: GOOD
```

#### **T+0:15 - Stream Broadcasting**
```
Stream Broadcasting:
├── Stream Status: ACTIVE
├── Viewers: 0
├── Quality: HD (1080p)
└── Stream Ready for Viewers
```

#### **T+0:20 - Viewer Connection**
```
Viewer Connection:
├── Security Team: Connected
├── Viewer Count: 1
├── Stream Quality: HD (1080p)
└── Stream Active
```

### **Total Connection Time: 20 seconds**
- **Device Connection**: 5 seconds
- **Quality Check**: 5 seconds
- **Stream Broadcasting**: 5 seconds
- **Viewer Connection**: 5 seconds
- **Within 30-second connection timeout**

### **Failure Scenario Example**

#### **T+0:00 - Stream Request**
```
Admin Action: Start Office Security Stream
├── Device: "Office Security Camera 1"
├── Quality: HD (1080p)
├── Start 30-second Timer
└── Begin Stream Connection
```

#### **T+0:05 - Device Connection Attempt**
```
Device Connection Attempt:
├── WebRTC Connection: Attempting
├── Device Status: Offline
├── Camera Status: Unknown
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
├── Stream Status: ERROR
└── Stream Failed - Device offline
```

## Troubleshooting

### Common Issues

#### Stream Connection Failures
- **Check Device Status** - Verify device is online
- **Check Network** - Verify network connectivity
- **Check WebRTC** - Verify WebRTC support
- **Check Firewall** - Verify firewall settings
- **Check Logs** - Review connection logs

#### Stream Quality Issues
- **Check Network Bandwidth** - Verify sufficient bandwidth
- **Check Device Performance** - Verify device performance
- **Check Stream Settings** - Verify stream configuration
- **Check Network Latency** - Verify network latency
- **Check Logs** - Review quality logs

#### Stream Performance Issues
- **Check System Resources** - Verify system resources
- **Check Network Performance** - Verify network performance
- **Check Stream Load** - Verify stream load
- **Check Viewer Count** - Verify viewer count
- **Check Logs** - Review performance logs

#### Stream Security Issues
- **Check Access Control** - Verify access control
- **Check Authentication** - Verify authentication
- **Check Encryption** - Verify stream encryption
- **Check Privacy Settings** - Verify privacy settings
- **Check Logs** - Review security logs

### Error Messages

#### "Stream Connection Failed"
- **Cause**: Unable to connect to device
- **Solution**: Check device status and network connectivity

#### "Stream Quality Poor"
- **Cause**: Stream quality is unacceptable
- **Solution**: Check network bandwidth and device performance

#### "Stream Timeout"
- **Cause**: Stream connection took too long
- **Solution**: Check device status and network performance

#### "Device Offline"
- **Cause**: Source device is offline
- **Solution**: Check device status and connectivity

#### "Insufficient Resources"
- **Cause**: Insufficient system resources
- **Solution**: Check system resources and optimize configuration

## Best Practices

### Stream Design
- **Descriptive Names** - Use clear, descriptive stream names
- **Appropriate Quality** - Use appropriate quality for use case
- **Efficient Settings** - Use efficient stream settings
- **Clear Documentation** - Document stream purpose and usage
- **Regular Review** - Review streams regularly

### Stream Management
- **Lifecycle Management** - Manage stream lifecycle properly
- **Quality Monitoring** - Monitor stream quality closely
- **Performance Optimization** - Optimize stream performance
- **Resource Management** - Manage stream resources efficiently
- **Security Management** - Manage stream security

### Stream Security
- **Access Control** - Control stream access strictly
- **Authentication** - Authenticate stream viewers
- **Encryption** - Encrypt stream data
- **Privacy Protection** - Protect stream privacy
- **Security Monitoring** - Monitor stream security

### Stream Performance
- **Quality Optimization** - Optimize stream quality
- **Network Optimization** - Optimize network usage
- **Resource Optimization** - Optimize resource usage
- **Performance Monitoring** - Monitor stream performance
- **Performance Analytics** - Analyze stream performance

## Related Features

- **[Preview](./preview.md)** - Stream preview and testing
- **[Monitor](./monitor.md)** - System monitoring for stream performance
- **[SSE Debug](./sse_debug.md)** - Debug stream connection issues
- **[Messaging Debug](./messaging_debug.md)** - Debug stream messaging
- **[Redis Debug](./redis_debug.md)** - Debug stream data flow

## API Reference

### Stream Management API
- **GET /api/admin/vision/streams** - List all streams
- **POST /api/admin/vision/streams** - Create new stream
- **GET /api/admin/vision/streams/{id}** - Get stream details
- **PUT /api/admin/vision/streams/{id}** - Update stream
- **DELETE /api/admin/vision/streams/{id}** - Delete stream

### Stream Operations API
- **POST /api/admin/vision/streams/{id}/start** - Start stream
- **POST /api/admin/vision/streams/{id}/stop** - Stop stream
- **GET /api/admin/vision/streams/{id}/status** - Get stream status
- **GET /api/admin/vision/streams/{id}/quality** - Get stream quality

### Stream Monitoring API
- **GET /api/admin/vision/streams/{id}/metrics** - Get stream metrics
- **GET /api/admin/vision/streams/{id}/viewers** - Get stream viewers
- **GET /api/admin/vision/streams/{id}/logs** - Get stream logs
- **GET /api/admin/vision/streams/{id}/performance** - Get stream performance

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Stream Logs** - Review stream operation logs
- **Connection Logs** - Check connection-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of stream management from creation to monitoring and troubleshooting.
