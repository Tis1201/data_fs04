# Accounts User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Accounts are the primary organizational units in the IoT Management System. They represent customers, organizations, or entities that own and manage devices. Accounts provide isolation, access control, and resource management for device fleets.

## Prerequisites

- **Admin permissions** - Full account management access
- **Organization understanding** - Knowledge of organizational structure
- **Access control** - Understanding of role-based access control
- **Billing knowledge** - Understanding of account billing and licensing

## Getting Started

### Quick Start
1. **Navigate to Accounts** - Go to Admin → Access → Accounts
2. **Create New Account** - Click "Create Account" button
3. **Configure Account** - Set account name, type, and properties
4. **Set Permissions** - Configure account permissions and access
5. **Add Users** - Add users to the account
6. **Manage Devices** - Assign devices to the account

### Navigation
- **Menu Path**: Admin → Access → Accounts
- **URL**: `/admin/accounts/accounts`
- **Direct Access**: Click "Accounts" in the Access section

## Core Functionality

### Account List View

#### Account Information Display
- **Account Name** - Human-readable account name
- **Account ID** - Unique system identifier
- **Account Type** - Type of account (enterprise, standard, trial)
- **Status** - Active/Inactive/Suspended
- **Created Date** - When account was created
- **Last Modified** - Last update timestamp
- **User Count** - Number of users in account
- **Device Count** - Number of devices in account
- **Company** - Associated company

#### Account Status Indicators
- 🟢 **Active** - Account is active and operational
- 🔴 **Inactive** - Account is disabled
- 🟡 **Suspended** - Account is temporarily suspended
- ⚪ **Trial** - Account is in trial period

#### Filtering and Search
- **Search by Name** - Find accounts by name
- **Filter by Type** - Show accounts by type
- **Filter by Status** - Show only active/inactive accounts
- **Filter by Company** - Show accounts by company
- **Filter by Date** - Show accounts by creation date
- **Sort Options** - Sort by name, type, status, date, etc.

### Account Detail View

#### Account Information Tab
- **Basic Info** - Name, ID, description, type
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, status history
- **Company Info** - Associated company information

#### Account Configuration Tab
- **Account Settings** - Account-specific settings
- **Access Control** - Account access permissions
- **Resource Limits** - Account resource limits
- **Billing Settings** - Billing and licensing settings
- **Metadata** - Additional account metadata

#### Users Tab
- **User List** - Users in the account
- **User Roles** - User roles and permissions
- **User Management** - Add, remove, manage users
- **User Activity** - User activity and statistics

#### Devices Tab
- **Device List** - Devices in the account
- **Device Status** - Device status and health
- **Device Management** - Manage account devices
- **Device Analytics** - Device usage analytics

## Advanced Features

### Account Creation

#### Basic Account Setup
- **Account Name** - Choose descriptive name
- **Description** - Add detailed description
- **Account Type** - Select account type
- **Company** - Associate with company
- **Status** - Set initial account status

#### Account Configuration
- **Access Control** - Configure account access
- **Resource Limits** - Set resource limits
- **Billing Settings** - Configure billing
- **Notification Settings** - Set notification preferences
- **Security Settings** - Configure security settings

#### Account Permissions
- **User Permissions** - Set user permissions
- **Device Permissions** - Set device permissions
- **Resource Permissions** - Set resource permissions
- **API Permissions** - Set API access permissions
- **Admin Permissions** - Set admin permissions

### Account Management

#### User Management
- **Add Users** - Add users to account
- **Remove Users** - Remove users from account
- **User Roles** - Assign user roles
- **User Permissions** - Set user permissions
- **User Activity** - Monitor user activity

#### Device Management
- **Assign Devices** - Assign devices to account
- **Remove Devices** - Remove devices from account
- **Device Groups** - Organize devices in groups
- **Device Permissions** - Set device permissions
- **Device Monitoring** - Monitor device activity

#### Resource Management
- **Resource Allocation** - Allocate resources to account
- **Resource Limits** - Set resource limits
- **Resource Usage** - Monitor resource usage
- **Resource Billing** - Track resource billing
- **Resource Optimization** - Optimize resource usage

### Account Monitoring

#### Usage Analytics
- **User Activity** - Track user activity
- **Device Usage** - Monitor device usage
- **Resource Usage** - Track resource consumption
- **API Usage** - Monitor API usage
- **Performance Metrics** - Track performance metrics

#### Billing Management
- **Usage Tracking** - Track account usage
- **Billing Calculation** - Calculate billing charges
- **Invoice Generation** - Generate invoices
- **Payment Processing** - Process payments
- **Billing Reports** - Generate billing reports

## Account Creation Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Account Creation Timeout: 2 Minutes**
- **Per Account**: Each account creation has a **2-minute timeout**
- **Timeout Behavior**: If creation takes too long → **FAILED**
- **Retry Logic**: Failed creations are retried up to 2 times
- **Total Setup Timeout**: 5 minutes for complete account setup

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Account Created**: Account record created successfully
- **Permissions Set**: Account permissions configured
- **Users Added**: Users added to account
- **Devices Assigned**: Devices assigned to account
- **Account Active**: Account is active and operational

##### ❌ **Failure Cases**
- **Creation Timeout**: Account creation takes longer than 2 minutes
- **Permission Error**: Permission configuration fails
- **User Error**: User addition fails
- **Device Error**: Device assignment fails
- **Validation Error**: Account validation fails

### 📊 **Account Creation Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Creates │    │   Account Creation│    │  Account Record │
│     Account     │───▶│   Process        │───▶│   Created       │
│                 │    │  (2min timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Account Status │◀───│  Set Permissions │◀───│  Configure      │
│    ACTIVE       │    │  & Access Control│    │  Account        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Account Ready  │◀───│  Add Users &     │◀───│  Assign Devices │
│   for Use       │    │  Devices         │    │  to Account     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Account Creation Process**

#### **Step 1: Account Creation**
```
Admin Account Creation Request:
├── Start 2-minute Timer
├── Validate Account Data
├── Create Account Record
├── Set Account Status: CREATING
└── Initialize Account Settings
```

#### **Step 2: Account Configuration**
```
Account Record Created:
├── Configure Account Settings
├── Set Access Permissions
├── Configure Resource Limits
├── Set Billing Settings
└── Update Account Status: CONFIGURING
```

#### **Step 3: Account Activation**
```
Configuration Complete:
├── Add Default Users
├── Assign Default Devices
├── Set Account Status: ACTIVE
├── Send Welcome Notifications
└── Account Ready for Use
```

## Common Workflows

### Workflow 1: Create and Setup Account
1. **Create Account** - Set up new account with name and type
2. **Configure Settings** - Set account settings and permissions
3. **Add Users** - Add users to the account
4. **Assign Devices** - Assign devices to the account
5. **Set Limits** - Configure resource and usage limits
6. **Activate Account** - Activate account for use
7. **Verify Setup** - Confirm account is properly configured

### Workflow 2: Account User Management
1. **Select Account** - Choose account to manage
2. **View Users** - Review current users in account
3. **Add Users** - Add new users to account
4. **Set Roles** - Assign roles to users
5. **Configure Permissions** - Set user permissions
6. **Monitor Activity** - Track user activity
7. **Manage Access** - Update user access as needed

### Workflow 3: Account Device Management
1. **Select Account** - Choose account to manage
2. **View Devices** - Review devices in account
3. **Assign Devices** - Assign new devices to account
4. **Organize Devices** - Organize devices in groups
5. **Set Permissions** - Configure device permissions
6. **Monitor Usage** - Track device usage
7. **Manage Devices** - Update device assignments

### Workflow 4: Account Troubleshooting
1. **Identify Issue** - Determine account problem
2. **Check Account Status** - Verify account status
3. **Check Permissions** - Verify account permissions
4. **Check Users** - Verify user access
5. **Check Devices** - Verify device assignments
6. **Check Logs** - Review account logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Enterprise Account Creation**

### **Example Account: "Acme Corporation"**
- **Account Type**: Enterprise
- **Company**: Acme Corporation
- **Initial Users**: 5 users
- **Initial Devices**: 50 devices

### **Timeline & Expected Behavior**

#### **T+0:00 - Account Creation Start**
```
Admin Action: Create "Acme Corporation" Account
├── Account Type: Enterprise
├── Company: Acme Corporation
├── Start 2-minute Timer
└── Begin Account Creation Process
```

#### **T+0:05 - Account Record Created**
```
Server Action: Create Account Record
├── Account ID: "account_acme_001"
├── Account Status: CREATING
├── Company Association: Complete
└── Basic Settings: Configured
```

#### **T+0:10 - Account Configuration**
```
Server Action: Configure Account
├── Access Control: Configured
├── Resource Limits: Set
├── Billing Settings: Configured
├── Account Status: CONFIGURING
└── Permissions: Set
```

#### **T+0:15 - User Addition**
```
Server Action: Add Initial Users
├── User 1: admin@acme.com (Admin)
├── User 2: manager@acme.com (Manager)
├── User 3: user1@acme.com (User)
├── User 4: user2@acme.com (User)
├── User 5: user3@acme.com (User)
└── User Roles: Assigned
```

#### **T+0:20 - Device Assignment**
```
Server Action: Assign Initial Devices
├── Device Group 1: Office Devices (30 devices)
├── Device Group 2: Warehouse Devices (20 devices)
├── Device Permissions: Set
└── Device Status: Assigned
```

#### **T+0:25 - Account Activation**
```
Server Action: Activate Account
├── Account Status: ACTIVE
├── Welcome Notifications: Sent
├── Account Ready: True
└── Account Creation: Complete
```

### **Total Creation Time: 25 seconds**
- **Account Creation**: 5 seconds
- **Configuration**: 5 seconds
- **User Addition**: 5 seconds
- **Device Assignment**: 5 seconds
- **Activation**: 5 seconds
- **Within 2-minute timeout**

### **Failure Scenario Example**

#### **T+0:00 - Account Creation Start**
```
Admin Action: Create "Large Corp" Account
├── Account Type: Enterprise
├── Company: Large Corporation
├── Start 2-minute Timer
└── Begin Account Creation Process
```

#### **T+0:05 - Account Record Created**
```
Server Action: Create Account Record
├── Account ID: "account_large_001"
├── Account Status: CREATING
├── Company Association: Complete
└── Basic Settings: Configured
```

#### **T+0:10 - Configuration Start**
```
Server Action: Configure Account
├── Access Control: Configuring
├── Resource Limits: Setting
├── Billing Settings: Configuring
└── Account Status: CONFIGURING
```

#### **T+2:05 - Configuration Timeout**
```
Server Action: Configuration Timeout
├── No response after 2 minutes
├── Account Status: FAILED
├── Retry Attempt 1: Restart configuration
└── Start new 2-minute Timer
```

#### **T+4:10 - Final Timeout**
```
Server Action: Final Timeout
├── No response after 2 minutes (retry 1)
├── Account Status: FAILED
├── Account Creation: Failed
└── Manual intervention required
```

## Troubleshooting

### Common Issues

#### Account Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify account configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run account validation

#### User Management Issues
- **Check User Status** - Verify user accounts are active
- **Check User Permissions** - Verify user permissions
- **Check User Roles** - Verify user roles are correct
- **Check User Access** - Verify user access to account
- **Check Logs** - Review user management logs

#### Device Management Issues
- **Check Device Status** - Verify devices are available
- **Check Device Permissions** - Verify device permissions
- **Check Device Assignment** - Verify device assignments
- **Check Device Limits** - Verify device limits
- **Check Logs** - Review device management logs

#### Billing Issues
- **Check Billing Settings** - Verify billing configuration
- **Check Usage Limits** - Verify usage limits
- **Check Payment Status** - Verify payment status
- **Check Billing History** - Review billing history
- **Check Logs** - Review billing logs

### Error Messages

#### "Account Not Found"
- **Cause**: Account ID doesn't exist in system
- **Solution**: Verify account ID and check account list

#### "Account Creation Failed"
- **Cause**: Account creation process failed
- **Solution**: Check account configuration and retry

#### "User Addition Failed"
- **Cause**: User addition to account failed
- **Solution**: Check user status and permissions

#### "Device Assignment Failed"
- **Cause**: Device assignment to account failed
- **Solution**: Check device status and availability

#### "Account Creation Timeout"
- **Cause**: Account creation took too long
- **Solution**: Check server performance and retry

## Best Practices

### Account Design
- **Descriptive Names** - Use clear, descriptive account names
- **Proper Organization** - Organize accounts logically
- **Clear Structure** - Maintain clear account structure
- **Documentation** - Document account purpose and configuration
- **Regular Review** - Review accounts regularly

### User Management
- **Role-Based Access** - Use role-based access control
- **Least Privilege** - Apply least privilege principle
- **Regular Audits** - Audit user access regularly
- **User Training** - Train users on account usage
- **Access Monitoring** - Monitor user access patterns

### Device Management
- **Device Organization** - Organize devices logically
- **Device Grouping** - Group devices by function or location
- **Device Monitoring** - Monitor device status and usage
- **Device Security** - Secure device access
- **Device Maintenance** - Maintain device health

### Security
- **Access Control** - Control account access strictly
- **Audit Logging** - Log all account operations
- **Security Monitoring** - Monitor account security
- **Threat Detection** - Detect security threats
- **Incident Response** - Have incident response procedures

## Related Features

- **[Companies](./companies.md)** - Manage companies associated with accounts
- **[Users](./users.md)** - Manage users in accounts
- **[Device Management](./devices.md)** - Manage devices in accounts
- **[Bundle Management](./bundles.md)** - Deploy bundles to account devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to account devices

## API Reference

### Account Management API
- **GET /api/admin/accounts** - List all accounts
- **POST /api/admin/accounts** - Create new account
- **GET /api/admin/accounts/{id}** - Get account details
- **PUT /api/admin/accounts/{id}** - Update account
- **DELETE /api/admin/accounts/{id}** - Delete account

### Account User API
- **GET /api/admin/accounts/{id}/users** - Get account users
- **POST /api/admin/accounts/{id}/users** - Add user to account
- **PUT /api/admin/accounts/{id}/users/{userId}** - Update user in account
- **DELETE /api/admin/accounts/{id}/users/{userId}** - Remove user from account

### Account Device API
- **GET /api/admin/accounts/{id}/devices** - Get account devices
- **POST /api/admin/accounts/{id}/devices** - Assign device to account
- **PUT /api/admin/accounts/{id}/devices/{deviceId}** - Update device in account
- **DELETE /api/admin/accounts/{id}/devices/{deviceId}** - Remove device from account

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Account Logs** - Review account operation logs
- **User Logs** - Check user-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of account management from creation to user and device management and troubleshooting.
