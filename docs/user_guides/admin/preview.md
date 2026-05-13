# Preview User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Preview provides real-time preview and testing capabilities for IoT devices. It allows administrators to preview device screens, test device functionality, and verify device status before deploying configurations or performing operations.

## Prerequisites

- **Admin permissions** - Full preview access
- **Device knowledge** - Understanding of device types and capabilities
- **WebRTC understanding** - Knowledge of WebRTC technology
- **Network awareness** - Understanding of network requirements for preview

## Getting Started

### Quick Start
1. **Navigate to Preview** - Go to Admin → Vision → Preview
2. **Select Device** - Choose device to preview
3. **Start Preview** - Start device preview
4. **View Device Screen** - View real-time device screen
5. **Test Functionality** - Test device functionality
6. **Stop Preview** - Stop preview when done

### Navigation
- **Menu Path**: Admin → Vision → Preview
- **URL**: `/admin/vision/preview`
- **Direct Access**: Click "Preview" in the Vision section

## Core Functionality

### Preview Dashboard

#### Device Selection
- **Device List** - List of available devices
- **Device Status** - Device online/offline status
- **Device Type** - Device type and capabilities
- **Last Seen** - Last time device was active
- **Connection Status** - Current connection status

#### Preview Controls
- **Start Preview** - Start device preview
- **Stop Preview** - Stop device preview
- **Refresh Preview** - Refresh preview connection
- **Quality Settings** - Adjust preview quality
- **Full Screen** - Toggle full screen mode

#### Preview Information
- **Preview Status** - Current preview status
- **Connection Quality** - Connection quality indicator
- **Frame Rate** - Current frame rate
- **Resolution** - Current resolution
- **Latency** - Connection latency

### Preview View

#### Device Screen
- **Live Screen** - Real-time device screen
- **Screen Controls** - Screen interaction controls
- **Zoom Controls** - Zoom in/out controls
- **Pan Controls** - Pan screen view
- **Screen Capture** - Capture screen image

#### Device Information
- **Device Details** - Device information and status
- **System Information** - Device system information
- **Network Information** - Device network information
- **Performance Metrics** - Device performance metrics
- **Error Logs** - Device error logs

#### Preview Controls
- **Quality Adjustment** - Adjust preview quality
- **Connection Settings** - Configure connection settings
- **Display Settings** - Configure display settings
- **Audio Settings** - Configure audio settings
- **Recording Settings** - Configure recording settings

## Advanced Features

### Preview Configuration

#### Quality Settings
- **Resolution** - Set preview resolution
- **Frame Rate** - Set frame rate
- **Bitrate** - Set bitrate
- **Quality Mode** - Set quality mode
- **Adaptive Quality** - Enable adaptive quality

#### Connection Settings
- **Connection Type** - Set connection type
- **Network Settings** - Configure network settings
- **Timeout Settings** - Set timeout settings
- **Retry Settings** - Configure retry settings
- **Security Settings** - Configure security settings

#### Display Settings
- **Display Mode** - Set display mode
- **Aspect Ratio** - Set aspect ratio
- **Color Settings** - Configure color settings
- **Brightness** - Adjust brightness
- **Contrast** - Adjust contrast

### Preview Management

#### Preview Lifecycle
- **Preview Creation** - Create new preview
- **Preview Activation** - Activate preview
- **Preview Monitoring** - Monitor preview performance
- **Preview Optimization** - Optimize preview performance
- **Preview Cleanup** - Clean up preview resources

#### Preview Quality
- **Quality Monitoring** - Monitor preview quality
- **Quality Adaptation** - Adapt quality to network conditions
- **Quality Optimization** - Optimize preview quality
- **Quality Metrics** - Track quality metrics
- **Quality Alerts** - Set quality alerts

#### Preview Security
- **Access Control** - Control preview access
- **Authentication** - Authenticate preview users
- **Encryption** - Encrypt preview data
- **Privacy Protection** - Protect preview privacy
- **Security Monitoring** - Monitor preview security

## Preview Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Preview Connection Timeout: 15 Seconds**
- **Per Preview**: Each preview connection has a **15-second timeout**
- **Timeout Behavior**: If connection takes too long → **FAILED**
- **Retry Logic**: Failed connections are retried up to 2 times
- **Total Connection Timeout**: 45 seconds for complete preview connection

#### **Preview Quality Check Timeout: 5 Seconds**
- **Per Check**: Each quality check has a **5-second timeout**
- **Timeout Behavior**: If check takes too long → **SKIPPED**
- **Retry Logic**: Failed checks are retried up to 2 times
- **Total Quality Check Timeout**: 15 seconds for complete quality check

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Preview Connected**: Preview successfully connected to device
- **Quality Good**: Preview quality is acceptable
- **Screen Visible**: Device screen is visible
- **Preview Stable**: Preview is stable and performing well

##### ❌ **Failure Cases**
- **Connection Timeout**: Preview connection took too long
- **Device Offline**: Source device is offline
- **Network Issues**: Network connectivity problems
- **Quality Poor**: Preview quality is unacceptable
- **Resource Exhausted**: Insufficient system resources

### 📊 **Preview Connection Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Preview       │    │   Device         │    │  Preview        │
│   Request       │───▶│   Connection     │───▶│   Connected     │
│                 │    │  (15sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Preview Quality│◀───│  Quality Check   │◀───│  Preview Data   │
│   Verified      │    │  (5sec timeout)  │    │   Flowing       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Device Screen  │◀───│  Screen          │◀───│  Preview        │
│   Visible       │    │   Rendering      │    │   Active        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Preview Connection Process**

#### **Step 1: Preview Connection**
```
Preview Request:
├── Start 15-second Timer
├── Connect to Device
├── Establish WebRTC Connection
├── Negotiate Preview Parameters
└── Verify Connection
```

#### **Step 2: Quality Check**
```
Connection Established:
├── Start 5-second Timer
├── Check Preview Quality
├── Verify Screen Rendering
├── Test Network Performance
└── Validate Preview Parameters
```

#### **Step 3: Screen Rendering**
```
Quality Verified:
├── Start Screen Rendering
├── Enable Screen Interaction
├── Monitor Preview Performance
└── Update Preview Status
```

## Common Workflows

### Workflow 1: Start Device Preview
1. **Select Device** - Choose device to preview
2. **Check Device Status** - Verify device is online
3. **Start Preview** - Start preview connection
4. **Wait for Connection** - Wait for connection to establish
5. **Verify Quality** - Verify preview quality
6. **Interact with Device** - Interact with device screen
7. **Stop Preview** - Stop preview when done

### Workflow 2: Preview Quality Management
1. **Select Preview** - Choose preview to manage
2. **View Quality Metrics** - Review current quality metrics
3. **Adjust Quality** - Adjust preview quality settings
4. **Monitor Performance** - Monitor performance impact
5. **Optimize Settings** - Optimize preview settings
6. **Test Changes** - Test quality changes
7. **Apply Configuration** - Apply optimized configuration

### Workflow 3: Preview Testing and Validation
1. **Select Device** - Choose device to test
2. **Start Preview** - Start device preview
3. **Test Functionality** - Test device functionality
4. **Verify Configuration** - Verify device configuration
5. **Check Performance** - Check device performance
6. **Document Results** - Document test results
7. **Stop Preview** - Stop preview when done

### Workflow 4: Preview Troubleshooting
1. **Identify Issue** - Determine preview problem
2. **Check Preview Status** - Verify preview status
3. **Check Device Status** - Verify device status
4. **Check Network** - Verify network connectivity
5. **Check Quality** - Verify preview quality
6. **Check Logs** - Review preview logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Configuration Preview**

### **Example Preview: "Office Terminal Configuration"**
- **Device**: "Office Terminal 1"
- **Preview Type**: Screen preview
- **Quality**: HD (1080p)
- **Purpose**: Verify device configuration

### **Timeline & Expected Behavior**

#### **T+0:00 - Preview Request**
```
Admin Action: Start Device Preview
├── Device: "Office Terminal 1"
├── Quality: HD (1080p)
├── Start 15-second Timer
└── Begin Preview Connection
```

#### **T+0:03 - Device Connection**
```
Device Connection:
├── WebRTC Connection: Established
├── Device Status: Online
├── Screen Status: Active
└── Connection Status: CONNECTED
```

#### **T+0:05 - Preview Quality Check**
```
Preview Quality Check:
├── Start 5-second Timer
├── Screen Quality: HD (1080p)
├── Frame Rate: 30 fps
├── Latency: 50ms
└── Quality Status: GOOD
```

#### **T+0:08 - Screen Rendering**
```
Screen Rendering:
├── Preview Status: ACTIVE
├── Screen Visible: Yes
├── Quality: HD (1080p)
└── Preview Ready for Interaction
```

#### **T+0:10 - Device Interaction**
```
Device Interaction:
├── Screen Interaction: Enabled
├── Configuration Visible: Yes
├── Settings Accessible: Yes
└── Preview Fully Functional
```

### **Total Connection Time: 10 seconds**
- **Device Connection**: 3 seconds
- **Quality Check**: 2 seconds
- **Screen Rendering**: 3 seconds
- **Device Interaction**: 2 seconds
- **Within 15-second connection timeout**

### **Failure Scenario Example**

#### **T+0:00 - Preview Request**
```
Admin Action: Start Device Preview
├── Device: "Office Terminal 1"
├── Quality: HD (1080p)
├── Start 15-second Timer
└── Begin Preview Connection
```

#### **T+0:03 - Device Connection Attempt**
```
Device Connection Attempt:
├── WebRTC Connection: Attempting
├── Device Status: Offline
├── Screen Status: Unknown
└── Connection Status: FAILING
```

#### **T+0:16 - Connection Timeout**
```
Connection Timeout:
├── No response after 15 seconds
├── Connection Status: TIMEOUT
├── Retry Attempt 1: Restart connection
└── Start new 15-second Timer
```

#### **T+0:31 - Retry Timeout**
```
Retry Timeout:
├── No response after 15 seconds (retry 1)
├── Connection Status: TIMEOUT
├── Retry Attempt 2: Restart connection
└── Start new 15-second Timer
```

#### **T+0:46 - Final Timeout**
```
Final Timeout:
├── No response after 15 seconds (retry 2)
├── Connection Status: FAILED
├── Preview Status: ERROR
└── Preview Failed - Device offline
```

## Troubleshooting

### Common Issues

#### Preview Connection Failures
- **Check Device Status** - Verify device is online
- **Check Network** - Verify network connectivity
- **Check WebRTC** - Verify WebRTC support
- **Check Firewall** - Verify firewall settings
- **Check Logs** - Review connection logs

#### Preview Quality Issues
- **Check Network Bandwidth** - Verify sufficient bandwidth
- **Check Device Performance** - Verify device performance
- **Check Preview Settings** - Verify preview configuration
- **Check Network Latency** - Verify network latency
- **Check Logs** - Review quality logs

#### Preview Performance Issues
- **Check System Resources** - Verify system resources
- **Check Network Performance** - Verify network performance
- **Check Preview Load** - Verify preview load
- **Check Device Performance** - Verify device performance
- **Check Logs** - Review performance logs

#### Preview Security Issues
- **Check Access Control** - Verify access control
- **Check Authentication** - Verify authentication
- **Check Encryption** - Verify preview encryption
- **Check Privacy Settings** - Verify privacy settings
- **Check Logs** - Review security logs

### Error Messages

#### "Preview Connection Failed"
- **Cause**: Unable to connect to device
- **Solution**: Check device status and network connectivity

#### "Preview Quality Poor"
- **Cause**: Preview quality is unacceptable
- **Solution**: Check network bandwidth and device performance

#### "Preview Timeout"
- **Cause**: Preview connection took too long
- **Solution**: Check device status and network performance

#### "Device Offline"
- **Cause**: Source device is offline
- **Solution**: Check device status and connectivity

#### "Insufficient Resources"
- **Cause**: Insufficient system resources
- **Solution**: Check system resources and optimize configuration

## Best Practices

### Preview Design
- **Descriptive Names** - Use clear, descriptive preview names
- **Appropriate Quality** - Use appropriate quality for use case
- **Efficient Settings** - Use efficient preview settings
- **Clear Documentation** - Document preview purpose and usage
- **Regular Review** - Review previews regularly

### Preview Management
- **Lifecycle Management** - Manage preview lifecycle properly
- **Quality Monitoring** - Monitor preview quality closely
- **Performance Optimization** - Optimize preview performance
- **Resource Management** - Manage preview resources efficiently
- **Security Management** - Manage preview security

### Preview Security
- **Access Control** - Control preview access strictly
- **Authentication** - Authenticate preview users
- **Encryption** - Encrypt preview data
- **Privacy Protection** - Protect preview privacy
- **Security Monitoring** - Monitor preview security

### Preview Performance
- **Quality Optimization** - Optimize preview quality
- **Network Optimization** - Optimize network usage
- **Resource Optimization** - Optimize resource usage
- **Performance Monitoring** - Monitor preview performance
- **Performance Analytics** - Analyze preview performance

## Related Features

- **[Streams](./streams.md)** - Stream management for live video
- **[Monitor](./monitor.md)** - System monitoring for preview performance
- **[SSE Debug](./sse_debug.md)** - Debug preview connection issues
- **[Messaging Debug](./messaging_debug.md)** - Debug preview messaging
- **[Redis Debug](./redis_debug.md)** - Debug preview data flow

## API Reference

### Preview Management API
- **GET /api/admin/vision/preview** - Get preview status
- **POST /api/admin/vision/preview/start** - Start device preview
- **POST /api/admin/vision/preview/stop** - Stop device preview
- **GET /api/admin/vision/preview/status** - Get preview status

### Preview Operations API
- **GET /api/admin/vision/preview/quality** - Get preview quality
- **PUT /api/admin/vision/preview/quality** - Update preview quality
- **GET /api/admin/vision/preview/metrics** - Get preview metrics
- **GET /api/admin/vision/preview/logs** - Get preview logs

### Preview Configuration API
- **GET /api/admin/vision/preview/config** - Get preview configuration
- **PUT /api/admin/vision/preview/config** - Update preview configuration
- **GET /api/admin/vision/preview/devices** - Get available devices
- **POST /api/admin/vision/preview/test** - Test preview connection

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Preview Logs** - Review preview operation logs
- **Connection Logs** - Check connection-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of preview management from connection to quality monitoring and troubleshooting.
