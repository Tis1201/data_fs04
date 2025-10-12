# User Devices Guide

**Last Updated**: 2025-10-12  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **User Devices** feature allows you to manage, monitor, and control your IoT devices through an intuitive interface. You can view device status, perform actions, monitor performance, and troubleshoot issues for all devices in your account.

## Prerequisites

- **User account** - Valid user account with device access permissions
- **Device access** - Access to at least one IoT device
- **Basic navigation** - Understanding of the user interface

## Getting Started

### Quick Start
1. **Access Devices** - Navigate to User → IoT → Devices
2. **View Device List** - See all your devices and their status
3. **Select Device** - Click on a device to view details
4. **Perform Actions** - Use action buttons to control devices
5. **Monitor Status** - Watch real-time device status updates

### Navigation
- **Menu Path**: User → IoT → Devices
- **URL**: `/user/iot/devices`
- **Direct Access**: Click "Devices" in the IoT section

## Core Functionality

### Device List View

#### Device Information Display
- **Device Name** - Custom or system-assigned device name
- **Device ID** - Unique device identifier
- **Status** - Current device status (Online/Offline/Error)
- **Last Seen** - Last time device was active
- **Location** - Device location or description
- **Device Type** - Type of IoT device
- **Model** - Device model information
- **IP Address** - Current IP address (if online)

#### Device Status Indicators
- 🟢 **Online** - Device is connected and operational
- 🔴 **Offline** - Device is disconnected
- 🟡 **Warning** - Device has minor issues
- 🔴 **Error** - Device has critical issues
- 🔵 **Maintenance** - Device is in maintenance mode
- ⚪ **Unknown** - Device status is unknown

#### Device List Controls
- **Search Devices** - Find devices by name, ID, or location
- **Filter by Status** - Show only online, offline, or error devices
- **Filter by Type** - Show specific device types
- **Sort Options** - Sort by name, status, last seen, etc.
- **Bulk Actions** - Perform actions on multiple devices
- **Export List** - Download device information

### Device Detail View

#### Device Overview
- **Device Information** - Complete device details
- **Status History** - Recent status changes
- **Performance Metrics** - CPU, memory, storage usage
- **Network Information** - Connection details and IP
- **Hardware Details** - Device specifications
- **Software Information** - Installed software and versions

#### Real-Time Monitoring
- **Live Status** - Real-time device status updates
- **Performance Graphs** - CPU, memory, storage charts
- **Network Activity** - Network usage and connectivity
- **System Logs** - Recent device logs and events
- **Alert History** - Past alerts and notifications
- **Activity Timeline** - Recent device activities

#### Device Actions
- **Restart Device** - Restart the device (2-minute timeout)
- **Reboot Device** - Full device reboot (5-minute timeout)
- **Shutdown Device** - Graceful device shutdown (1-minute timeout)
- **Take Screenshot** - Capture device screen (10-second timeout)
- **Start WebRTC** - Begin remote desktop session (30-second timeout)
- **View Logs** - Access device logs and diagnostics

### Device Management Features

#### Device Organization
- **Device Tags** - Organize devices with custom tags
- **Device Groups** - Group devices by location or function
- **Device Profiles** - Apply configuration profiles
- **Device Templates** - Use device configuration templates
- **Bulk Operations** - Manage multiple devices simultaneously
- **Device Search** - Find devices quickly

#### Device Configuration
- **Network Settings** - Configure network parameters
- **Security Settings** - Set security configurations
- **Application Settings** - Configure installed applications
- **System Settings** - Modify system parameters
- **User Settings** - Set user-specific configurations
- **Backup Settings** - Backup device configurations

## Advanced Features

### Device Actions & Control

#### System Actions
- **Restart** - Restart device services (2-minute timeout)
- **Reboot** - Full system reboot (5-minute timeout)
- **Shutdown** - Graceful system shutdown (1-minute timeout)
- **Wake Up** - Wake up sleeping device (30-second timeout)
- **Reset** - Factory reset device (10-minute timeout)
- **Update Firmware** - Update device firmware (15-minute timeout)

#### File Operations
- **Upload Files** - Upload files to device (5-minute timeout)
- **Download Files** - Download files from device (5-minute timeout)
- **Delete Files** - Remove files from device (2-minute timeout)
- **Sync Files** - Synchronize files with server (10-minute timeout)
- **Backup Files** - Backup device files (15-minute timeout)
- **Restore Files** - Restore files from backup (20-minute timeout)

#### Application Management
- **Install App** - Install applications (10-minute timeout)
- **Uninstall App** - Remove applications (5-minute timeout)
- **Update App** - Update installed applications (10-minute timeout)
- **Start App** - Launch applications (30-second timeout)
- **Stop App** - Stop running applications (30-second timeout)
- **App Status** - Check application status (10-second timeout)

#### Remote Access
- **WebRTC Terminal** - Remote terminal access (30-second timeout)
- **Remote Desktop** - Full desktop access (2-minute timeout)
- **File Manager** - Remote file management (1-minute timeout)
- **System Monitor** - Real-time system monitoring (10-second timeout)
- **Log Viewer** - View system logs (5-second timeout)
- **Screenshot** - Capture device screen (10-second timeout)

### Device Monitoring & Analytics

#### Performance Monitoring
- **CPU Usage** - Real-time CPU utilization
- **Memory Usage** - RAM usage and availability
- **Storage Usage** - Disk space utilization
- **Network Usage** - Network traffic and bandwidth
- **Temperature** - Device temperature monitoring
- **Power Usage** - Power consumption tracking

#### Health Monitoring
- **System Health** - Overall device health score
- **Service Status** - Status of running services
- **Error Rate** - Frequency of errors and issues
- **Uptime** - Device availability and uptime
- **Response Time** - Device response times
- **Alert Status** - Current alerts and warnings

#### Historical Data
- **Performance Trends** - Historical performance data
- **Usage Patterns** - Device usage over time
- **Error History** - Past errors and resolutions
- **Maintenance History** - Past maintenance activities
- **Configuration Changes** - History of configuration changes
- **User Activity** - User interaction history

## Common Workflows

### Workflow 1: Device Status Check
1. **Open Device List** - Navigate to devices page
2. **Review Status** - Check device status indicators
3. **Identify Issues** - Look for offline or error devices
4. **Check Details** - Click on problematic devices
5. **Review Logs** - Check device logs for issues
6. **Take Action** - Restart or troubleshoot devices

### Workflow 2: Device Maintenance
1. **Select Devices** - Choose devices for maintenance
2. **Check Status** - Verify device current status
3. **Backup Settings** - Backup device configurations
4. **Perform Maintenance** - Execute maintenance tasks
5. **Monitor Progress** - Watch maintenance progress
6. **Verify Results** - Confirm maintenance success

### Workflow 3: Remote Device Access
1. **Select Device** - Choose device for remote access
2. **Check Connection** - Verify device is online
3. **Start WebRTC** - Initiate remote desktop session
4. **Perform Tasks** - Complete remote tasks
5. **Monitor Session** - Watch session activity
6. **End Session** - Close remote access session

### Workflow 4: Bulk Device Operations
1. **Select Multiple Devices** - Choose devices for bulk operations
2. **Choose Action** - Select desired bulk action
3. **Configure Settings** - Set action parameters
4. **Execute Action** - Start bulk operation
5. **Monitor Progress** - Watch operation progress
6. **Review Results** - Check operation results

## Device Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Device Restart: 2 Minutes**
- **Action**: Restart device services
- **Timeout**: **2 minutes** for completion
- **Retry Logic**: 1 retry attempt if failed
- **Success Criteria**: Device responds to ping within 2 minutes

#### **Device Reboot: 5 Minutes**
- **Action**: Full system reboot
- **Timeout**: **5 minutes** for completion
- **Retry Logic**: 1 retry attempt if failed
- **Success Criteria**: Device comes back online within 5 minutes

#### **Device Shutdown: 1 Minute**
- **Action**: Graceful system shutdown
- **Timeout**: **1 minute** for completion
- **Retry Logic**: 1 retry attempt if failed
- **Success Criteria**: Device shuts down gracefully within 1 minute

#### **File Operations: 5 Minutes**
- **Action**: Upload/download files
- **Timeout**: **5 minutes** per file
- **Retry Logic**: 2 retry attempts if failed
- **Success Criteria**: File transfer completes within 5 minutes

#### **App Operations: 10 Minutes**
- **Action**: Install/uninstall applications
- **Timeout**: **10 minutes** per application
- **Retry Logic**: 2 retry attempts if failed
- **Success Criteria**: Application operation completes within 10 minutes

#### **WebRTC Operations: 30 Seconds**
- **Action**: Start WebRTC session
- **Timeout**: **30 seconds** for connection
- **Retry Logic**: 2 retry attempts if failed
- **Success Criteria**: WebRTC connection established within 30 seconds

#### **Screenshot: 10 Seconds**
- **Action**: Capture device screen
- **Timeout**: **10 seconds** for capture
- **Retry Logic**: 2 retry attempts if failed
- **Success Criteria**: Screenshot captured within 10 seconds

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Action Completed**: Device action completed successfully
- **Device Responding**: Device responds to commands
- **Status Updated**: Device status updated correctly
- **No Errors**: No error messages in logs

##### ❌ **Failure Cases**
- **Action Timeout**: Action took longer than timeout
- **Device Unresponsive**: Device doesn't respond to commands
- **Connection Lost**: Lost connection to device
- **Error Messages**: Error messages in device logs

### 📊 **Device Action Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User          │    │   Action         │    │  Device         │
│   Initiates     │───▶│   Request        │───▶│   Receives      │
│   Action        │    │                  │    │   Command       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Action         │◀───│  Device          │◀───│  Device         │
│   Complete      │    │   Executes       │    │   Processing    │
│                 │    │   Action         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Status         │◀───│  Device          │◀───│  Device         │
│   Updated       │    │   Reports        │    │   Responds      │
│                 │    │   Status         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Device Action Process**

#### **Step 1: Action Initiation**
```
Action Request:
├── User selects action
├── System validates request
├── Check device status
├── Send command to device
└── Start timeout timer
```

#### **Step 2: Device Processing**
```
Device Processing:
├── Device receives command
├── Device validates command
├── Device executes action
├── Device reports progress
└── Device completes action
```

#### **Step 3: Status Update**
```
Status Update:
├── Device reports completion
├── System updates device status
├── Update user interface
├── Log action result
└── Send notifications
```

## 📋 **Real-World Example: Device Restart Action**

### **Example Device Action: "Office Device Restart"**
- **Device**: Office-001 (Windows IoT device)
- **Action**: Restart device services
- **Purpose**: Resolve performance issues

### **Timeline & Expected Behavior**

#### **T+0:00 - Action Initiation**
```
User Action:
├── User clicks "Restart" button
├── System validates device status: ONLINE
├── Command sent to device: "restart"
├── Start 2-minute timer
└── Action status: IN_PROGRESS
```

#### **T+0:05 - Device Processing**
```
Device Processing:
├── Device receives restart command
├── Device validates command: VALID
├── Device begins service restart
├── Progress: 25% complete
└── Status: RESTARTING
```

#### **T+0:30 - Service Restart**
```
Service Restart:
├── Device stops services
├── Device restarts services
├── Progress: 75% complete
└── Status: RESTARTING
```

#### **T+0:45 - Action Complete**
```
Action Complete:
├── Device services restarted
├── Device reports: SUCCESS
├── Progress: 100% complete
└── Status: ONLINE
```

#### **T+0:50 - Status Update**
```
Status Update:
├── System updates device status: ONLINE
├── UI shows success message
├── Action log updated
└── User notification: "Device restarted successfully"
```

### **Total Action Time: 50 seconds**
- **Command Processing**: 5 seconds
- **Service Restart**: 40 seconds
- **Status Update**: 5 seconds
- **Within 2-minute timeout**

### **WebRTC Connection Example**

#### **T+0:00 - WebRTC Request**
```
WebRTC Request:
├── User clicks "WebRTC" button
├── System checks device: ONLINE
├── WebRTC session initiated
├── Start 30-second timer
└── Status: CONNECTING
```

#### **T+0:10 - Connection Setup**
```
Connection Setup:
├── WebRTC handshake started
├── Device prepares remote session
├── Progress: 50% complete
└── Status: CONNECTING
```

#### **T+0:20 - Session Established**
```
Session Established:
├── WebRTC connection active
├── Remote desktop ready
├── Progress: 100% complete
└── Status: CONNECTED
```

#### **T+0:25 - User Access**
```
User Access:
├── User can control device remotely
├── Real-time screen sharing active
├── Session monitoring active
└── Status: ACTIVE
```

### **Total Connection Time: 25 seconds**
- **Connection Setup**: 20 seconds
- **Session Ready**: 5 seconds
- **Within 30-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - Restart Request**
```
Restart Request:
├── User clicks "Restart" button
├── System checks device: ONLINE
├── Command sent to device
├── Start 2-minute timer
└── Status: IN_PROGRESS
```

#### **T+0:30 - Device Processing**
```
Device Processing:
├── Device receives command
├── Device begins restart
├── Progress: 25% complete
└── Status: RESTARTING
```

#### **T+1:00 - Connection Lost**
```
Connection Lost:
├── Device stops responding
├── Network connection lost
├── Progress: 50% complete
└── Status: UNKNOWN
```

#### **T+2:00 - Timeout**
```
Timeout:
├── 2-minute timer elapsed
├── No response from device
├── Action status: FAILED
└── Error: "Device restart timeout"
```

#### **T+2:05 - Retry Attempt**
```
Retry Attempt:
├── System attempts retry
├── Check device connectivity
├── Device still unresponsive
└── Retry status: FAILED
```

#### **T+2:10 - Final Status**
```
Final Status:
├── Action marked as failed
├── Device status: OFFLINE
├── User notification: "Device restart failed - device offline"
└── Log entry: "Restart timeout after 2 minutes"
```

## Troubleshooting

### Common Issues

#### Device Connection Problems
- **Check Network** - Verify device network connectivity
- **Check Device Status** - Verify device is powered on
- **Check Firewall** - Verify firewall settings
- **Check Credentials** - Verify device authentication
- **Check Logs** - Review device connection logs

#### Action Execution Failures
- **Check Device Status** - Verify device is online
- **Check Permissions** - Verify user has action permissions
- **Check Device Resources** - Verify device has sufficient resources
- **Check Action Queue** - Verify no conflicting actions
- **Check Logs** - Review action execution logs

#### Performance Issues
- **Check Device Resources** - Monitor CPU, memory, storage
- **Check Network Performance** - Monitor network latency
- **Check Action Load** - Monitor concurrent actions
- **Check System Load** - Monitor overall system performance
- **Check Logs** - Review performance logs

#### WebRTC Connection Issues
- **Check Network** - Verify network connectivity
- **Check Firewall** - Verify WebRTC ports are open
- **Check Device Status** - Verify device is online
- **Check Browser** - Verify browser WebRTC support
- **Check Logs** - Review WebRTC connection logs

### Error Messages

#### "Device Offline"
- **Cause**: Device is not connected to the network
- **Solution**: Check device power and network connection

#### "Action Timeout"
- **Cause**: Device action took too long to complete
- **Solution**: Check device status and try again

#### "Permission Denied"
- **Cause**: User doesn't have permission for the action
- **Solution**: Contact administrator for access

#### "Device Busy"
- **Cause**: Device is already performing another action
- **Solution**: Wait for current action to complete

#### "WebRTC Connection Failed"
- **Cause**: Unable to establish WebRTC connection
- **Solution**: Check network and firewall settings

## Best Practices

### Device Management
- **Regular Monitoring** - Check device status regularly
- **Proactive Maintenance** - Perform maintenance before issues occur
- **Backup Configurations** - Backup device settings regularly
- **Monitor Performance** - Watch device performance metrics
- **Document Changes** - Record all device modifications

### Action Execution
- **Check Status First** - Verify device status before actions
- **One Action at a Time** - Avoid concurrent actions on same device
- **Monitor Progress** - Watch action progress and results
- **Handle Failures** - Address action failures promptly
- **Log Activities** - Keep records of all device actions

### Remote Access
- **Secure Connections** - Use secure WebRTC connections
- **Monitor Sessions** - Watch remote access sessions
- **End Sessions Properly** - Close sessions when done
- **Check Permissions** - Verify remote access permissions
- **Document Access** - Log remote access activities

### Performance Optimization
- **Monitor Resources** - Watch device resource usage
- **Optimize Actions** - Use most efficient action methods
- **Batch Operations** - Group similar actions together
- **Schedule Maintenance** - Plan maintenance during low usage
- **Update Regularly** - Keep device software updated

## Related Features

- **[Device Tags](./device_tags.md)** - Organizing devices with tags
- **[Device Profiles](./device_profiles.md)** - Device configuration management
- **[Bundles](./bundles.md)** - Application installation and management
- **[Logs](./logs.md)** - Device logs and diagnostics
- **[Dashboard](./dashboard.md)** - Device overview and monitoring

## API Reference

### Device Management API
- **GET /api/user/iot/devices** - Get device list
- **GET /api/user/iot/devices/{id}** - Get device details
- **POST /api/user/iot/devices/{id}/actions** - Execute device action
- **GET /api/user/iot/devices/{id}/status** - Get device status

### Device Actions API
- **POST /api/user/iot/devices/{id}/restart** - Restart device
- **POST /api/user/iot/devices/{id}/reboot** - Reboot device
- **POST /api/user/iot/devices/{id}/shutdown** - Shutdown device
- **POST /api/user/iot/devices/{id}/screenshot** - Take screenshot
- **POST /api/user/iot/devices/{id}/webrtc** - Start WebRTC session

### Device Monitoring API
- **GET /api/user/iot/devices/{id}/metrics** - Get device metrics
- **GET /api/user/iot/devices/{id}/logs** - Get device logs
- **GET /api/user/iot/devices/{id}/history** - Get device history
- **WebSocket /api/user/iot/devices/{id}/ws** - Real-time updates

## Support

### Getting Help
- **In-App Help** - Use the help system within the devices page
- **Documentation** - Check the comprehensive user guides
- **Support Portal** - Access the support system
- **Community** - Join the user community for help

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of user device management from basic operations to advanced monitoring and troubleshooting.
