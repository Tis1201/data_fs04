# Preclaims User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Preclaims allow you to pre-configure device claims before devices are registered. This enables bulk device setup, automated claiming workflows, and streamlined device deployment by preparing device claims in advance.

## Prerequisites

- **Admin permissions** - Full preclaim management access
- **Device understanding** - Knowledge of device types and requirements
- **PIN management** - Understanding of PIN-based claiming
- **Bulk operations** - Experience with bulk device operations

## Getting Started

### Quick Start
1. **Navigate to Preclaims** - Go to Admin → IOT → Preclaims
2. **Create New Preclaim** - Click "Create Preclaim" button
3. **Configure Preclaim** - Set preclaim name, PIN, and target devices
4. **Add Devices** - Add devices to preclaim set
5. **Activate Preclaim** - Activate preclaim for use
6. **Monitor Usage** - Track preclaim usage and device claims

### Navigation
- **Menu Path**: Admin → IOT → Preclaims
- **URL**: `/admin/iot/preclaims`
- **Direct Access**: Click "Preclaims" in the IOT section

## Core Functionality

### Preclaim List View

#### Preclaim Information Display
- **Preclaim Name** - Human-readable preclaim name
- **Preclaim ID** - Unique system identifier
- **Status** - Active/Inactive/Draft
- **Created Date** - When preclaim was created
- **Last Modified** - Last update timestamp
- **Device Count** - Number of devices in preclaim
- **Claimed Count** - Number of devices already claimed
- **Remaining Count** - Number of devices not yet claimed
- **PIN** - PIN for claiming devices

#### Preclaim Status Indicators
- 🟢 **Active** - Preclaim is active and can be used
- 🔴 **Inactive** - Preclaim is disabled
- 🟡 **Draft** - Preclaim is being created/modified
- ⚪ **Expired** - Preclaim has expired

#### Filtering and Search
- **Search by Name** - Find preclaims by name
- **Filter by Status** - Show only active/inactive preclaims
- **Filter by Date** - Show preclaims by creation date
- **Filter by Usage** - Show preclaims by usage count
- **Sort Options** - Sort by name, status, date, usage, etc.

### Preclaim Detail View

#### Preclaim Information Tab
- **Basic Info** - Name, ID, description, status
- **Creation Info** - Created by, created date, last modified
- **PIN Info** - PIN value, expiration, usage count
- **Usage Info** - Device count, claimed count, remaining count

#### Device List Tab
- **Device List** - Devices included in preclaim
- **Device Status** - Claimed/Unclaimed status for each device
- **Device Info** - Device details and information
- **Device Management** - Add, remove, manage devices

#### Claiming History Tab
- **Claiming Events** - Historical claiming events
- **Claiming Statistics** - Claiming success rates and patterns
- **Claiming Analytics** - Detailed claiming analytics
- **Claiming Reports** - Claiming activity reports

## Advanced Features

### Preclaim Creation

#### Basic Preclaim Setup
- **Preclaim Name** - Choose descriptive name
- **Description** - Add detailed description
- **PIN** - Set PIN for claiming devices
- **Expiration** - Set preclaim expiration date
- **Target Account** - Set target account for claims

#### Device Selection
- **Device Browser** - Browse available devices
- **Device Filtering** - Filter by status, type, location
- **Device Groups** - Select device groups
- **Bulk Selection** - Select multiple devices
- **Device Validation** - Validate device selection

#### Preclaim Configuration
- **PIN Settings** - Configure PIN properties
- **Expiration Settings** - Set expiration rules
- **Claiming Rules** - Define claiming rules
- **Notification Settings** - Configure notifications
- **Security Settings** - Set security parameters

### Preclaim Management

#### Device Management
- **Add Devices** - Add devices to preclaim
- **Remove Devices** - Remove devices from preclaim
- **Update Devices** - Update device information
- **Validate Devices** - Validate device status
- **Bulk Operations** - Perform bulk operations on devices

#### PIN Management
- **PIN Generation** - Generate secure PINs
- **PIN Validation** - Validate PIN format and security
- **PIN Rotation** - Rotate PINs for security
- **PIN Expiration** - Manage PIN expiration
- **PIN Usage** - Track PIN usage

#### Claiming Management
- **Claiming Process** - Manage claiming process
- **Claiming Validation** - Validate claiming requests
- **Claiming Tracking** - Track claiming progress
- **Claiming Analytics** - Analyze claiming data
- **Claiming Reports** - Generate claiming reports

## Preclaim Claiming Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **PIN Validation Timeout: 10 Seconds**
- **Per Request**: Each PIN validation has a **10-second timeout**
- **Timeout Behavior**: If validation takes too long → **FAILED**
- **Retry Logic**: Failed validations are retried up to 2 times
- **Total Claiming Timeout**: 60 seconds for complete claiming process

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **PIN Valid**: PIN is valid and matches preclaim
- **Device Available**: Device is available for claiming
- **Claiming Complete**: Device successfully claimed
- **Account Assigned**: Device assigned to target account

##### ❌ **Failure Cases**
- **PIN Invalid**: PIN is invalid or doesn't match
- **PIN Expired**: PIN has expired
- **Device Already Claimed**: Device is already claimed
- **Device Offline**: Device is offline
- **Validation Timeout**: PIN validation times out

### 📊 **Preclaim Claiming Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Enters   │    │   PIN Validation │    │  PIN Validated  │
│      PIN        │───▶│   Request        │───▶│   Successfully  │
│                 │    │  (10sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Device Status  │◀───│  Claim Device    │◀───│  Find Available│
│   CLAIMED       │    │  with PIN        │    │  Device         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Claiming       │◀───│  Assign to       │◀───│  Generate Device│
│   Complete      │    │  Account         │    │  Credentials    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Claiming Process**

#### **Step 1: PIN Validation**
```
User Claiming Request:
├── Extract PIN from Request
├── Start 10-second Timer
├── Validate PIN Format
├── Check PIN Expiration
└── Verify PIN Matches Preclaim
```

#### **Step 2: Device Claiming**
```
PIN Validation Success:
├── Find Available Device
├── Check Device Status
├── Claim Device
├── Assign to Account
└── Update Device Status
```

#### **Step 3: Claiming Completion**
```
Claiming Complete:
├── Generate Device Credentials
├── Send Credentials to User
├── Update Preclaim Statistics
└── Claiming Status: SUCCESS
```

## Common Workflows

### Workflow 1: Create and Use Preclaim
1. **Create Preclaim** - Set up new preclaim with name and PIN
2. **Add Devices** - Add devices to preclaim set
3. **Configure Settings** - Set preclaim configuration
4. **Activate Preclaim** - Activate preclaim for use
5. **Distribute PIN** - Provide PIN to users for claiming
6. **Monitor Claims** - Track device claiming progress
7. **Manage Preclaim** - Update or deactivate preclaim as needed

### Workflow 2: Bulk Device Setup
1. **Create Preclaim** - Create preclaim for bulk setup
2. **Add Device Batch** - Add batch of devices to preclaim
3. **Generate PINs** - Generate secure PINs for claiming
4. **Distribute PINs** - Distribute PINs to users
5. **Monitor Progress** - Track claiming progress
6. **Handle Issues** - Resolve any claiming issues
7. **Complete Setup** - Finalize bulk device setup

### Workflow 3: Device Claiming with PIN
1. **User Request** - User enters PIN for claiming
2. **PIN Validation** - Validate PIN (10-second timeout)
3. **Device Selection** - Find available device for claiming
4. **Device Claiming** - Claim device with PIN
5. **Account Assignment** - Assign device to user account
6. **Credential Generation** - Generate device credentials
7. **Claiming Complete** - Complete claiming process

### Workflow 4: Preclaim Troubleshooting
1. **Identify Issue** - Determine preclaim problem
2. **Check PIN Status** - Verify PIN is valid and not expired
3. **Check Device Status** - Verify devices are available
4. **Check Preclaim Status** - Verify preclaim is active
5. **Check Logs** - Review claiming logs
6. **Test Manually** - Test claiming manually
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Preclaim Claiming**

### **Example Preclaim: "Office Devices Batch 1"**
- **Preclaim ID**: `preclaim_office_batch_001`
- **PIN**: `OFFICE2024`
- **Devices**: 10 office devices
- **Target Account**: `account_office_001`

### **Timeline & Expected Behavior**

#### **T+0:00 - User Claiming Request**
```
User Action: Enter PIN for Device Claiming
├── PIN: "OFFICE2024"
├── User Account: "user_office_001"
└── Start 10-second validation timer
```

#### **T+0:01 - PIN Validation**
```
Server Action: Validate PIN
├── Check PIN Format: VALID
├── Check PIN Expiration: NOT EXPIRED
├── Check PIN Matches Preclaim: VALID
└── PIN Status: VALID
```

#### **T+0:02 - Device Selection**
```
Server Action: Find Available Device
├── Search Preclaim Devices: 10 devices
├── Find Unclaimed Device: "device_office_001"
├── Check Device Status: AVAILABLE
└── Device Selected: "device_office_001"
```

#### **T+0:03 - Device Claiming**
```
Server Action: Claim Device
├── Claim Device: "device_office_001"
├── Assign to Account: "account_office_001"
├── Update Device Status: CLAIMED
└── Generate Device Credentials
```

#### **T+0:04 - Claiming Response**
```
Server Response: {"status": "success", "deviceId": "device_office_001", "credentials": "..."}
├── Device Status: CLAIMED
├── Preclaim Remaining: 9 devices
└── Claiming Complete
```

### **Total Claiming Time: 4 seconds**
- **PIN Validation**: 1 second
- **Device Selection**: 1 second
- **Device Claiming**: 1 second
- **Response**: 1 second
- **Within 10-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - User Claiming Request**
```
User Action: Enter PIN for Device Claiming
├── PIN: "WRONGPIN"
├── User Account: "user_office_001"
└── Start 10-second validation timer
```

#### **T+0:01 - PIN Validation**
```
Server Action: Validate PIN
├── Check PIN Format: VALID
├── Check PIN Expiration: NOT EXPIRED
├── Check PIN Matches Preclaim: INVALID
└── PIN Status: INVALID
```

#### **T+0:02 - Claiming Response**
```
Server Response: {"status": "error", "error": "Invalid PIN"}
├── Device Status: NOT CLAIMED
├── Preclaim Remaining: 10 devices (no change)
└── Claiming Failed
```

## Troubleshooting

### Common Issues

#### Preclaim Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify preclaim configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run preclaim validation

#### PIN Validation Failures
- **Check PIN Format** - Verify PIN format is correct
- **Check PIN Expiration** - Ensure PIN is not expired
- **Check PIN Match** - Verify PIN matches preclaim
- **Check Preclaim Status** - Verify preclaim is active
- **Check Logs** - Review validation logs

#### Device Claiming Failures
- **Check Device Status** - Ensure devices are available
- **Check Device Count** - Verify devices are in preclaim
- **Check Account Status** - Verify target account is valid
- **Check Preclaim Status** - Verify preclaim is active
- **Check Logs** - Review claiming logs

#### Performance Issues
- **Check PIN Complexity** - Simplify complex PINs
- **Check Device Count** - Monitor device count in preclaim
- **Check Server Load** - Monitor server performance
- **Check Network Latency** - Monitor network performance
- **Check Logs** - Review performance logs

### Error Messages

#### "Preclaim Not Found"
- **Cause**: Preclaim ID doesn't exist in system
- **Solution**: Verify preclaim ID and check preclaim list

#### "PIN Invalid"
- **Cause**: PIN is invalid or doesn't match
- **Solution**: Check PIN format and verify PIN matches preclaim

#### "PIN Expired"
- **Cause**: PIN has expired
- **Solution**: Create new preclaim or renew existing PIN

#### "No Available Devices"
- **Cause**: No devices available in preclaim
- **Solution**: Add more devices to preclaim or check device status

#### "Claiming Timeout"
- **Cause**: Claiming process took too long
- **Solution**: Check server performance and network connectivity

## Best Practices

### Preclaim Design
- **Descriptive Names** - Use clear, descriptive preclaim names
- **Secure PINs** - Use secure, hard-to-guess PINs
- **Appropriate Expiration** - Set reasonable expiration dates
- **Device Limits** - Set appropriate device limits
- **Clear Documentation** - Document preclaim purpose and usage

### PIN Management
- **Strong PINs** - Use strong, secure PINs
- **PIN Rotation** - Rotate PINs regularly
- **PIN Expiration** - Set appropriate expiration dates
- **PIN Validation** - Validate PIN format and security
- **PIN Monitoring** - Monitor PIN usage and security

### Device Management
- **Device Validation** - Validate devices before adding to preclaim
- **Device Status** - Monitor device status regularly
- **Device Limits** - Set appropriate device limits
- **Device Organization** - Organize devices logically
- **Device Cleanup** - Clean up unused or invalid devices

### Security
- **Access Control** - Control preclaim access strictly
- **Audit Logging** - Log all preclaim operations
- **PIN Security** - Secure PIN generation and storage
- **Threat Detection** - Detect security threats
- **Regular Updates** - Keep preclaim system updated

## Related Features

- **[Factory Tokens](./factory_tokens.md)** - Register devices for preclaiming
- **[Device Management](./devices.md)** - Manage claimed devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to claimed devices
- **[PIN Rules](./pin_rules.md)** - Configure PIN rules for claiming
- **[Accounts](./accounts.md)** - Manage accounts for device assignment

## API Reference

### Preclaim Management API
- **GET /api/admin/iot/preclaims** - List all preclaims
- **POST /api/admin/iot/preclaims** - Create new preclaim
- **GET /api/admin/iot/preclaims/{id}** - Get preclaim details
- **PUT /api/admin/iot/preclaims/{id}** - Update preclaim
- **DELETE /api/admin/iot/preclaims/{id}** - Delete preclaim

### Preclaim Device API
- **POST /api/admin/iot/preclaims/{id}/devices** - Add devices to preclaim
- **GET /api/admin/iot/preclaims/{id}/devices** - Get devices in preclaim
- **DELETE /api/admin/iot/preclaims/{id}/devices/{deviceId}** - Remove device from preclaim
- **PUT /api/admin/iot/preclaims/{id}/devices/{deviceId}** - Update device in preclaim

### Device Claiming API
- **POST /api/device/claim** - Claim device with PIN
- **GET /api/device/claim/status** - Get claiming status
- **POST /api/device/claim/validate** - Validate claiming request

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Preclaim Logs** - Review preclaim operation logs
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of preclaim management from creation to device claiming and troubleshooting.
