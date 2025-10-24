# Device Management User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Device Management is the core feature for managing IoT devices in your system. This guide covers the complete device lifecycle from registration to monitoring, including device status tracking, real-time updates, and device organization.

## Prerequisites

- **Admin permissions** - Full device management access
- **Device registration** - Devices must be registered in the system
- **Factory tokens** - For device registration (see [Factory Tokens](./factory_tokens.md))

## Getting Started

### Quick Start
1. **Navigate to Devices** - Go to Admin → IOT → Devices
2. **View Device List** - See all registered devices with real-time status
3. **Select a Device** - Click on a device to view details
4. **Manage Device** - Edit, activate/deactivate, or delete devices

### Navigation
- **Menu Path**: Admin → IOT → Devices
- **URL**: `/admin/iot/devices`
- **Direct Access**: Click "Devices" in the IOT section

## Core Functionality

### Device List View

#### Device Information Display
- **Device Name** - Human-readable device name with clickable link
- **Device ID** - Unique system identifier (displayed with name)
- **MAC Address** - Primary MAC address (wifi/lan MAC as fallback)
- **OS Version** - Operating system version
- **Online Status** - Real-time connection status with visual indicator
- **Usage** - Device usage information (currently N/A)
- **Tags** - Device tags with clickable links to tag details

#### Device Status Indicators
- 🟢 **Online** - Device is connected and responding (real-time updates)
- 🔴 **Offline** - Device is disconnected
- **Real-time Updates** - Status changes automatically via SSE

#### Filtering and Search
- **Search by Name or ID** - Find devices by name or device ID
- **Filter by Status** - Show only Active/Inactive devices
- **Filter by Tags** - Show devices with specific tags (searchable)
- **Sort Options** - Sort by name, MAC address, OS version, created date
- **Pagination** - Navigate through multiple pages of devices

### Device Detail View

#### Device Information Section
- **Basic Info** - Name, ID, device type, status
- **Hardware Info** - Manufacturer, OS version, hardware ID
- **Network Info** - MAC addresses (primary, wifi, lan)
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Toggle between Active/Inactive

#### Device Actions
- **Edit Device** - Modify device details
- **Activate/Deactivate** - Toggle device status
- **Delete Device** - Remove device (with confirmation)
- **View Details** - Access full device information

#### Real-time Features
- **Live Status Updates** - Connection status updates via SSE
- **Automatic Refresh** - Device list updates in real-time
- **Connection Monitoring** - Live connection status tracking

## Advanced Features

### Device Management

#### Basic Device Operations
- **Edit Device** - Modify device name, type, and settings
- **Status Toggle** - Activate or deactivate devices
- **Delete Device** - Remove devices from system
- **View Details** - Access comprehensive device information

#### Real-time Monitoring
- **Live Status Updates** - Real-time connection status via SSE
- **Automatic Refresh** - Device list updates automatically
- **Connection Tracking** - Monitor device online/offline status
- **Status Indicators** - Visual indicators for device status

#### Device Organization
- **Device Tagging** - Assign and manage device tags
- **Tag Filtering** - Filter devices by assigned tags
- **Search Functionality** - Find devices by name or ID
- **Status Filtering** - Filter by Active/Inactive status

### Device Data Structure

#### Core Information
- **Device ID** - Unique system identifier
- **Device Name** - Human-readable name
- **Device Type** - Type of device (hardware classification)
- **Status** - Active/Inactive state
- **Connection Status** - Online/Offline (real-time)

#### Network Information
- **Primary MAC** - Main MAC address
- **WiFi MAC** - Wireless network MAC
- **LAN MAC** - Wired network MAC
- **OS Version** - Operating system version

#### Hardware Information
- **Hardware ID** - Hardware identifier
- **Manufacturer** - Device manufacturer
- **Device Type** - Hardware classification

## Common Workflows

### Workflow 1: Device Registration and Setup
1. **Register Device** - Use factory token to register device
2. **Claim Device** - Use PIN to claim device
3. **Assign Tags** - Tag device for organization
4. **Verify Status** - Confirm device is online and responding
5. **Activate Device** - Ensure device is active in system

### Workflow 2: Device Management
1. **View Device List** - See all devices with real-time status
2. **Search/Filter** - Find specific devices using search and filters
3. **Edit Device** - Modify device name, type, or settings
4. **Manage Status** - Activate or deactivate devices as needed
5. **Organize with Tags** - Assign tags for better organization

### Workflow 3: Device Monitoring
1. **Check Status** - Monitor real-time connection status
2. **Review Information** - Check device details and hardware info
3. **Filter by Status** - View only online/offline devices
4. **Filter by Tags** - Group devices by assigned tags
5. **Track Changes** - Monitor status changes in real-time

### Workflow 4: Device Organization
1. **Assign Tags** - Add relevant tags to devices
2. **Filter by Tags** - Use tag filters to organize devices
3. **Search Devices** - Find devices by name or ID
4. **Status Management** - Activate/deactivate devices
5. **Bulk Operations** - Manage multiple devices efficiently

## Real-World Example

### **Example Device: "Office Terminal 001"**
- **Device Name**: Office Terminal 001
- **Device ID**: device_office_001
- **Status**: Active
- **Connection**: Online
- **MAC Address**: 00:11:22:33:44:55
- **OS Version**: Linux 5.4.0
- **Tags**: office, terminal, production

### **Device Management Process**
1. **View Device** - Click on device name to see details
2. **Check Status** - Verify device is online and active
3. **Edit Information** - Update device name or settings if needed
4. **Manage Tags** - Add or remove tags for organization
5. **Monitor Status** - Watch for real-time status changes

## Troubleshooting

### Common Issues

#### Device List Issues
- **Devices Not Loading** - Check network connection and refresh page
- **Status Not Updating** - Verify SSE connection is working
- **Search Not Working** - Check search terms and try different keywords
- **Filter Not Applied** - Verify filter selections are correct

#### Device Management Issues
- **Cannot Edit Device** - Check admin permissions and device status
- **Status Toggle Failed** - Verify device exists and is accessible
- **Delete Failed** - Check if device is in use or has dependencies
- **Tags Not Showing** - Verify tags are properly assigned

#### Real-time Issues
- **Status Not Updating** - Check SSE connection and device connectivity
- **Connection Lost** - Refresh page to re-establish connection
- **Updates Delayed** - Wait for automatic refresh or manually refresh
- **Status Inconsistent** - Check device actual status vs displayed status

### Error Messages

#### "Device Not Found"
- **Cause**: Device ID doesn't exist in system
- **Solution**: Verify device ID and check device list

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Device Offline"
- **Cause**: Device is not connected to system
- **Solution**: Check device network connection and power

#### "Status Update Failed"
- **Cause**: Cannot update device status
- **Solution**: Check device exists and try again

## Best Practices

### Device Management
- **Regular Monitoring** - Check device status regularly
- **Proper Tagging** - Use consistent tagging system for organization
- **Status Management** - Keep device statuses up to date
- **Documentation** - Keep device information up to date
- **Real-time Updates** - Monitor real-time status changes

### Organization
- **Descriptive Names** - Use clear, descriptive device names
- **Logical Tagging** - Tag devices logically for easy filtering
- **Status Tracking** - Monitor device status changes
- **Regular Cleanup** - Remove inactive or unused devices
- **Access Control** - Control device access appropriately

### Performance
- **Real-time Monitoring** - Use real-time status updates effectively
- **Filter Usage** - Use filters to manage large device lists
- **Search Optimization** - Use search functionality for quick access
- **Status Management** - Keep device statuses current
- **System Health** - Monitor overall device system health

### Security
- **Access Control** - Control device access strictly
- **Status Monitoring** - Monitor device status changes
- **Permission Management** - Manage device permissions carefully
- **Data Protection** - Protect sensitive device information
- **Audit Logging** - Log all device operations

## Technical Details

### Device Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable device name
- **Device Type** - Hardware classification
- **Status** - Active/Inactive state
- **Connection Status** - Online/Offline (real-time)
- **MAC Addresses** - Primary, WiFi, and LAN MAC addresses
- **OS Version** - Operating system version
- **Hardware ID** - Hardware identifier
- **Manufacturer** - Device manufacturer
- **Tags** - Associated device tags

### Search and Filtering
- **Search Fields** - Name, ID, hardware ID, MAC addresses, OS version
- **Filter Options** - Status (Active/Inactive), Tags
- **Sort Options** - Name, MAC address, OS version, created date
- **Pagination** - Configurable page size and navigation

### Real-time Features
- **SSE Connection** - Real-time status updates via Server-Sent Events
- **Automatic Refresh** - Device list updates automatically
- **Connection Monitoring** - Live connection status tracking
- **Status Indicators** - Visual indicators for device status

## Related Features

- **[Device Tags](./device_tags.md)** - Organize devices with tags
- **[Factory Tokens](./factory_tokens.md)** - Register new devices
- **[Preclaims](./preclaims.md)** - Pre-configure device claims
- **[Bundle Management](./bundles.md)** - Deploy applications to devices
- **[Device Profiles](./device_profiles.md)** - Configure device settings

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Real-time Status** - Monitor device status in real-time
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Status Issues** - Check real-time connection status
- **Search Problems** - Try different search terms or clear filters
- **Filter Issues** - Verify filter selections are correct
- **Connection Problems** - Refresh page to re-establish SSE connection

---

**Status**: ✅ Updated - This guide now accurately reflects the current device management UI and functionality.
