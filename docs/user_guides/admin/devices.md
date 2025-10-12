# Device Management User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Device Management is the core feature for managing IoT devices in your system. This guide covers the complete device lifecycle from registration to monitoring, including device actions, status tracking, and troubleshooting.

## Prerequisites

- **Admin permissions** - Full device management access
- **Device registration** - Devices must be registered in the system
- **Factory tokens** - For device registration (see [Factory Tokens](./factory_tokens.md))

## Getting Started

### Quick Start
1. **Navigate to Devices** - Go to Admin → IOT → Devices
2. **View Device List** - See all registered devices
3. **Select a Device** - Click on a device to view details
4. **Perform Actions** - Use device actions as needed

### Navigation
- **Menu Path**: Admin → IOT → Devices
- **URL**: `/admin/iot/devices`
- **Direct Access**: Click "Devices" in the IOT section

## Core Functionality

### Device List View

#### Device Information Display
- **Device Name** - Human-readable device name
- **Device ID** - Unique system identifier
- **Status** - Online/Offline/Unknown
- **Last Seen** - Last connection timestamp
- **MAC Address** - Device network identifier
- **IP Address** - Current network location
- **Account** - Associated account/company
- **Tags** - Device tags for organization

#### Device Status Indicators
- 🟢 **Online** - Device is connected and responding
- 🔴 **Offline** - Device is disconnected
- 🟡 **Unknown** - Connection status unclear
- ⚪ **Pending** - Device registered but not claimed

#### Filtering and Search
- **Search by Name** - Find devices by name
- **Filter by Status** - Show only online/offline devices
- **Filter by Account** - Show devices by account
- **Filter by Tags** - Show devices with specific tags
- **Sort Options** - Sort by name, status, last seen, etc.

### Device Detail View

#### Device Information Tab
- **Basic Info** - Name, ID, description
- **Hardware Info** - Model, manufacturer, OS version
- **Network Info** - MAC addresses, IP address
- **Account Info** - Associated account and company
- **Timestamps** - Created, claimed, last seen dates

#### Device Status Tab
- **Connection Status** - Real-time connection status
- **Last Activity** - Recent device activity
- **Performance Metrics** - CPU, memory, storage usage
- **Network Status** - Network connectivity information

#### Device Actions Tab
- **Available Actions** - List of performable actions
- **Action History** - Previous action results
- **Action Logs** - Detailed action execution logs

## Advanced Features

### Device Actions

#### System Actions
- **Restart** - Restart the device
- **Reboot** - Full system reboot
- **Shutdown** - Graceful shutdown
- **Wake Up** - Wake sleeping device

#### File Operations
- **Push File** - Send file to device
- **Pull File** - Retrieve file from device
- **Delete File** - Remove file from device
- **List Files** - View device file system

#### App Management
- **Install App** - Install application on device
- **Uninstall App** - Remove application from device
- **Update App** - Update existing application
- **List Apps** - View installed applications

#### Firmware Operations
- **Update Firmware** - Install firmware update
- **Check Firmware** - Verify firmware version
- **Rollback Firmware** - Revert to previous version

#### Log Operations
- **Download Logs** - Retrieve device logs
- **Clear Logs** - Clear device log files
- **Stream Logs** - Real-time log streaming

#### WebRTC Operations
- **Start Terminal** - Open WebRTC terminal
- **Start Remote Desktop** - Open WebRTC remote desktop
- **Take Screenshot** - Capture device screen

#### Bundle Operations
- **Install Bundle** - Deploy bundle to device
- **Check Bundle Status** - Monitor bundle installation
- **Remove Bundle** - Uninstall bundle from device

### Device Monitoring

#### Real-Time Status
- **Connection Monitoring** - Live connection status
- **Performance Monitoring** - CPU, memory, storage
- **Network Monitoring** - Network connectivity and speed
- **Application Monitoring** - Running applications and services

#### Status Updates
- **Automatic Updates** - Real-time status via SSE
- **Manual Refresh** - Force status update
- **Status History** - Historical status data
- **Alert System** - Notifications for status changes

### Device Organization

#### Device Tagging
- **Add Tags** - Assign tags to devices
- **Remove Tags** - Remove tags from devices
- **Tag Management** - Create and manage tag categories
- **Tag Filtering** - Filter devices by tags

#### Device Grouping
- **Account Grouping** - Group by account/company
- **Location Grouping** - Group by physical location
- **Type Grouping** - Group by device type/model
- **Status Grouping** - Group by connection status

## Device Action Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Device Action Timeouts**
- **Restart**: 2 minutes timeout
- **Reboot**: 5 minutes timeout
- **Shutdown**: 1 minute timeout
- **File Operations**: 5 minutes timeout
- **App Operations**: 10 minutes timeout
- **WebRTC Operations**: 30 seconds timeout
- **Screenshot**: 10 seconds timeout

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Action Success**: Device returns `{"status": "success", "action": "restart"}`
- **Action Complete**: Device action completes successfully
- **Status Update**: Device status updates to reflect action

##### ❌ **Failure Cases**
- **Action Timeout**: No response from device within timeout period
- **Action Error**: Device returns `{"status": "error", "error": "Action failed"}`
- **Device Offline**: Device goes offline during action
- **Action Failed**: Action fails after retry attempts

### 📊 **Device Action Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Sends   │    │   Action Sent    │    │  Device Receives│
│     Action      │───▶│   to Device      │───▶│     Action      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Action Status  │◀───│  Monitor Action  │◀───│  Execute Action │
│   SUCCESS       │    │                  │    │  (with timeout) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Device Status  │◀───│  Update Status   │◀───│  Return Result  │
│    UPDATED      │    │                  │    │  to Server      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Action Process**

#### **Step 1: Action Initiation**
```
Admin Action: Send Action to Device
├── Action Status: PENDING
├── Device Status: ONLINE
├── Start Timeout Timer
└── Send Action to Device
```

#### **Step 2: Action Execution**
```
Device Receives Action:
├── Validate Action
├── Execute Action
├── Monitor Progress
└── Return Result
```

#### **Step 3: Action Completion**
```
Action Result:
├── Success → Action Status: SUCCESS
├── Error → Action Status: FAILED
└── Timeout → Action Status: TIMEOUT
```

## Common Workflows

### Workflow 1: Device Registration and Setup
1. **Register Device** - Use factory token to register device
2. **Claim Device** - Use PIN to claim device
3. **Assign Profile** - Apply device profile
4. **Add Tags** - Tag device for organization
5. **Verify Status** - Confirm device is online and responding

### Workflow 2: Device Maintenance
1. **Check Status** - Verify device is online
2. **Review Logs** - Check for errors or issues
3. **Update Firmware** - Install latest firmware if needed
4. **Restart Device** - Restart if necessary
5. **Verify Functionality** - Confirm device is working properly

### Workflow 3: Bundle Deployment
1. **Select Device** - Choose target device
2. **Check Compatibility** - Verify device can run bundle
3. **Deploy Bundle** - Install bundle on device
4. **Monitor Progress** - Watch installation progress
5. **Verify Installation** - Confirm bundle is working

### Workflow 4: Device Troubleshooting
1. **Check Status** - Verify device connection status
2. **Review Logs** - Look for error messages
3. **Test Connectivity** - Verify network connection
4. **Restart Device** - Try restarting device
5. **Contact Support** - Escalate if issues persist

## 📋 **Real-World Example: Device Restart Action**

### **Example Device: "Office Terminal 001"**
- **Device ID**: `device_office_001`
- **Action**: Restart device
- **Timeout**: 2 minutes

### **Timeline & Expected Behavior**

#### **T+0:00 - Restart Action Initiated**
```
Admin Action: Restart Device
├── Action Status: PENDING
├── Device Status: ONLINE
├── Start 2-minute Timer
└── Send Restart Command to Device
```

#### **T+0:01 - Device Receives Restart Command**
```
Device Response: {"status": "received", "action": "restart"}
├── Action Status: EXECUTING
├── Device Status: ONLINE
└── Device begins restart process
```

#### **T+0:30 - Device Restarting**
```
Device Response: {"status": "restarting", "action": "restart"}
├── Action Status: EXECUTING
├── Device Status: RESTARTING
└── Device is shutting down
```

#### **T+1:30 - Device Restart Complete**
```
Device Response: {"status": "success", "action": "restart"}
├── Action Status: SUCCESS
├── Device Status: ONLINE
└── Restart completed successfully
```

### **Total Restart Time: 1 minute 30 seconds**
- **Command Processing**: 1 second
- **Restart Process**: 1 minute 29 seconds
- **Within 2-minute timeout**

### **Failure Scenario Example**

#### **T+0:00 - Restart Action Initiated**
```
Admin Action: Restart Device
├── Action Status: PENDING
├── Device Status: ONLINE
├── Start 2-minute Timer
└── Send Restart Command to Device
```

#### **T+0:01 - Device Receives Restart Command**
```
Device Response: {"status": "received", "action": "restart"}
├── Action Status: EXECUTING
├── Device Status: ONLINE
└── Device begins restart process
```

#### **T+2:01 - Restart Action Timeout**
```
No response after 2 minutes
├── Action Status: TIMEOUT
├── Device Status: UNKNOWN
└── Restart action failed due to timeout
```

### **WebRTC Terminal Connection Example**

#### **T+0:00 - WebRTC Terminal Initiated**
```
Admin Action: Start WebRTC Terminal
├── Action Status: PENDING
├── Device Status: ONLINE
├── Start 30-second Timer
└── Send WebRTC Terminal Command
```

#### **T+0:05 - WebRTC Terminal Connected**
```
Device Response: {"status": "success", "action": "webrtc_terminal", "connectionId": "conn_123"}
├── Action Status: SUCCESS
├── Device Status: ONLINE
└── WebRTC terminal connection established
```

### **Screenshot Action Example**

#### **T+0:00 - Screenshot Action Initiated**
```
Admin Action: Take Screenshot
├── Action Status: PENDING
├── Device Status: ONLINE
├── Start 10-second Timer
└── Send Screenshot Command
```

#### **T+0:03 - Screenshot Captured**
```
Device Response: {"status": "success", "action": "screenshot", "imageId": "img_456"}
├── Action Status: SUCCESS
├── Device Status: ONLINE
└── Screenshot captured and uploaded
```

## Troubleshooting

### Common Issues

#### Device Offline
- **Check Network** - Verify device network connection
- **Check Power** - Ensure device is powered on
- **Check Firewall** - Verify firewall settings
- **Restart Device** - Try restarting the device
- **Check Logs** - Review device logs for errors

#### Device Not Responding
- **Check Status** - Verify device status in system
- **Test Connectivity** - Ping device IP address
- **Check Resources** - Verify device has sufficient resources
- **Restart Services** - Restart device services
- **Update Firmware** - Install latest firmware

#### Action Failures
- **Check Permissions** - Verify user has required permissions
- **Check Device Status** - Ensure device is online
- **Check Action Logs** - Review action execution logs
- **Retry Action** - Try the action again
- **Contact Support** - Escalate persistent issues

### Error Messages

#### "Device Not Found"
- **Cause**: Device ID doesn't exist in system
- **Solution**: Verify device ID and check device registration

#### "Device Offline"
- **Cause**: Device is not connected to system
- **Solution**: Check device network connection and power

#### "Action Timeout"
- **Cause**: Device didn't respond within timeout period
- **Solution**: Check device status and try again

#### "Permission Denied"
- **Cause**: User doesn't have required permissions
- **Solution**: Contact admin to grant required permissions

## Best Practices

### Device Management
- **Regular Monitoring** - Check device status regularly
- **Proactive Maintenance** - Update firmware and restart devices as needed
- **Proper Tagging** - Use consistent tagging system for organization
- **Documentation** - Keep device information up to date
- **Backup Configuration** - Backup device configurations

### Security
- **Secure Access** - Use strong authentication for device access
- **Regular Updates** - Keep device firmware and software updated
- **Network Security** - Use secure network connections
- **Access Control** - Limit device access to authorized users
- **Audit Logs** - Regularly review device access logs

### Performance
- **Resource Monitoring** - Monitor device resource usage
- **Load Balancing** - Distribute load across multiple devices
- **Capacity Planning** - Plan for device capacity needs
- **Optimization** - Optimize device configurations for performance
- **Scaling** - Plan for device scaling as needed

## Related Features

- **[Bundle Management](./bundles.md)** - Deploy applications to devices
- **[Device Profiles](./device_profiles.md)** - Configure device settings
- **[PIN Rules](./pin_rules.md)** - Manage device PIN access
- **[Device Tags](./device_tags.md)** - Organize devices with tags
- **[Factory Tokens](./factory_tokens.md)** - Register new devices
- **[Preclaims](./preclaims.md)** - Pre-configure device claims

## API Reference

### Device Management API
- **GET /api/admin/iot/devices** - List all devices
- **GET /api/admin/iot/devices/{id}** - Get device details
- **PUT /api/admin/iot/devices/{id}** - Update device information
- **DELETE /api/admin/iot/devices/{id}** - Remove device

### Device Actions API
- **POST /api/admin/iot/devices/{id}/actions/restart** - Restart device
- **POST /api/admin/iot/devices/{id}/actions/reboot** - Reboot device
- **POST /api/admin/iot/devices/{id}/actions/shutdown** - Shutdown device
- **POST /api/admin/iot/devices/{id}/actions/pushFile** - Push file to device
- **POST /api/admin/iot/devices/{id}/actions/installApp** - Install app on device

### Device Status API
- **GET /api/admin/iot/devices/{id}/status** - Get device status
- **GET /api/admin/iot/devices/{id}/logs** - Get device logs
- **GET /api/admin/iot/devices/{id}/metrics** - Get device metrics

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **System Logs** - Review system logs for errors
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of device management from basic operations to advanced troubleshooting.
