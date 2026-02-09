# Users User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Users are the individuals who access and use the IoT Management System. They can be administrators or regular users with different levels of access and permissions. User management includes creating, configuring, and managing user accounts, system roles, and security settings.

## Prerequisites

- **Admin permissions** - Full user management access
- **Role understanding** - Knowledge of system roles (Admin/User)
- **Security awareness** - Understanding of user security and authentication

## Getting Started

### Quick Start
1. **Navigate to Users** - Go to Admin → Users
2. **Create New User** - Click "Add User" button
3. **Invite User** - Click "Invite User" button for email invitations
4. **Configure User** - Set user email, name, and system role
5. **Set Security** - Configure user security settings
6. **Manage Sessions** - View and manage user sessions

### Navigation
- **Menu Path**: Admin → Users
- **URL**: `/admin/users`
- **Direct Access**: Click "Users" in the Admin section

## Core Functionality

### User List View

#### User Information Display
- **Email** - User's email address with clickable link
- **User ID** - Unique system identifier (displayed with email)
- **System Role** - Admin or User role
- **Status** - Active/Inactive/Suspended with color-coded badges
- **Created Date** - When user was created (relative format)

#### User Status Indicators
- 🟢 **Active** - User is active and can log in
- 🔴 **Inactive** - User is disabled
- 🟡 **Suspended** - User is temporarily suspended

#### Filtering and Search
- **Search by Email** - Find users by email address
- **Filter by System Role** - Show users by Admin/User role
- **Filter by Status** - Show only active/inactive/suspended users
- **Sort Options** - Sort by email, role, status, created date
- **Pagination** - Navigate through multiple pages of users

### User Detail View

#### User Information Section
- **Basic Info** - Email, name, system role, status
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Toggle between Active/Inactive/Suspended
- **System Role** - Admin or User role assignment
- **Form Fields** - Email, name, system role, status

#### User Actions
- **Edit User** - Modify user details
- **View Sessions** - Access user session management
- **Update Password** - Change user password
- **Reset Password** - Reset user password
- **Activate/Deactivate** - Toggle user status
- **Delete User** - Remove user (with confirmation)

#### Session Management
- **Active Sessions** - View current user sessions
- **Session History** - Review session activity
- **Session Control** - Manage active sessions
- **Security Monitoring** - Monitor user security

## Advanced Features

### User Creation

#### Basic User Setup
- **Email Address** - Set user's email address (required)
- **User Name** - Set user's full name
- **System Role** - Select Admin or User role
- **Status** - Set initial user status (Active/Inactive/Suspended)

#### User Configuration
- **Form Validation** - Real-time validation with error messages
- **System Role Assignment** - Assign Admin or User role
- **Status Management** - Easy toggle between Active/Inactive/Suspended
- **Security Settings** - Configure password and authentication

#### User Actions
- **Edit User** - Modify user details
- **Password Management** - Update or reset passwords
- **Session Management** - View and control user sessions
- **Status Control** - Activate/deactivate users

### User Management Features

#### Quick Actions
- **Edit User** - Click user email or edit button
- **Toggle Status** - Activate/deactivate/suspend user
- **Delete User** - Remove user with confirmation
- **View Sessions** - Access user session management
- **Password Management** - Update or reset passwords

#### Bulk Operations
- **Status Filtering** - Filter by Active/Inactive/Suspended status
- **Role Filtering** - Filter by Admin/User role
- **Search** - Find users by email address
- **Sorting** - Sort by email, role, status, or creation date
- **Pagination** - Navigate through large user lists

## Common Workflows

### Workflow 1: Create New User
1. **Navigate to Users** - Go to Admin → Users
2. **Click "Add User"** - Start user creation process
3. **Enter User Details** - Fill in email, name, system role
4. **Set Status** - Choose Active, Inactive, or Suspended
5. **Save User** - Create the user record
6. **Set Password** - Configure initial password

### Workflow 2: Invite User
1. **Navigate to Users** - Go to Admin → Users
2. **Click "Invite User"** - Start invitation process
3. **Enter Email** - Enter user's email address
4. **Set Role** - Choose Admin or User role
5. **Send Invitation** - Send email invitation
6. **User Registration** - User completes registration

### Workflow 3: Edit Existing User
1. **Find User** - Use search or filters to locate user
2. **Click User Email** - Open user detail view
3. **Edit Information** - Modify email, name, role, or status
4. **Save Changes** - Confirm changes with save button
5. **Manage Security** - Update password or view sessions

### Workflow 4: User Status Management
1. **Select User** - Choose user from list
2. **Toggle Status** - Click activate/deactivate/suspend action
3. **Confirm Action** - Confirm status change in dialog
4. **Verify Change** - Check status badge reflects change
5. **Update Security** - Adjust password or session settings as needed

## Real-World Example

### **Example User: "admin@company.com"**
- **Email**: admin@company.com
- **Name**: John Smith
- **System Role**: Admin
- **Status**: Active
- **Created**: 2 days ago

### **User Setup Process**
1. **Create User** - Enter "admin@company.com" as email
2. **Set Name** - Enter "John Smith" as name
3. **Set Role** - Choose "Admin" system role
4. **Set Status** - Mark as Active
5. **Set Password** - Configure secure password
6. **Verify Setup** - Confirm user can log in

## Troubleshooting

### Common Issues

#### User Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Email Format** - Ensure email address is valid
- **System Role** - Verify role assignment is correct
- **Status Changes** - Verify user status can be toggled
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Filter Not Applied** - Verify filter selections are correct
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction

#### Security Management Issues
- **Password Update Failed** - Check password requirements
- **Session Management** - Verify user sessions are accessible
- **Status Changes** - Confirm status changes work correctly
- **Permission Errors** - Verify admin has required permissions

### Error Messages

#### "User Not Found"
- **Cause**: User ID doesn't exist in system
- **Solution**: Verify user ID and check user list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Email Already Exists"
- **Cause**: Email address is already in use
- **Solution**: Use a different email address or update existing user

## Best Practices

### User Design
- **Descriptive Emails** - Use clear, professional email addresses
- **Proper Names** - Use full names for better identification
- **Appropriate Roles** - Assign correct system roles (Admin/User)
- **Clear Status** - Use Active/Inactive/Suspended appropriately
- **Regular Review** - Review users regularly for accuracy

### Security Management
- **Strong Passwords** - Enforce strong password requirements
- **Session Monitoring** - Monitor user sessions regularly
- **Status Management** - Keep user statuses up to date
- **Access Control** - Control user access strictly
- **Security Audits** - Regular security audits

### Form Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Status Changes** - Verify status changes work correctly
- **Backup Data** - Keep backups of important user data

### Security
- **Access Control** - Control user access strictly
- **Audit Logging** - Log all user operations
- **Permission Management** - Manage user permissions carefully
- **Status Monitoring** - Monitor user status changes
- **Data Protection** - Protect sensitive user information

## Technical Details

### User Data Structure
- **ID** - Unique system identifier
- **Email** - User's email address (primary identifier)
- **Name** - User's full name
- **System Role** - Admin or User role
- **Status** - Active/Inactive/Suspended state
- **Created At** - User creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Email address
- **Filter Options** - System Role (Admin/User), Status (Active/Inactive/Suspended)
- **Sort Options** - Email, role, status, created date
- **Pagination** - Configurable page size and navigation

### Security Features
- **Password Management** - Update and reset passwords
- **Session Management** - View and control user sessions
- **Status Control** - Activate/deactivate/suspend users
- **Role Assignment** - Assign Admin or User roles

### Account roles and module permissions
- **Account OWNER**: In each account, the user with role **OWNER** automatically has full access to all **user-side** features (e.g. Radar Controllers, Devices, PIN Rules) in that account. No group or permission override is required for OWNER to use those features.
- **Other account members**: Access to user-side modules is granted via **Groups** (assign the user to a group that has the required permissions) and/or **User permission overrides** (Admin → Users → [user] → Permissions).
- **Admin-side modules**: All users (including OWNER) need group permissions or overrides to access admin features (e.g. Admin → Accounts, Admin → Controllers).

## Related Features

- **[Accounts](./accounts.md)** - Manage accounts that users can access
- **[Companies](./companies.md)** - Manage companies that users belong to
- **[Device Management](./devices.md)** - Manage devices that users can control

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Security Errors** - Verify admin permissions and user status
- **Status Changes** - Confirm changes in the dialog before proceeding

---

**Status**: ✅ Updated - This guide now accurately reflects the current user management UI and functionality.
