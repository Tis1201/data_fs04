# Companies User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Companies represent the highest level of organization in the IoT Management System. They group multiple accounts and provide enterprise-level management, billing, and administrative control. Companies are typically used for large organizations with multiple departments or subsidiaries.

## Prerequisites

- **Admin permissions** - Full company management access
- **Enterprise understanding** - Knowledge of enterprise organizational structure
- **Billing knowledge** - Understanding of enterprise billing and licensing
- **Multi-tenant awareness** - Understanding of multi-tenant architecture

## Getting Started

### Quick Start
1. **Navigate to Companies** - Go to Admin → Access → Companies
2. **Create New Company** - Click "Create Company" button
3. **Configure Company** - Set company name, details, and properties
4. **Set Enterprise Settings** - Configure enterprise-level settings
5. **Add Accounts** - Add accounts to the company
6. **Manage Billing** - Set up company billing and licensing

### Navigation
- **Menu Path**: Admin → Access → Companies
- **URL**: `/admin/accounts/companies`
- **Direct Access**: Click "Companies" in the Access section

## Core Functionality

### Company List View

#### Company Information Display
- **Company Name** - Human-readable company name
- **Company ID** - Unique system identifier
- **Company Type** - Type of company (enterprise, partner, reseller)
- **Status** - Active/Inactive/Suspended
- **Created Date** - When company was created
- **Last Modified** - Last update timestamp
- **Account Count** - Number of accounts in company
- **User Count** - Total number of users across all accounts
- **Device Count** - Total number of devices across all accounts

#### Company Status Indicators
- 🟢 **Active** - Company is active and operational
- 🔴 **Inactive** - Company is disabled
- 🟡 **Suspended** - Company is temporarily suspended
- ⚪ **Trial** - Company is in trial period

#### Filtering and Search
- **Search by Name** - Find companies by name
- **Filter by Type** - Show companies by type
- **Filter by Status** - Show only active/inactive companies
- **Filter by Date** - Show companies by creation date
- **Filter by Size** - Show companies by account count
- **Sort Options** - Sort by name, type, status, date, size, etc.

### Company Detail View

#### Company Information Tab
- **Basic Info** - Name, ID, description, type
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, status history
- **Contact Info** - Company contact information

#### Company Configuration Tab
- **Company Settings** - Company-specific settings
- **Enterprise Settings** - Enterprise-level configuration
- **Billing Settings** - Billing and licensing settings
- **Security Settings** - Company security settings
- **Metadata** - Additional company metadata

#### Accounts Tab
- **Account List** - Accounts in the company
- **Account Status** - Account status and health
- **Account Management** - Manage company accounts
- **Account Analytics** - Account usage analytics

#### Billing Tab
- **Billing Overview** - Company billing overview
- **Usage Statistics** - Usage across all accounts
- **Invoice Management** - Invoice generation and management
- **Payment History** - Payment history and status

## Advanced Features

### Company Creation

#### Basic Company Setup
- **Company Name** - Choose descriptive name
- **Description** - Add detailed description
- **Company Type** - Select company type
- **Contact Information** - Set company contact details
- **Status** - Set initial company status

#### Company Configuration
- **Enterprise Settings** - Configure enterprise features
- **Billing Settings** - Configure billing and licensing
- **Security Settings** - Configure company security
- **Notification Settings** - Set notification preferences
- **Integration Settings** - Configure external integrations

#### Company Permissions
- **Account Permissions** - Set account management permissions
- **User Permissions** - Set user management permissions
- **Device Permissions** - Set device management permissions
- **Billing Permissions** - Set billing management permissions
- **Admin Permissions** - Set admin permissions

### Company Management

#### Account Management
- **Add Accounts** - Add accounts to company
- **Remove Accounts** - Remove accounts from company
- **Account Roles** - Assign account roles
- **Account Permissions** - Set account permissions
- **Account Monitoring** - Monitor account activity

#### User Management
- **User Overview** - Overview of all users in company
- **User Roles** - Manage user roles across accounts
- **User Permissions** - Set user permissions
- **User Activity** - Monitor user activity
- **User Security** - Manage user security

#### Device Management
- **Device Overview** - Overview of all devices in company
- **Device Groups** - Organize devices across accounts
- **Device Permissions** - Set device permissions
- **Device Monitoring** - Monitor device activity
- **Device Security** - Manage device security

### Company Monitoring

#### Usage Analytics
- **Account Activity** - Track account activity
- **User Activity** - Monitor user activity across accounts
- **Device Usage** - Monitor device usage across accounts
- **Resource Usage** - Track resource consumption
- **Performance Metrics** - Track performance metrics

#### Billing Management
- **Usage Tracking** - Track company-wide usage
- **Billing Calculation** - Calculate billing charges
- **Invoice Generation** - Generate company invoices
- **Payment Processing** - Process payments
- **Billing Reports** - Generate billing reports

## Company Creation Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Company Creation Timeout: 3 Minutes**
- **Per Company**: Each company creation has a **3-minute timeout**
- **Timeout Behavior**: If creation takes too long → **FAILED**
- **Retry Logic**: Failed creations are retried up to 2 times
- **Total Setup Timeout**: 10 minutes for complete company setup

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Company Created**: Company record created successfully
- **Settings Configured**: Company settings configured
- **Accounts Added**: Accounts added to company
- **Billing Setup**: Billing configuration complete
- **Company Active**: Company is active and operational

##### ❌ **Failure Cases**
- **Creation Timeout**: Company creation takes longer than 3 minutes
- **Configuration Error**: Company configuration fails
- **Account Error**: Account addition fails
- **Billing Error**: Billing setup fails
- **Validation Error**: Company validation fails

### 📊 **Company Creation Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Creates │    │   Company Creation│    │  Company Record │
│     Company     │───▶│   Process        │───▶│   Created       │
│                 │    │  (3min timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Company Status │◀───│  Configure       │◀───│  Set Enterprise │
│    ACTIVE       │    │  Company Settings│    │  Settings       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Company Ready  │◀───│  Setup Billing   │◀───│  Add Accounts   │
│   for Use       │    │  & Licensing     │    │  to Company     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Company Creation Process**

#### **Step 1: Company Creation**
```
Admin Company Creation Request:
├── Start 3-minute Timer
├── Validate Company Data
├── Create Company Record
├── Set Company Status: CREATING
└── Initialize Company Settings
```

#### **Step 2: Company Configuration**
```
Company Record Created:
├── Configure Company Settings
├── Set Enterprise Settings
├── Configure Billing Settings
├── Set Security Settings
└── Update Company Status: CONFIGURING
```

#### **Step 3: Company Activation**
```
Configuration Complete:
├── Add Default Accounts
├── Setup Billing System
├── Set Company Status: ACTIVE
├── Send Welcome Notifications
└── Company Ready for Use
```

## Common Workflows

### Workflow 1: Create and Setup Company
1. **Create Company** - Set up new company with name and type
2. **Configure Settings** - Set company settings and enterprise features
3. **Add Accounts** - Add accounts to the company
4. **Setup Billing** - Configure billing and licensing
5. **Set Permissions** - Configure company permissions
6. **Activate Company** - Activate company for use
7. **Verify Setup** - Confirm company is properly configured

### Workflow 2: Company Account Management
1. **Select Company** - Choose company to manage
2. **View Accounts** - Review accounts in company
3. **Add Accounts** - Add new accounts to company
4. **Set Account Roles** - Assign roles to accounts
5. **Configure Permissions** - Set account permissions
6. **Monitor Activity** - Track account activity
7. **Manage Accounts** - Update account settings as needed

### Workflow 3: Company Billing Management
1. **Select Company** - Choose company to manage
2. **View Billing** - Review company billing overview
3. **Monitor Usage** - Track usage across all accounts
4. **Generate Invoices** - Generate company invoices
5. **Process Payments** - Process payments
6. **Review Reports** - Review billing reports
7. **Manage Billing** - Update billing settings

### Workflow 4: Company Troubleshooting
1. **Identify Issue** - Determine company problem
2. **Check Company Status** - Verify company status
3. **Check Accounts** - Verify account status
4. **Check Billing** - Verify billing configuration
5. **Check Permissions** - Verify company permissions
6. **Check Logs** - Review company logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Enterprise Company Creation**

### **Example Company: "Global Manufacturing Corp"**
- **Company Type**: Enterprise
- **Initial Accounts**: 3 accounts (HQ, Factory A, Factory B)
- **Initial Users**: 25 users across all accounts
- **Initial Devices**: 200 devices across all accounts

### **Timeline & Expected Behavior**

#### **T+0:00 - Company Creation Start**
```
Admin Action: Create "Global Manufacturing Corp" Company
├── Company Type: Enterprise
├── Contact: contact@globalmfg.com
├── Start 3-minute Timer
└── Begin Company Creation Process
```

#### **T+0:10 - Company Record Created**
```
Server Action: Create Company Record
├── Company ID: "company_global_001"
├── Company Status: CREATING
├── Contact Information: Set
└── Basic Settings: Configured
```

#### **T+0:20 - Company Configuration**
```
Server Action: Configure Company
├── Enterprise Settings: Configured
├── Billing Settings: Set
├── Security Settings: Configured
├── Company Status: CONFIGURING
└── Permissions: Set
```

#### **T+0:30 - Account Addition**
```
Server Action: Add Initial Accounts
├── Account 1: "HQ Account" (10 users, 50 devices)
├── Account 2: "Factory A Account" (8 users, 75 devices)
├── Account 3: "Factory B Account" (7 users, 75 devices)
└── Account Roles: Assigned
```

#### **T+0:40 - Billing Setup**
```
Server Action: Setup Billing
├── Billing System: Configured
├── Usage Tracking: Enabled
├── Invoice Generation: Set
└── Payment Processing: Configured
```

#### **T+0:50 - Company Activation**
```
Server Action: Activate Company
├── Company Status: ACTIVE
├── Welcome Notifications: Sent
├── Company Ready: True
└── Company Creation: Complete
```

### **Total Creation Time: 50 seconds**
- **Company Creation**: 10 seconds
- **Configuration**: 10 seconds
- **Account Addition**: 10 seconds
- **Billing Setup**: 10 seconds
- **Activation**: 10 seconds
- **Within 3-minute timeout**

### **Failure Scenario Example**

#### **T+0:00 - Company Creation Start**
```
Admin Action: Create "Large Enterprise" Company
├── Company Type: Enterprise
├── Contact: contact@largeent.com
├── Start 3-minute Timer
└── Begin Company Creation Process
```

#### **T+0:10 - Company Record Created**
```
Server Action: Create Company Record
├── Company ID: "company_large_001"
├── Company Status: CREATING
├── Contact Information: Set
└── Basic Settings: Configured
```

#### **T+0:20 - Configuration Start**
```
Server Action: Configure Company
├── Enterprise Settings: Configuring
├── Billing Settings: Setting
├── Security Settings: Configuring
└── Company Status: CONFIGURING
```

#### **T+3:05 - Configuration Timeout**
```
Server Action: Configuration Timeout
├── No response after 3 minutes
├── Company Status: FAILED
├── Retry Attempt 1: Restart configuration
└── Start new 3-minute Timer
```

#### **T+6:10 - Final Timeout**
```
Server Action: Final Timeout
├── No response after 3 minutes (retry 1)
├── Company Status: FAILED
├── Company Creation: Failed
└── Manual intervention required
```

## Troubleshooting

### Common Issues

#### Company Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify company configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run company validation

#### Account Management Issues
- **Check Account Status** - Verify accounts are active
- **Check Account Permissions** - Verify account permissions
- **Check Account Roles** - Verify account roles are correct
- **Check Account Access** - Verify account access to company
- **Check Logs** - Review account management logs

#### Billing Management Issues
- **Check Billing Settings** - Verify billing configuration
- **Check Usage Limits** - Verify usage limits
- **Check Payment Status** - Verify payment status
- **Check Billing History** - Review billing history
- **Check Logs** - Review billing logs

#### Performance Issues
- **Check Company Size** - Monitor company size and complexity
- **Check Account Count** - Monitor number of accounts
- **Check User Count** - Monitor number of users
- **Check Device Count** - Monitor number of devices
- **Check Logs** - Review performance logs

### Error Messages

#### "Company Not Found"
- **Cause**: Company ID doesn't exist in system
- **Solution**: Verify company ID and check company list

#### "Company Creation Failed"
- **Cause**: Company creation process failed
- **Solution**: Check company configuration and retry

#### "Account Addition Failed"
- **Cause**: Account addition to company failed
- **Solution**: Check account status and permissions

#### "Billing Setup Failed"
- **Cause**: Billing setup failed
- **Solution**: Check billing configuration and retry

#### "Company Creation Timeout"
- **Cause**: Company creation took too long
- **Solution**: Check server performance and retry

## Best Practices

### Company Design
- **Descriptive Names** - Use clear, descriptive company names
- **Proper Organization** - Organize companies logically
- **Clear Structure** - Maintain clear company structure
- **Documentation** - Document company purpose and configuration
- **Regular Review** - Review companies regularly

### Account Management
- **Logical Grouping** - Group accounts logically
- **Account Roles** - Use role-based account management
- **Account Monitoring** - Monitor account activity
- **Account Security** - Secure account access
- **Account Maintenance** - Maintain account health

### Billing Management
- **Usage Tracking** - Track usage across all accounts
- **Billing Accuracy** - Ensure billing accuracy
- **Invoice Management** - Manage invoices efficiently
- **Payment Processing** - Process payments promptly
- **Billing Reports** - Generate regular billing reports

### Security
- **Access Control** - Control company access strictly
- **Audit Logging** - Log all company operations
- **Security Monitoring** - Monitor company security
- **Threat Detection** - Detect security threats
- **Incident Response** - Have incident response procedures

## Related Features

- **[Accounts](./accounts.md)** - Manage accounts in companies
- **[Users](./users.md)** - Manage users across company accounts
- **[Device Management](./devices.md)** - Manage devices across company accounts
- **[Bundle Management](./bundles.md)** - Deploy bundles to company devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to company devices

## API Reference

### Company Management API
- **GET /api/admin/companies** - List all companies
- **POST /api/admin/companies** - Create new company
- **GET /api/admin/companies/{id}** - Get company details
- **PUT /api/admin/companies/{id}** - Update company
- **DELETE /api/admin/companies/{id}** - Delete company

### Company Account API
- **GET /api/admin/companies/{id}/accounts** - Get company accounts
- **POST /api/admin/companies/{id}/accounts** - Add account to company
- **PUT /api/admin/companies/{id}/accounts/{accountId}** - Update account in company
- **DELETE /api/admin/companies/{id}/accounts/{accountId}** - Remove account from company

### Company Billing API
- **GET /api/admin/companies/{id}/billing** - Get company billing
- **POST /api/admin/companies/{id}/billing/invoices** - Generate company invoice
- **GET /api/admin/companies/{id}/billing/usage** - Get company usage
- **GET /api/admin/companies/{id}/billing/reports** - Get billing reports

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Company Logs** - Review company operation logs
- **Account Logs** - Check account-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of company management from creation to account and billing management and troubleshooting.
