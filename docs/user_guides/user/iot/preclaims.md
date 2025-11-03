# User Preclaims Guide

**Last Updated**: 2025-10-12  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **User Preclaims** feature allows you to claim IoT devices using PIN codes. You can generate PIN codes for devices, share them with users, and manage the claiming process for bulk device deployment and user onboarding.

## Prerequisites

- **User account** - Valid user account with preclaim permissions
- **Device access** - Access to devices for claiming
- **PIN management** - Understanding of PIN-based claiming process

## Getting Started

### Quick Start
1. **Access Preclaims** - Navigate to User → IoT → Preclaims
2. **Generate PINs** - Create PIN codes for devices
3. **Share PINs** - Share PIN codes with users
4. **Monitor Claims** - Track device claiming progress
5. **Manage Claims** - Handle claiming issues and conflicts

### Navigation
- **Menu Path**: User → IoT → Preclaims
- **URL**: `/user/iot/preclaims`
- **Direct Access**: Click "Preclaims" in the IoT section

## Core Functionality

### PIN Management

#### PIN Generation
- **PIN Code** - Unique PIN code for device claiming
- **Device Assignment** - Assign PIN to specific device
- **Expiration Date** - Set PIN expiration date
- **Usage Limit** - Set maximum number of uses
- **User Assignment** - Assign PIN to specific user
- **Bulk Generation** - Generate multiple PINs at once

#### PIN Information
- **PIN ID** - Unique PIN identifier
- **PIN Code** - The actual PIN code
- **Device ID** - Associated device identifier
- **User ID** - Assigned user identifier
- **Creation Date** - When the PIN was created
- **Expiration Date** - When the PIN expires
- **Usage Count** - Number of times PIN has been used
- **Status** - Current PIN status

#### PIN Status Indicators
- 🟢 **Active** - PIN is active and available for use
- 🔴 **Expired** - PIN has expired and cannot be used
- 🟡 **Used** - PIN has been used and is no longer valid
- 🔵 **Pending** - PIN is pending activation
- ⚪ **Cancelled** - PIN has been cancelled
- 🟠 **Blocked** - PIN has been blocked due to security issues

### Device Claiming Process

#### Claiming Workflow
- **PIN Entry** - User enters PIN code
- **PIN Validation** - System validates PIN code
- **Device Verification** - Verify device is available for claiming
- **User Authentication** - Authenticate user claiming device
- **Claiming Process** - Execute device claiming
- **Confirmation** - Confirm successful claiming

#### Claiming Requirements
- **Valid PIN** - PIN must be valid and not expired
- **Available Device** - Device must be available for claiming
- **User Authentication** - User must be authenticated
- **Sufficient Permissions** - User must have claiming permissions
- **Network Connectivity** - Device must be connected to network
- **System Availability** - System must be available for claiming

### Preclaim Management

#### Preclaim Sets
- **Set Name** - Descriptive name for preclaim set
- **Set Description** - Detailed description of preclaim set
- **Device Count** - Number of devices in the set
- **PIN Count** - Number of PINs generated
- **Target Users** - Users who will receive PINs
- **Deployment Date** - When preclaims will be deployed

#### Preclaim Operations
- **Create Set** - Create new preclaim set
- **Generate PINs** - Generate PINs for devices
- **Distribute PINs** - Distribute PINs to users
- **Monitor Claims** - Monitor claiming progress
- **Handle Issues** - Handle claiming issues
- **Complete Set** - Mark preclaim set as complete

## Advanced Features

### PIN-Based Claiming Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **PIN Validation Timeout: 10 Seconds**
- **Per PIN**: Each PIN validation has a **10-second timeout**
- **Timeout Behavior**: If validation takes too long → **FAILED**
- **Retry Logic**: Failed validations are retried up to 2 times
- **Total Validation Timeout**: 30 seconds for complete PIN validation (2 retries)

#### **Device Claiming Timeout: 2 Minutes**
- **Per Device**: Each device claiming has a **2-minute timeout**
- **Timeout Behavior**: If claiming takes too long → **FAILED**
- **Retry Logic**: Failed claims are retried up to 2 times
- **Total Claiming Timeout**: 6 minutes for complete device claiming

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **PIN Valid**: PIN code is valid and not expired
- **Device Available**: Device is available for claiming
- **User Authenticated**: User is properly authenticated
- **Claiming Complete**: Device claiming completed successfully

##### ❌ **Failure Cases**
- **PIN Invalid**: PIN code is invalid or expired
- **Device Unavailable**: Device is not available for claiming
- **Authentication Failed**: User authentication failed
- **Claiming Timeout**: Device claiming took too long

### 📊 **PIN-Based Claiming Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User          │    │   PIN            │    │  Device         │
│   Enters PIN    │───▶│   Validation     │───▶│   Verification  │
│                 │    │  (10sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Device         │◀───│  Device          │◀───│  User           │
│   Claimed       │    │   Claiming       │    │   Authentication│
│                 │    │  (2min timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Claiming       │◀───│  Claiming        │◀───│  Claiming       │
│   Complete      │    │   Process        │    │   Confirmation  │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed PIN Claiming Process**

#### **Step 1: PIN Validation**
```
PIN Validation:
├── Start 10-second Timer
├── Validate PIN Format
├── Check PIN Expiration
├── Verify PIN Usage
└── Confirm PIN Validity
```

#### **Step 2: Device Verification**
```
Device Verification:
├── Check Device Status
├── Verify Device Availability
├── Check Device Permissions
├── Validate Device Access
└── Confirm Device Ready
```

#### **Step 3: Device Claiming**
```
Device Claiming:
├── Start 2-minute Timer
├── Authenticate User
├── Execute Claiming Process
├── Update Device Ownership
└── Confirm Claiming Success
```

### Bulk PIN Operations

#### Bulk PIN Generation
- **Batch Size** - Number of PINs to generate in batch
- **PIN Format** - Format for generated PINs
- **Expiration Settings** - Bulk expiration settings
- **User Assignment** - Bulk user assignment
- **Device Assignment** - Bulk device assignment
- **Validation Rules** - Bulk validation rules

#### Bulk PIN Distribution
- **Distribution Method** - How to distribute PINs (Email, SMS, etc.)
- **Distribution List** - List of users to receive PINs
- **Distribution Schedule** - When to distribute PINs
- **Distribution Tracking** - Track distribution status
- **Distribution Confirmation** - Confirm PIN receipt
- **Distribution Reports** - Generate distribution reports

### PIN Security

#### Security Features
- **PIN Encryption** - Encrypt PIN codes for security
- **PIN Hashing** - Hash PIN codes for storage
- **PIN Rotation** - Rotate PIN codes regularly
- **PIN Monitoring** - Monitor PIN usage for security
- **PIN Blocking** - Block suspicious PIN usage
- **PIN Auditing** - Audit PIN usage and access

#### Security Policies
- **PIN Complexity** - Set PIN complexity requirements
- **PIN Expiration** - Set PIN expiration policies
- **PIN Usage Limits** - Set PIN usage limits
- **PIN Access Control** - Control PIN access permissions
- **PIN Monitoring** - Monitor PIN security events
- **PIN Incident Response** - Respond to PIN security incidents

## Common Workflows

### Workflow 1: Generate and Distribute PINs
1. **Create Preclaim Set** - Create new preclaim set
2. **Select Devices** - Choose devices for claiming
3. **Generate PINs** - Generate PIN codes for devices
4. **Assign Users** - Assign PINs to users
5. **Distribute PINs** - Send PINs to users
6. **Monitor Distribution** - Track PIN distribution
7. **Confirm Receipt** - Confirm users received PINs

### Workflow 2: Device Claiming Process
1. **User Receives PIN** - User receives PIN code
2. **User Enters PIN** - User enters PIN in claiming interface
3. **System Validates PIN** - System validates PIN code
4. **System Verifies Device** - System verifies device availability
5. **System Claims Device** - System executes claiming process
6. **User Confirms** - User confirms successful claiming
7. **System Updates** - System updates device ownership

### Workflow 3: Bulk Device Deployment
1. **Plan Deployment** - Plan bulk device deployment
2. **Generate PIN Set** - Generate PIN set for deployment
3. **Prepare Devices** - Prepare devices for claiming
4. **Distribute PINs** - Distribute PINs to deployment team
5. **Execute Deployment** - Execute device deployment
6. **Monitor Claims** - Monitor claiming progress
7. **Complete Deployment** - Mark deployment as complete

### Workflow 4: PIN Management
1. **Review PINs** - Review existing PINs and usage
2. **Identify Issues** - Identify PIN issues and problems
3. **Handle Expired PINs** - Handle expired PINs
4. **Clean Up Unused PINs** - Remove unused PINs
5. **Update PIN Policies** - Update PIN security policies
6. **Monitor PIN Security** - Monitor PIN security events
7. **Generate Reports** - Generate PIN usage reports

## 📋 **Real-World Example: Office Device Deployment**

### **Example Preclaim: "Office Device Deployment"**
- **Preclaim Set**: Office Device Deployment
- **Devices**: 5 office devices
- **Users**: 5 office staff members
- **Purpose**: Deploy devices to office staff

### **Timeline & Expected Behavior**

#### **T+0:00 - Preclaim Set Creation**
```
Preclaim Set Creation:
├── Set Name: "Office Device Deployment"
├── Devices: 5 office devices
├── Users: 5 office staff
├── PIN Count: 5 PINs
└── Status: SET_CREATED
```

#### **T+0:05 - PIN Generation**
```
PIN Generation:
├── PIN 1: 123456 (Device: Office-001)
├── PIN 2: 234567 (Device: Office-002)
├── PIN 3: 345678 (Device: Office-003)
├── PIN 4: 456789 (Device: Office-004)
└── PIN 5: 567890 (Device: Office-005)
```

#### **T+0:10 - PIN Distribution**
```
PIN Distribution:
├── User 1: Receives PIN 123456
├── User 2: Receives PIN 234567
├── User 3: Receives PIN 345678
├── User 4: Receives PIN 456789
└── User 5: Receives PIN 567890
```

#### **T+0:15 - Device Claiming Start**
```
Device Claiming:
├── User 1: Claims Office-001 with PIN 123456
├── Start 10-second PIN validation timer
├── PIN Validation: SUCCESS
├── Start 2-minute device claiming timer
└── Status: CLAIMING
```

#### **T+0:20 - Device Claiming Complete**
```
Device Claiming Complete:
├── Office-001: Claimed by User 1
├── Claiming Time: 5 seconds
├── Status: CLAIMED
└── PIN Status: USED
```

#### **T+0:25 - All Devices Claimed**
```
All Devices Claimed:
├── Office-001: Claimed by User 1
├── Office-002: Claimed by User 2
├── Office-003: Claimed by User 3
├── Office-004: Claimed by User 4
└── Office-005: Claimed by User 5
```

### **Total Deployment Time: 25 seconds**
- **Set Creation**: 5 seconds
- **PIN Generation**: 5 seconds
- **PIN Distribution**: 5 seconds
- **Device Claiming**: 10 seconds
- **Within 10-second PIN validation timeout**

### **PIN Validation Example**

#### **T+0:00 - PIN Entry**
```
PIN Entry:
├── User: John Smith
├── PIN Entered: 123456
├── Start 10-second validation timer
└── Status: VALIDATING
```

#### **T+0:02 - PIN Validation**
```
PIN Validation:
├── PIN Format: VALID
├── PIN Expiration: NOT_EXPIRED
├── PIN Usage: NOT_USED
├── PIN Status: ACTIVE
└── Validation: SUCCESS
```

#### **T+0:05 - Device Verification**
```
Device Verification:
├── Device: Office-001
├── Device Status: ONLINE
├── Device Availability: AVAILABLE
├── Device Permissions: VALID
└── Verification: SUCCESS
```

#### **T+0:08 - Device Claiming**
```
Device Claiming:
├── User Authentication: SUCCESS
├── Device Claiming: IN_PROGRESS
├── Ownership Update: SUCCESS
└── Claiming: SUCCESS
```

### **Total Claiming Time: 8 seconds**
- **PIN Validation**: 2 seconds
- **Device Verification**: 3 seconds
- **Device Claiming**: 3 seconds
- **Within 10-second PIN validation timeout**

### **Failure Scenario Example**

#### **T+0:00 - PIN Entry**
```
PIN Entry:
├── User: John Smith
├── PIN Entered: 999999
├── Start 10-second validation timer
└── Status: VALIDATING
```

#### **T+0:02 - PIN Validation**
```
PIN Validation:
├── PIN Format: VALID
├── PIN Expiration: NOT_EXPIRED
├── PIN Usage: NOT_USED
├── PIN Status: INACTIVE
└── Validation: FAILED
```

#### **T+0:05 - Validation Error**
```
Validation Error:
├── Error: "PIN not found or inactive"
├── Validation Time: 5 seconds
├── Status: FAILED
└── User Notification: "Invalid PIN code"
```

#### **T+0:10 - Retry Attempt**
```
Retry Attempt:
├── User: John Smith
├── PIN Entered: 123456 (correct PIN)
├── Start 10-second validation timer
└── Status: VALIDATING
```

#### **T+0:12 - Successful Validation**
```
Successful Validation:
├── PIN Validation: SUCCESS
├── Device Verification: SUCCESS
├── Device Claiming: SUCCESS
└── Status: CLAIMED
```

## Troubleshooting

### Common Issues

#### PIN Validation Problems
- **Check PIN Format** - Verify PIN format is correct
- **Check PIN Expiration** - Verify PIN has not expired
- **Check PIN Status** - Verify PIN is active
- **Check PIN Usage** - Verify PIN has not been used
- **Check Network** - Verify network connectivity
- **Check Logs** - Review PIN validation logs

#### Device Claiming Issues
- **Check Device Status** - Verify device is online
- **Check Device Availability** - Verify device is available for claiming
- **Check User Permissions** - Verify user has claiming permissions
- **Check Device Permissions** - Verify device permissions are correct
- **Check System Status** - Verify system is available
- **Check Logs** - Review device claiming logs

#### PIN Distribution Problems
- **Check User Information** - Verify user contact information
- **Check Distribution Method** - Verify distribution method is working
- **Check Network** - Verify network connectivity
- **Check Email/SMS Service** - Verify email/SMS service is working
- **Check User Permissions** - Verify user has PIN access permissions
- **Check Logs** - Review PIN distribution logs

### Error Messages

#### "Invalid PIN Code"
- **Cause**: PIN code is invalid or not found
- **Solution**: Check PIN code and try again

#### "PIN Expired"
- **Cause**: PIN code has expired
- **Solution**: Request new PIN code

#### "PIN Already Used"
- **Cause**: PIN code has already been used
- **Solution**: Request new PIN code

#### "Device Not Available"
- **Cause**: Device is not available for claiming
- **Solution**: Check device status and try again

#### "Claiming Timeout"
- **Cause**: Device claiming took too long
- **Solution**: Check device status and try again

## Best Practices

### PIN Management
- **Secure PINs** - Use secure PIN generation methods
- **PIN Expiration** - Set appropriate PIN expiration dates
- **PIN Monitoring** - Monitor PIN usage for security
- **PIN Cleanup** - Clean up expired and unused PINs
- **PIN Documentation** - Document PIN usage and purpose
- **PIN Security** - Implement PIN security policies

### Device Claiming
- **User Training** - Train users on claiming process
- **Clear Instructions** - Provide clear claiming instructions
- **Support Availability** - Ensure support is available during claiming
- **Progress Monitoring** - Monitor claiming progress
- **Issue Handling** - Handle claiming issues promptly
- **Documentation** - Document claiming procedures

### Bulk Operations
- **Plan Deployment** - Plan bulk deployment carefully
- **Test Process** - Test claiming process before bulk deployment
- **Monitor Progress** - Monitor bulk claiming progress
- **Handle Issues** - Handle bulk claiming issues
- **Document Results** - Document bulk deployment results
- **Follow-up** - Follow up on bulk deployment results

## Related Features

- **[Devices](./devices.md)** - Device management and monitoring
- **[PIN Rules](./pin_rules.md)** - PIN-based claiming rule management
- **[Logs](./logs.md)** - PIN claiming logs and diagnostics
- **[Dashboard](./dashboard.md)** - Preclaim overview and monitoring
- **[Support](./support.md)** - Help with PIN claiming issues

## API Reference

### PIN Management API
- **GET /api/user/iot/preclaims** - Get preclaim list
- **POST /api/user/iot/preclaims** - Create new preclaim set
- **GET /api/user/iot/preclaims/{id}** - Get preclaim details
- **PUT /api/user/iot/preclaims/{id}** - Update preclaim set
- **DELETE /api/user/iot/preclaims/{id}** - Delete preclaim set

### PIN Operations API
- **POST /api/user/iot/preclaims/{id}/pins** - Generate PINs
- **GET /api/user/iot/preclaims/{id}/pins** - Get PIN list
- **POST /api/user/iot/preclaims/{id}/distribute** - Distribute PINs
- **GET /api/user/iot/preclaims/{id}/status** - Get preclaim status

### PIN Claiming API
- **POST /api/user/iot/preclaims/claim** - Claim device with PIN
- **GET /api/user/iot/preclaims/claim/{id}** - Get claiming status
- **POST /api/user/iot/preclaims/claim/{id}/validate** - Validate PIN
- **GET /api/user/iot/preclaims/claim/{id}/device** - Get claimed device

## Support

### Getting Help
- **In-App Help** - Use the help system within the preclaims page
- **Documentation** - Check the comprehensive user guides
- **Support Portal** - Access the support system
- **Community** - Join the user community for help

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of user preclaim management from PIN generation to device claiming and troubleshooting.
