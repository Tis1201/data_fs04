# Device Profiles User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Device Profiles allow you to create standardized configurations for your IoT devices. Profiles define settings, applications, and behaviors that can be applied to multiple devices, ensuring consistency and simplifying device management across your fleet.

## Prerequisites

- **Admin permissions** - Full device profile management access
- **Device understanding** - Knowledge of device types and requirements
- **Configuration planning** - Plan for device configuration needs
- **Application access** - Access to applications for profile configuration

## Getting Started

### Quick Start
1. **Navigate to Device Profiles** - Go to Admin → IOT → Device Profiles
2. **Create New Profile** - Click "Create Profile" button
3. **Configure Settings** - Set up profile configuration
4. **Add Applications** - Include required applications
5. **Assign to Devices** - Apply profile to target devices

### Navigation
- **Menu Path**: Admin → IOT → Device Profiles
- **URL**: `/admin/iot/device-profiles`
- **Direct Access**: Click "Device Profiles" in the IOT section

## Core Functionality

### Profile List View

#### Profile Information Display
- **Profile Name** - Human-readable profile name
- **Profile ID** - Unique system identifier
- **Version** - Profile version number
- **Status** - Active/Inactive/Draft
- **Created Date** - When profile was created
- **Last Modified** - Last update timestamp
- **Device Count** - Number of devices using profile
- **Category** - Profile category/type

#### Profile Status Indicators
- 🟢 **Active** - Profile is ready for use
- 🔴 **Inactive** - Profile is disabled
- 🟡 **Draft** - Profile is being created/modified
- ⚪ **Testing** - Profile is being tested

#### Filtering and Search
- **Search by Name** - Find profiles by name
- **Filter by Status** - Show only active/inactive profiles
- **Filter by Category** - Show profiles by category
- **Filter by Version** - Show profiles by version
- **Sort Options** - Sort by name, status, date, etc.

### Profile Detail View

#### Profile Information Tab
- **Basic Info** - Name, ID, description, version
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, usage statistics
- **Category Info** - Profile category and type

#### Configuration Tab
- **System Settings** - Operating system configuration
- **Network Settings** - Network configuration options
- **Security Settings** - Security and authentication settings
- **Performance Settings** - Performance optimization settings
- **Custom Settings** - Custom configuration options

#### Applications Tab
- **App List** - Applications included in profile
- **App Configuration** - App-specific settings
- **App Dependencies** - Application dependencies
- **App Management** - Add, remove, configure applications

#### Device Assignment Tab
- **Assigned Devices** - Devices using this profile
- **Assignment History** - Profile assignment history
- **Assignment Status** - Current assignment status
- **Assignment Management** - Manage device assignments

## Advanced Features

### Profile Creation

#### Basic Profile Setup
- **Profile Name** - Choose descriptive name
- **Description** - Add detailed description
- **Version** - Set version number
- **Category** - Assign profile category
- **Tags** - Add tags for organization

#### Configuration Management
- **System Configuration** - Set system-level settings
- **Network Configuration** - Configure network settings
- **Security Configuration** - Set security parameters
- **Performance Configuration** - Optimize performance settings
- **Custom Configuration** - Add custom settings

#### Application Management
- **App Selection** - Choose applications for profile
- **App Configuration** - Configure application settings
- **App Dependencies** - Manage application dependencies
- **App Ordering** - Set application installation order
- **App Validation** - Validate application compatibility

### Profile Configuration

#### System Settings
- **Operating System** - OS version and configuration
- **System Services** - Enable/disable system services
- **System Resources** - Configure resource limits
- **System Logging** - Set logging configuration
- **System Updates** - Configure update settings

#### Network Settings
- **Network Interfaces** - Configure network interfaces
- **IP Configuration** - Set IP address settings
- **DNS Settings** - Configure DNS servers
- **Firewall Rules** - Set firewall configuration
- **Network Security** - Configure network security

#### Security Settings
- **Authentication** - Set authentication methods
- **Authorization** - Configure access control
- **Encryption** - Set encryption settings
- **Certificates** - Manage certificates
- **Security Policies** - Define security policies

#### Performance Settings
- **Resource Limits** - Set CPU, memory, storage limits
- **Performance Tuning** - Optimize performance settings
- **Monitoring** - Configure monitoring settings
- **Logging** - Set logging levels and destinations
- **Backup** - Configure backup settings

### Profile Assignment

#### Device Selection
- **Device Browser** - Browse available devices
- **Device Filtering** - Filter by status, tags, location
- **Device Groups** - Select device groups
- **Compatibility Check** - Verify device compatibility
- **Assignment Preview** - Preview assignment impact

#### Assignment Configuration
- **Assignment Mode** - Immediate or scheduled assignment
- **Assignment Scope** - Select assignment scope
- **Conflict Resolution** - Handle configuration conflicts
- **Rollback Options** - Set rollback configuration
- **Notification Settings** - Configure assignment notifications

#### Profile Inheritance
- **Parent Profiles** - Set parent profile relationships
- **Inheritance Rules** - Define inheritance behavior
- **Override Settings** - Override inherited settings
- **Inheritance Validation** - Validate inheritance rules
- **Inheritance Documentation** - Document inheritance structure

### Profile Management

#### Version Control
- **Version Creation** - Create new profile versions
- **Version Comparison** - Compare profile versions
- **Version Rollback** - Rollback to previous versions
- **Version History** - Track version history
- **Version Documentation** - Document version changes

#### Profile Testing
- **Test Environment** - Set up test environment
- **Test Configuration** - Configure test settings
- **Test Execution** - Run profile tests
- **Test Results** - Review test results
- **Test Validation** - Validate test results

#### Profile Deployment
- **Deployment Planning** - Plan profile deployment
- **Deployment Execution** - Execute profile deployment
- **Deployment Monitoring** - Monitor deployment progress
- **Deployment Validation** - Validate deployment results
- **Deployment Rollback** - Rollback if needed

## Device Profile Application Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Profile Application Timeout: 3 Minutes**
- **Per Profile**: Each profile application has a **3-minute timeout**
- **Timeout Behavior**: If device doesn't respond within 3 minutes → **FAILED**
- **Retry Logic**: Failed profile applications are retried up to 2 times
- **Total Profile Timeout**: No overall profile timeout (depends on profile complexity)

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Profile Applied**: Device returns `{"status": "success", "profileId": "profile123"}`
- **Settings Applied**: All profile settings are successfully applied
- **Profile Active**: Profile status changes to `ACTIVE`

##### ❌ **Failure Cases**
- **Profile Timeout**: No response from device after 3 minutes
- **Profile Error**: Device returns `{"status": "error", "error": "Profile application failed"}`
- **Device Offline**: Device goes offline during profile application
- **Profile Failed**: Profile fails after 2 retries

### 📊 **Device Profile Application Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Creates │    │   Profile Apply  │    │  Device Receives│
│     Profile     │───▶│   to Device      │───▶│     Profile     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Profile Status │◀───│  Monitor Progress│◀───│  Apply Settings │
│    ACTIVE       │    │                  │    │  (3min timeout) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Profile Status │◀───│  Monitor Progress│◀───│  Apply Network  │
│    ACTIVE       │    │                  │    │  (3min timeout) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Profile Status │◀───│  Monitor Progress│◀───│  Apply Security │
│    ACTIVE       │    │                  │    │  (3min timeout) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Profile Application Process**

#### **Step 1: Profile Deployment**
```
Admin Action: Apply Profile to Device
├── Profile Status: APPLYING
├── Device Status: ONLINE
└── Start Application Process
```

#### **Step 2: Profile Application Loop**
```
For Each Setting in Profile:
├── Send Setting to Device
├── Start 3-minute Timer
├── Wait for Device Response
│   ├── Success Response → Continue to Next Setting
│   ├── Error Response → Retry (up to 2 times)
│   └── Timeout (3min) → Mark as FAILED
└── Update Profile Progress
```

#### **Step 3: Profile Completion**
```
All Settings Processed:
├── All Success → Profile Status: ACTIVE
├── Some Failed → Profile Status: PARTIAL
└── All Failed → Profile Status: FAILED
```

## Common Workflows

### Workflow 1: Create and Deploy Profile
1. **Create Profile** - Set up new profile with name and description
2. **Configure Settings** - Set up system, network, and security settings
3. **Add Applications** - Include required applications
4. **Test Profile** - Test profile on development device
5. **Deploy Profile** - Deploy to target devices
6. **Monitor Deployment** - Track deployment progress (3min per setting)
7. **Verify Configuration** - Confirm profile is working properly

### Workflow 2: Update Existing Profile
1. **Select Profile** - Choose profile to update
2. **Modify Configuration** - Update profile settings
3. **Update Applications** - Add, remove, or update applications
4. **Version Profile** - Create new version
5. **Test Updates** - Test updated profile
6. **Deploy Updates** - Deploy updated profile
7. **Monitor Updates** - Track update progress

### Workflow 3: Profile Assignment
1. **Select Profile** - Choose profile to assign
2. **Select Devices** - Choose target devices
3. **Check Compatibility** - Verify device compatibility
4. **Configure Assignment** - Set assignment parameters
5. **Execute Assignment** - Assign profile to devices
6. **Monitor Assignment** - Track assignment progress
7. **Verify Assignment** - Confirm profile is applied

## 📋 **Real-World Example: Device Profile Application**

### **Example Profile: "Office Security Profile"**
- **Profile ID**: `profile_office_security_001`
- **Settings**: 4 configuration groups (System, Network, Security, Apps)
- **Target Device**: `device_office_001`

### **Timeline & Expected Behavior**

#### **T+0:00 - Profile Application Start**
```
Admin Action: Apply "Office Security Profile"
├── Profile Status: APPLYING
├── Device Status: ONLINE
└── Start Application Process
```

#### **T+0:01 - System Settings Application**
```
Send System Settings to Device
├── Start 3-minute Timer
├── Device Response: "Applying system settings..."
└── Expected: Success within 3 minutes
```

#### **T+0:02 - System Settings Success**
```
Device Response: {"status": "success", "setting": "system", "profileId": "profile_office_security_001"}
├── System Settings Status: COMPLETED
├── Profile Progress: 25% (1/4 settings)
└── Continue to Network Settings
```

#### **T+0:03 - Network Settings Application**
```
Send Network Settings to Device
├── Start 3-minute Timer
├── Device Response: "Applying network settings..."
└── Expected: Success within 3 minutes
```

#### **T+0:04 - Network Settings Success**
```
Device Response: {"status": "success", "setting": "network", "profileId": "profile_office_security_001"}
├── Network Settings Status: COMPLETED
├── Profile Progress: 50% (2/4 settings)
└── Continue to Security Settings
```

#### **T+0:05 - Security Settings Application**
```
Send Security Settings to Device
├── Start 3-minute Timer
├── Device Response: "Applying security settings..."
└── Expected: Success within 3 minutes
```

#### **T+0:06 - Security Settings Success**
```
Device Response: {"status": "success", "setting": "security", "profileId": "profile_office_security_001"}
├── Security Settings Status: COMPLETED
├── Profile Progress: 75% (3/4 settings)
└── Continue to App Settings
```

#### **T+0:07 - App Settings Application**
```
Send App Settings to Device
├── Start 3-minute Timer
├── Device Response: "Applying app settings..."
└── Expected: Success within 3 minutes
```

#### **T+0:08 - App Settings Success**
```
Device Response: {"status": "success", "setting": "apps", "profileId": "profile_office_security_001"}
├── App Settings Status: COMPLETED
├── Profile Progress: 100% (4/4 settings)
└── Profile Status: ACTIVE
```

### **Total Application Time: 8 minutes**
- **System Settings**: 2 minutes
- **Network Settings**: 1 minute
- **Security Settings**: 1 minute
- **App Settings**: 1 minute
- **All within 3-minute timeout per setting**

### **Failure Scenario Example**

#### **T+0:05 - Security Settings Application**
```
Send Security Settings to Device
├── Start 3-minute Timer
├── Device Response: "Applying security settings..."
└── Wait for response...
```

#### **T+0:08 - Security Settings Timeout**
```
No response after 3 minutes
├── Security Settings Status: FAILED (timeout)
├── Retry Attempt 1: Send Security Settings again
├── Start new 3-minute Timer
└── Wait for response...
```

#### **T+0:11 - Security Settings Retry Timeout**
```
No response after 3 minutes (retry 1)
├── Security Settings Status: FAILED (timeout)
├── Retry Attempt 2: Send Security Settings again
├── Start new 3-minute Timer
└── Wait for response...
```

#### **T+0:14 - Security Settings Final Timeout**
```
No response after 3 minutes (retry 2)
├── Security Settings Status: FAILED (final timeout)
├── Profile Status: PARTIAL (3/4 settings successful)
└── Profile Application Complete with Errors
```

### Workflow 4: Profile Troubleshooting
1. **Identify Issue** - Determine profile problem
2. **Check Configuration** - Review profile configuration
3. **Check Device Status** - Verify device status
4. **Check Logs** - Review profile and device logs
5. **Test Manually** - Test profile manually
6. **Fix Issues** - Resolve identified problems
7. **Retry Assignment** - Attempt assignment again

## Troubleshooting

### Common Issues

#### Profile Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify profile configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run profile validation

#### Profile Assignment Failures
- **Check Device Status** - Ensure devices are online
- **Check Compatibility** - Verify device compatibility
- **Check Conflicts** - Resolve configuration conflicts
- **Check Permissions** - Verify assignment permissions
- **Check Logs** - Review assignment logs

#### Configuration Issues
- **Check Settings** - Verify configuration settings
- **Check Validation** - Run configuration validation
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources
- **Check Logs** - Review configuration logs

#### Application Issues
- **Check App Compatibility** - Verify app compatibility
- **Check App Dependencies** - Ensure app dependencies are met
- **Check App Configuration** - Verify app configuration
- **Check App Resources** - Verify app resources
- **Check App Logs** - Review app logs

### Error Messages

#### "Profile Not Found"
- **Cause**: Profile ID doesn't exist in system
- **Solution**: Verify profile ID and check profile list

#### "Device Incompatible"
- **Cause**: Device is not compatible with profile
- **Solution**: Check device compatibility or update profile

#### "Configuration Conflict"
- **Cause**: Profile configuration conflicts with device
- **Solution**: Resolve configuration conflicts

#### "Assignment Failed"
- **Cause**: Profile assignment failed
- **Solution**: Check device status and assignment logs

#### "Validation Error"
- **Cause**: Profile validation failed
- **Solution**: Fix validation errors and retry

## Best Practices

### Profile Design
- **Standardization** - Use consistent naming and structure
- **Documentation** - Document profile purpose and configuration
- **Version Control** - Maintain proper version numbering
- **Testing** - Test profiles thoroughly before deployment
- **Validation** - Validate profiles before assignment

### Configuration Management
- **Modular Design** - Create modular, reusable configurations
- **Inheritance** - Use profile inheritance for common settings
- **Override Management** - Manage configuration overrides carefully
- **Conflict Resolution** - Implement proper conflict resolution
- **Change Management** - Track and manage configuration changes

### Deployment Management
- **Staged Deployment** - Use staged deployment for large changes
- **Rollback Planning** - Plan for rollback scenarios
- **Monitoring** - Monitor profile deployment closely
- **Validation** - Validate deployment results
- **Documentation** - Document deployment procedures

### Security
- **Access Control** - Limit profile access to authorized users
- **Configuration Security** - Secure profile configurations
- **Audit Logging** - Log all profile operations
- **Validation** - Validate profile security settings
- **Regular Updates** - Keep profiles updated with security patches

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use profiles
- **[Bundle Management](./bundles.md)** - Deploy applications to profiles
- **[Device Tags](./device_tags.md)** - Organize devices for profile assignment
- **[PIN Rules](./pin_rules.md)** - Configure PIN rules in profiles
- **[Resources](./resources.md)** - Manage profile resources

## API Reference

### Profile Management API
- **GET /api/admin/iot/device-profiles** - List all profiles
- **POST /api/admin/iot/device-profiles** - Create new profile
- **GET /api/admin/iot/device-profiles/{id}** - Get profile details
- **PUT /api/admin/iot/device-profiles/{id}** - Update profile
- **DELETE /api/admin/iot/device-profiles/{id}** - Delete profile

### Profile Assignment API
- **POST /api/admin/iot/device-profiles/{id}/assign** - Assign profile to devices
- **GET /api/admin/iot/device-profiles/{id}/assignments** - Get assignment history
- **PUT /api/admin/iot/device-profiles/{id}/assignments/{deviceId}** - Update assignment
- **DELETE /api/admin/iot/device-profiles/{id}/assignments/{deviceId}** - Remove assignment

### Profile Configuration API
- **GET /api/admin/iot/device-profiles/{id}/config** - Get profile configuration
- **PUT /api/admin/iot/device-profiles/{id}/config** - Update profile configuration
- **POST /api/admin/iot/device-profiles/{id}/validate** - Validate profile
- **GET /api/admin/iot/device-profiles/{id}/validation** - Get validation results

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Profile Logs** - Review profile logs for errors
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of device profile management from creation to deployment and troubleshooting.
