# Users User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Users are the individuals who access and use the IoT Management System. They can be administrators, managers, or end users with different levels of access and permissions. User management includes creating, configuring, and managing user accounts, roles, and permissions across the system.

## Prerequisites

- **Admin permissions** - Full user management access
- **Role understanding** - Knowledge of role-based access control
- **Security awareness** - Understanding of user security and authentication
- **Account knowledge** - Understanding of account and company structure

## Getting Started

### Quick Start
1. **Navigate to Users** - Go to Admin → Access → Users
2. **Create New User** - Click "Create User" button
3. **Configure User** - Set user name, email, and basic information
4. **Assign Roles** - Assign roles and permissions to user
5. **Add to Accounts** - Add user to appropriate accounts
6. **Set Security** - Configure user security settings

### Navigation
- **Menu Path**: Admin → Access → Users
- **URL**: `/admin/users`
- **Direct Access**: Click "Users" in the Access section

## Core Functionality

### User List View

#### User Information Display
- **User Name** - User's full name
- **Email** - User's email address
- **User ID** - Unique system identifier
- **Status** - Active/Inactive/Suspended
- **Role** - Primary user role
- **Created Date** - When user was created
- **Last Login** - Last login timestamp
- **Account Count** - Number of accounts user has access to
- **Company** - Associated company

#### User Status Indicators
- 🟢 **Active** - User is active and can log in
- 🔴 **Inactive** - User is disabled
- 🟡 **Suspended** - User is temporarily suspended
- ⚪ **Pending** - User account is pending activation

#### Filtering and Search
- **Search by Name** - Find users by name
- **Search by Email** - Find users by email
- **Filter by Role** - Show users by role
- **Filter by Status** - Show only active/inactive users
- **Filter by Account** - Show users by account
- **Filter by Company** - Show users by company
- **Sort Options** - Sort by name, email, role, status, date, etc.

### User Detail View

#### User Information Tab
- **Basic Info** - Name, email, ID, status
- **Creation Info** - Created by, created date, last modified
- **Login Info** - Last login, login count, login history
- **Contact Info** - Contact information and preferences

#### User Configuration Tab
- **User Settings** - User-specific settings
- **Role Settings** - Role and permission settings
- **Account Settings** - Account access settings
- **Security Settings** - Security and authentication settings
- **Metadata** - Additional user metadata

#### Accounts Tab
- **Account List** - Accounts user has access to
- **Account Roles** - Roles in each account
- **Account Permissions** - Permissions in each account
- **Account Activity** - Activity in each account

#### Activity Tab
- **Login History** - User login history
- **Action History** - User action history
- **Activity Statistics** - User activity statistics
- **Activity Reports** - User activity reports

## Advanced Features

### User Creation

#### Basic User Setup
- **User Name** - Set user's full name
- **Email Address** - Set user's email address
- **Password** - Set initial password
- **User Type** - Select user type
- **Status** - Set initial user status

#### User Configuration
- **Role Assignment** - Assign roles to user
- **Account Assignment** - Add user to accounts
- **Permission Settings** - Set user permissions
- **Security Settings** - Configure security settings
- **Notification Settings** - Set notification preferences

#### User Permissions
- **Account Permissions** - Set account access permissions
- **Device Permissions** - Set device management permissions
- **Resource Permissions** - Set resource access permissions
- **API Permissions** - Set API access permissions
- **Admin Permissions** - Set admin permissions

### User Management

#### Role Management
- **Role Assignment** - Assign roles to users
- **Role Updates** - Update user roles
- **Role Removal** - Remove roles from users
- **Role Validation** - Validate role assignments
- **Role Monitoring** - Monitor role usage

#### Account Management
- **Account Assignment** - Add users to accounts
- **Account Removal** - Remove users from accounts
- **Account Roles** - Set roles in accounts
- **Account Permissions** - Set permissions in accounts
- **Account Monitoring** - Monitor account access

#### Security Management
- **Password Management** - Manage user passwords
- **Authentication Settings** - Configure authentication
- **Security Monitoring** - Monitor user security
- **Threat Detection** - Detect security threats
- **Incident Response** - Respond to security incidents

### User Monitoring

#### Activity Monitoring
- **Login Monitoring** - Monitor user logins
- **Action Monitoring** - Monitor user actions
- **Usage Monitoring** - Monitor user usage
- **Performance Monitoring** - Monitor user performance
- **Error Monitoring** - Monitor user errors

#### Security Monitoring
- **Authentication Monitoring** - Monitor authentication
- **Access Monitoring** - Monitor user access
- **Permission Monitoring** - Monitor permission usage
- **Threat Monitoring** - Monitor security threats
- **Incident Monitoring** - Monitor security incidents

## User Creation Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **User Creation Timeout: 1 Minute**
- **Per User**: Each user creation has a **1-minute timeout**
- **Timeout Behavior**: If creation takes too long → **FAILED**
- **Retry Logic**: Failed creations are retried up to 2 times
- **Total Setup Timeout**: 3 minutes for complete user setup

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **User Created**: User record created successfully
- **Email Sent**: Welcome email sent to user
- **Roles Assigned**: Roles assigned to user
- **Accounts Added**: User added to accounts
- **User Active**: User is active and can log in

##### ❌ **Failure Cases**
- **Creation Timeout**: User creation takes longer than 1 minute
- **Email Error**: Welcome email sending fails
- **Role Error**: Role assignment fails
- **Account Error**: Account addition fails
- **Validation Error**: User validation fails

### 📊 **User Creation Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Creates │    │   User Creation  │    │  User Record    │
│      User       │───▶│   Process        │───▶│   Created       │
│                 │    │  (1min timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Status    │◀───│  Send Welcome    │◀───│  Assign Roles   │
│    ACTIVE       │    │     Email        │    │  & Permissions  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  User Ready     │◀───│  Add to Accounts │◀───│  Set Security   │
│   for Login     │    │  & Set Access    │    │  Settings       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed User Creation Process**

#### **Step 1: User Creation**
```
Admin User Creation Request:
├── Start 1-minute Timer
├── Validate User Data
├── Create User Record
├── Set User Status: CREATING
└── Initialize User Settings
```

#### **Step 2: User Configuration**
```
User Record Created:
├── Assign Roles
├── Set Permissions
├── Configure Security
├── Set Notification Preferences
└── Update User Status: CONFIGURING
```

#### **Step 3: User Activation**
```
Configuration Complete:
├── Add to Accounts
├── Send Welcome Email
├── Set User Status: ACTIVE
├── Enable Login Access
└── User Ready for Use
```

## Common Workflows

### Workflow 1: Create and Setup User
1. **Create User** - Set up new user with name and email
2. **Assign Roles** - Assign roles and permissions to user
3. **Add to Accounts** - Add user to appropriate accounts
4. **Set Security** - Configure user security settings
5. **Send Welcome** - Send welcome email to user
6. **Activate User** - Activate user for login
7. **Verify Setup** - Confirm user is properly configured

### Workflow 2: User Role Management
1. **Select User** - Choose user to manage
2. **View Current Roles** - Review current user roles
3. **Update Roles** - Add, remove, or modify roles
4. **Set Permissions** - Configure role permissions
5. **Validate Changes** - Validate role changes
6. **Apply Changes** - Apply role changes
7. **Monitor Access** - Monitor user access

### Workflow 3: User Account Management
1. **Select User** - Choose user to manage
2. **View Accounts** - Review user's account access
3. **Add Accounts** - Add user to new accounts
4. **Remove Accounts** - Remove user from accounts
5. **Set Account Roles** - Set roles in each account
6. **Configure Permissions** - Set permissions in accounts
7. **Monitor Activity** - Monitor user activity

### Workflow 4: User Troubleshooting
1. **Identify Issue** - Determine user problem
2. **Check User Status** - Verify user status
3. **Check Roles** - Verify user roles
4. **Check Accounts** - Verify account access
5. **Check Permissions** - Verify user permissions
6. **Check Logs** - Review user logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Manager User Creation**

### **Example User: "John Smith - Office Manager"**
- **User Type**: Manager
- **Primary Role**: Manager
- **Accounts**: Office Account, Warehouse Account
- **Permissions**: Device management, user management

### **Timeline & Expected Behavior**

#### **T+0:00 - User Creation Start**
```
Admin Action: Create "John Smith" User
├── Name: "John Smith"
├── Email: "john.smith@company.com"
├── Start 1-minute Timer
└── Begin User Creation Process
```

#### **T+0:05 - User Record Created**
```
Server Action: Create User Record
├── User ID: "user_john_smith_001"
├── User Status: CREATING
├── Email: "john.smith@company.com"
└── Basic Settings: Configured
```

#### **T+0:10 - Role Assignment**
```
Server Action: Assign Roles
├── Primary Role: Manager
├── Secondary Role: Device Manager
├── Permissions: Set
└── User Status: CONFIGURING
```

#### **T+0:15 - Account Assignment**
```
Server Action: Add to Accounts
├── Account 1: "Office Account" (Manager role)
├── Account 2: "Warehouse Account" (Manager role)
├── Account Permissions: Set
└── Account Access: Configured
```

#### **T+0:20 - Security Configuration**
```
Server Action: Configure Security
├── Password: Set
├── Authentication: Configured
├── Security Settings: Set
└── User Status: CONFIGURING
```

#### **T+0:25 - Welcome Email**
```
Server Action: Send Welcome Email
├── Email Sent: "john.smith@company.com"
├── Welcome Message: Sent
├── Login Instructions: Included
└── Email Status: SENT
```

#### **T+0:30 - User Activation**
```
Server Action: Activate User
├── User Status: ACTIVE
├── Login Access: Enabled
├── User Ready: True
└── User Creation: Complete
```

### **Total Creation Time: 30 seconds**
- **User Creation**: 5 seconds
- **Role Assignment**: 5 seconds
- **Account Assignment**: 5 seconds
- **Security Configuration**: 5 seconds
- **Welcome Email**: 5 seconds
- **Activation**: 5 seconds
- **Within 1-minute timeout**

### **Failure Scenario Example**

#### **T+0:00 - User Creation Start**
```
Admin Action: Create "Jane Doe" User
├── Name: "Jane Doe"
├── Email: "jane.doe@company.com"
├── Start 1-minute Timer
└── Begin User Creation Process
```

#### **T+0:05 - User Record Created**
```
Server Action: Create User Record
├── User ID: "user_jane_doe_001"
├── User Status: CREATING
├── Email: "jane.doe@company.com"
└── Basic Settings: Configured
```

#### **T+0:10 - Role Assignment**
```
Server Action: Assign Roles
├── Primary Role: Manager
├── Secondary Role: Device Manager
├── Permissions: Setting
└── User Status: CONFIGURING
```

#### **T+1:05 - Role Assignment Timeout**
```
Server Action: Role Assignment Timeout
├── No response after 1 minute
├── User Status: FAILED
├── Retry Attempt 1: Restart role assignment
└── Start new 1-minute Timer
```

#### **T+2:10 - Final Timeout**
```
Server Action: Final Timeout
├── No response after 1 minute (retry 1)
├── User Status: FAILED
├── User Creation: Failed
└── Manual intervention required
```

## Troubleshooting

### Common Issues

#### User Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify user configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run user validation

#### Role Management Issues
- **Check Role Status** - Verify roles are active
- **Check Role Permissions** - Verify role permissions
- **Check Role Assignment** - Verify role assignments
- **Check Role Conflicts** - Check for role conflicts
- **Check Logs** - Review role management logs

#### Account Management Issues
- **Check Account Status** - Verify accounts are active
- **Check Account Permissions** - Verify account permissions
- **Check Account Access** - Verify account access
- **Check Account Limits** - Verify account limits
- **Check Logs** - Review account management logs

#### Security Issues
- **Check Password Policy** - Verify password policy
- **Check Authentication** - Verify authentication settings
- **Check Security Settings** - Verify security configuration
- **Check Access Control** - Verify access control
- **Check Logs** - Review security logs

### Error Messages

#### "User Not Found"
- **Cause**: User ID doesn't exist in system
- **Solution**: Verify user ID and check user list

#### "User Creation Failed"
- **Cause**: User creation process failed
- **Solution**: Check user configuration and retry

#### "Role Assignment Failed"
- **Cause**: Role assignment failed
- **Solution**: Check role status and permissions

#### "Account Addition Failed"
- **Cause**: Account addition failed
- **Solution**: Check account status and permissions

#### "User Creation Timeout"
- **Cause**: User creation took too long
- **Solution**: Check server performance and retry

## Best Practices

### User Design
- **Descriptive Names** - Use clear, descriptive user names
- **Proper Organization** - Organize users logically
- **Clear Structure** - Maintain clear user structure
- **Documentation** - Document user purpose and configuration
- **Regular Review** - Review users regularly

### Role Management
- **Role-Based Access** - Use role-based access control
- **Least Privilege** - Apply least privilege principle
- **Regular Audits** - Audit user roles regularly
- **Role Validation** - Validate role assignments
- **Role Monitoring** - Monitor role usage

### Account Management
- **Account Organization** - Organize accounts logically
- **Account Access** - Control account access strictly
- **Account Monitoring** - Monitor account access
- **Account Security** - Secure account access
- **Account Maintenance** - Maintain account health

### Security
- **Access Control** - Control user access strictly
- **Audit Logging** - Log all user operations
- **Security Monitoring** - Monitor user security
- **Threat Detection** - Detect security threats
- **Incident Response** - Have incident response procedures

## Related Features

- **[Accounts](./accounts.md)** - Manage accounts for users
- **[Companies](./companies.md)** - Manage companies for users
- **[Device Management](./devices.md)** - Manage devices for users
- **[Bundle Management](./bundles.md)** - Deploy bundles for users
- **[Device Profiles](./device_profiles.md)** - Apply profiles for users

## API Reference

### User Management API
- **GET /api/admin/users** - List all users
- **POST /api/admin/users** - Create new user
- **GET /api/admin/users/{id}** - Get user details
- **PUT /api/admin/users/{id}** - Update user
- **DELETE /api/admin/users/{id}** - Delete user

### User Role API
- **GET /api/admin/users/{id}/roles** - Get user roles
- **POST /api/admin/users/{id}/roles** - Assign role to user
- **PUT /api/admin/users/{id}/roles/{roleId}** - Update user role
- **DELETE /api/admin/users/{id}/roles/{roleId}** - Remove role from user

### User Account API
- **GET /api/admin/users/{id}/accounts** - Get user accounts
- **POST /api/admin/users/{id}/accounts** - Add user to account
- **PUT /api/admin/users/{id}/accounts/{accountId}** - Update user in account
- **DELETE /api/admin/users/{id}/accounts/{accountId}** - Remove user from account

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **User Logs** - Review user operation logs
- **Role Logs** - Check role-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of user management from creation to role and account management and troubleshooting.
