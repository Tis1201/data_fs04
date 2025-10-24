# Accounts User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Accounts are the primary organizational units in the IoT Management System. They represent customers, organizations, or entities that own and manage devices. Accounts provide isolation, access control, and resource management for device fleets.

## Prerequisites

- **Admin permissions** - Full account management access
- **Organization understanding** - Knowledge of organizational structure
- **Access control** - Understanding of role-based access control

## Getting Started

### Quick Start
1. **Navigate to Accounts** - Go to Admin → Accounts → Accounts
2. **Create New Account** - Click "Add Account" button
3. **Configure Account** - Set account name, slug, and properties
4. **Set Status** - Configure account status (Active/Inactive)
5. **Add Companies** - Associate companies with the account
6. **Add Members** - Add users as account members

### Navigation
- **Menu Path**: Admin → Accounts → Accounts
- **URL**: `/admin/accounts/accounts`
- **Direct Access**: Click "Accounts" in the Accounts section

## Core Functionality

### Account List View

#### Account Information Display
- **Account Name** - Human-readable account name with clickable link
- **Account ID** - Unique system identifier (displayed with name)
- **Slug** - URL-friendly identifier
- **Status** - Active/Inactive with color-coded badges
- **Companies Count** - Number of companies associated with account
- **Members Count** - Number of users in account
- **Devices Count** - Number of devices in account
- **Created Date** - When account was created (relative format)

#### Account Status Indicators
- 🟢 **Active** - Account is active and operational
- 🔴 **Inactive** - Account is disabled

#### Filtering and Search
- **Search by Name, ID, or Slug** - Find accounts by multiple criteria
- **Filter by Status** - Show only active/inactive accounts
- **Sort Options** - Sort by name, slug, status, created date
- **Pagination** - Navigate through multiple pages of accounts

### Account Detail View

#### Account Information Section
- **Basic Info** - Name, slug, description, status
- **Auto-generated Slug** - Automatically generated from account name
- **Status Management** - Toggle between Active/Inactive
- **Form Validation** - Real-time validation with error messages
- **Unsaved Changes Warning** - Visual indicator for unsaved changes

#### Relationship Management Sections

##### Companies Section
- **Associated Companies** - Companies linked to this account
- **Add Companies** - Add existing companies to account
- **Create New Company** - Create and immediately add new company
- **Remove Companies** - Remove companies from account (with confirmation)
- **Company Management** - Full CRUD operations for companies

##### Members Section
- **Account Members** - Users who are members of this account
- **Add Members** - Add existing users as account members
- **Remove Members** - Remove users from account
- **Member Management** - Manage user access to account

##### Groups Section
- **Account Groups** - Groups within this account
- **Add Groups** - Add existing groups to account
- **Remove Groups** - Remove groups from account
- **Group Management** - Manage group access and permissions

## Advanced Features

### Account Creation

#### Basic Account Setup
- **Account Name** - Choose descriptive name (required)
- **Slug** - Auto-generated from name, URL-friendly identifier
- **Description** - Add detailed description (optional)
- **Status** - Set initial account status (Active/Inactive)

#### Account Configuration
- **Form Validation** - Real-time validation with error messages
- **Auto-save Prevention** - Prevents accidental data loss
- **Navigation Guard** - Warns before leaving with unsaved changes
- **Status Management** - Easy toggle between Active/Inactive states

#### Account Actions
- **Edit Account** - Modify account details
- **Activate/Deactivate** - Toggle account status
- **Delete Account** - Remove account (with confirmation)
- **Manage Relationships** - Add/remove companies, members, groups

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

## Account Management Features

### Account Actions

#### Quick Actions
- **Edit Account** - Click account name or edit button
- **Toggle Status** - Activate/deactivate account
- **Delete Account** - Remove account with confirmation
- **View Details** - Access full account management

#### Bulk Operations
- **Status Filtering** - Filter by Active/Inactive status
- **Search** - Find accounts by name, ID, or slug
- **Sorting** - Sort by name, slug, status, or creation date
- **Pagination** - Navigate through large account lists

## Common Workflows

### Workflow 1: Create New Account
1. **Navigate to Accounts** - Go to Admin → Accounts → Accounts
2. **Click "Add Account"** - Start account creation process
3. **Enter Account Details** - Fill in name, description, status
4. **Auto-generate Slug** - System creates URL-friendly identifier
5. **Save Account** - Create the account record
6. **Add Companies** - Associate companies with account
7. **Add Members** - Add users as account members

### Workflow 2: Edit Existing Account
1. **Find Account** - Use search or filters to locate account
2. **Click Account Name** - Open account detail view
3. **Edit Information** - Modify name, description, or status
4. **Save Changes** - Confirm changes with save button
5. **Manage Relationships** - Add/remove companies, members, groups

### Workflow 3: Account Status Management
1. **Select Account** - Choose account from list
2. **Toggle Status** - Click activate/deactivate action
3. **Confirm Action** - Confirm status change in dialog
4. **Verify Change** - Check status badge reflects change
5. **Update Relationships** - Adjust company/member access as needed

### Workflow 4: Account Relationship Management
1. **Open Account** - Click account name to view details
2. **Navigate to Section** - Go to Companies, Members, or Groups
3. **Add Items** - Add existing items or create new ones
4. **Remove Items** - Remove items with confirmation
5. **Verify Changes** - Confirm relationships are updated

## Real-World Example

### **Example Account: "Acme Corporation"**
- **Account Name**: Acme Corporation
- **Slug**: acme-corporation
- **Status**: Active
- **Companies**: 3 associated companies
- **Members**: 15 account members
- **Groups**: 2 account groups

### **Account Setup Process**
1. **Create Account** - Enter "Acme Corporation" as name
2. **Auto-generate Slug** - System creates "acme-corporation"
3. **Set Status** - Mark as Active
4. **Add Companies** - Associate existing companies
5. **Add Members** - Add users as account members
6. **Create Groups** - Set up account-specific groups
7. **Verify Setup** - Confirm all relationships are correct

## Troubleshooting

### Common Issues

#### Account Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Slug Generation** - Ensure account name is valid for slug creation
- **Status Changes** - Verify account status can be toggled
- **Unsaved Changes** - Save changes before navigating away
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Filter Not Applied** - Verify filter selections are correct
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction

#### Relationship Management Issues
- **Cannot Add Companies** - Check if companies exist and are available
- **Cannot Add Members** - Verify users exist and have proper permissions
- **Cannot Remove Items** - Check if items are required for account
- **Relationship Errors** - Verify all required fields are filled

### Error Messages

#### "Account Not Found"
- **Cause**: Account ID doesn't exist in system
- **Solution**: Verify account ID and check account list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Relationship Error"
- **Cause**: Cannot establish or remove relationship
- **Solution**: Check if related items exist and are available

## Best Practices

### Account Design
- **Descriptive Names** - Use clear, descriptive account names
- **Meaningful Slugs** - Ensure auto-generated slugs are meaningful
- **Proper Status** - Use Active/Inactive status appropriately
- **Clear Descriptions** - Add helpful descriptions for account purpose
- **Regular Review** - Review accounts regularly for accuracy

### Relationship Management
- **Logical Grouping** - Group companies, members, and groups logically
- **Appropriate Access** - Only add necessary users as members
- **Regular Cleanup** - Remove outdated relationships
- **Documentation** - Document relationship purposes
- **Access Monitoring** - Monitor relationship changes

### Form Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Status Changes** - Verify status changes work correctly
- **Backup Data** - Keep backups of important account data

### Security
- **Access Control** - Control account access strictly
- **Audit Logging** - Log all account operations
- **Permission Management** - Manage user permissions carefully
- **Status Monitoring** - Monitor account status changes
- **Data Protection** - Protect sensitive account information

## Related Features

- **[Companies](./companies.md)** - Manage companies associated with accounts
- **[Users](./users.md)** - Manage users in accounts
- **[Device Management](./devices.md)** - Manage devices in accounts
- **[Bundle Management](./bundles.md)** - Deploy bundles to account devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to account devices

## Technical Details

### Account Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable account name
- **Slug** - URL-friendly identifier (auto-generated)
- **Description** - Optional account description
- **Status** - Active/Inactive state
- **Created At** - Account creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Name, ID, and slug
- **Filter Options** - Status (Active/Inactive)
- **Sort Options** - Name, slug, status, created date
- **Pagination** - Configurable page size and navigation

### Relationship Management
- **Companies** - Many-to-many relationship with companies
- **Members** - Many-to-many relationship with users
- **Groups** - One-to-many relationship with groups
- **Devices** - Indirect relationship through companies

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Relationship Errors** - Verify items exist before adding/removing
- **Status Changes** - Confirm changes in the dialog before proceeding

---

**Status**: ✅ Updated - This guide now accurately reflects the current account management UI and functionality.
