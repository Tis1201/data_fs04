# Factory Tokens User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Factory Tokens are JWT tokens used by devices during initial registration. These tokens allow devices to authenticate with the system before they are claimed by users, enabling the device registration and claiming workflow.

## Prerequisites

- **Admin permissions** - Full factory token management access
- **Device registration** - Understanding of device registration process

## Getting Started

### Quick Start
1. **Navigate to Factory Tokens** - Go to Admin → IOT → Factory Tokens
2. **Add Token** - Click "Add Token" button
3. **Configure Token** - Set token name, hardware model, and expiration
4. **Generate Token** - Create the JWT token
5. **Distribute to Devices** - Provide token to devices for registration
6. **Monitor Usage** - Track token usage and device registrations

### Navigation
- **Menu Path**: Admin → IOT → Factory Tokens
- **URL**: `/admin/iot/factory_tokens`
- **Direct Access**: Click "Factory Tokens" in the IOT section

## Core Functionality

### Factory Token List View

#### Token Information Display
- **Token ID** - Human-readable token name with clickable link
- **Hardware Model** - Device hardware model
- **Token** - JWT token with secure display and copy functionality
- **Status** - Used/Available status with visual indicators
- **Expires** - Token expiration date (relative format)
- **Issued** - Token issue date (relative format)

#### Token Status Indicators
- 🟢 **Used** - Token has been used for device registration
- 🔴 **Available** - Token is available for use

#### Filtering and Search
- **Search by Token ID/Serial** - Find tokens by ID or serial number
- **Filter by Status** - Show tokens by status (Used, Available)
- **Sort Options** - Sort by name, status, expiration date, issue date
- **Pagination** - Navigate through multiple pages of tokens

### Factory Token Detail View

#### Token Information Section
- **Basic Info** - Name, ID, hardware model, status
- **Token Details** - JWT token with secure display
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, hardware model, expiration date

#### Token Actions
- **Edit Token** - Modify token details
- **Delete Token** - Remove token (with confirmation)
- **Copy Token** - Copy JWT token to clipboard
- **Toggle Status** - Mark token as used/available

## Advanced Features

### Factory Token Creation

#### Basic Token Setup
- **Token Name** - Choose descriptive name (required)
- **Hardware Model** - Set device hardware model (optional)
- **Expiration Date** - Set token expiration date (required)
- **Status** - Set initial token status (Available)

#### Token Configuration
- **JWT Generation** - Automatic JWT token generation
- **Secure Display** - Secure token display with visibility toggle
- **Copy Functionality** - Copy token to clipboard
- **Form Validation** - Real-time validation with error messages

#### Token Management
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Toggle token used/available status
- **Token Actions** - Edit, delete, or copy tokens
- **Usage Tracking** - Track token usage and device registrations

## Common Workflows

### Workflow 1: Create New Factory Token
1. **Navigate to Factory Tokens** - Go to Admin → IOT → Factory Tokens
2. **Click "Add Token"** - Start token creation process
3. **Enter Token Details** - Fill in name, hardware model, and expiration date
4. **Generate Token** - Create the JWT token
5. **Save Token** - Save the factory token
6. **Verify Creation** - Confirm token is created successfully

### Workflow 2: View Token Details
1. **Find Token** - Use search to locate token
2. **Click Token ID** - Open token detail view
3. **View Information** - Review token details and JWT token
4. **Check Status** - Verify token status and expiration

### Workflow 3: Edit Token
1. **Select Token** - Choose token from list
2. **Click Edit** - Open token for editing
3. **Modify Information** - Update name, hardware model, or expiration
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 4: Toggle Token Status
1. **Select Token** - Choose token from list
2. **Click Toggle Status** - Mark token as used/available
3. **Confirm Action** - Confirm status change in dialog
4. **Verify Status** - Confirm status change is applied

### Workflow 5: Delete Token
1. **Select Token** - Choose token from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm token is removed from list


## Troubleshooting

### Common Issues

#### Token Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Token Name** - Ensure token name is unique and valid
- **Hardware Model** - Verify hardware model format
- **Expiration Date** - Check expiration date is valid
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Token Management Issues
- **Cannot Edit Token** - Check admin permissions and token status
- **Status Toggle Failed** - Check token permissions and status
- **Delete Failed** - Check token dependencies and permissions
- **Token Not Found** - Verify token exists and is accessible

#### Token Display Issues
- **Token Not Visible** - Check token visibility toggle
- **Copy Failed** - Check clipboard permissions
- **Token Format** - Verify JWT token format

### Error Messages

#### "Token Not Found"
- **Cause**: Token ID doesn't exist in system
- **Solution**: Verify token ID and check token list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Token Copy Failed"
- **Cause**: Clipboard access denied
- **Solution**: Check browser clipboard permissions

#### "Status Update Failed"
- **Cause**: Token status update failed
- **Solution**: Check token status and try again

## Best Practices

### Token Design
- **Descriptive Names** - Use clear, descriptive token names
- **Appropriate Expiration** - Set reasonable expiration dates
- **Hardware Model** - Specify hardware model when relevant
- **Secure Display** - Use secure token display with visibility toggle
- **Copy Functionality** - Provide easy token copying

### Token Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Token Functionality** - Verify tokens work as expected
- **Backup Data** - Keep backups of important token data

### Status Management
- **Status Tracking** - Track token used/available status
- **Status Updates** - Update status when tokens are used
- **Status Monitoring** - Monitor token status regularly
- **Status Cleanup** - Clean up expired or unused tokens

### Security
- **Secure Display** - Use secure token display with visibility toggle
- **Copy Protection** - Implement secure token copying
- **Access Control** - Control token access strictly
- **Audit Logging** - Log all token operations

## Technical Details

### Factory Token Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable token name
- **Hardware Model** - Device hardware model
- **Token** - JWT token string
- **Status** - Token status (Used, Available)
- **Expires At** - Token expiration timestamp
- **Issued At** - Token issue timestamp

### Search and Filtering
- **Search Fields** - Token name, hardware model, firmware version, batch number
- **Sort Options** - Name, status, expiration date, issue date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Used, Available), Hardware Models

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Date Picker** - Enhanced date picker for expiration date
- **Form Fields** - Name, hardware model, expiration date
- **Save/Cancel Actions** - Standard form actions

### Token Display
- **Secure Display** - Secure token display with visibility toggle
- **Copy Functionality** - Copy token to clipboard
- **Status Badges** - Visual status indicators
- **Date Formatting** - Relative date formatting with tooltips

## Related Features

- **[Devices](./devices.md)** - Manage devices registered with tokens
- **[Device Profiles](./device_profiles.md)** - Apply profiles to registered devices
- **[PIN Rules](./pin_rules.md)** - Configure PIN rules for device claiming
- **[Preclaims](./preclaims.md)** - Pre-configure device claims

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Token Errors** - Verify token exists and is accessible
- **Permission Issues** - Check admin permissions
- **Display Issues** - Check token visibility and copy functionality

---

**Status**: ✅ Updated - This guide now accurately reflects the current factory token management UI and functionality.
