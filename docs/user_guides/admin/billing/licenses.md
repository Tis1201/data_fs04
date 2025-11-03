# Licenses User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Licenses provide a system for managing device licenses and access control. This system allows you to create, manage, and track licenses for devices, with support for JWT tokens, expiration dates, and status management.

## Prerequisites

- **Admin permissions** - Full license management access
- **Device understanding** - Knowledge of device types and requirements
- **License management** - Understanding of license-based device access

## Getting Started

### Quick Start
1. **Navigate to Licenses** - Go to Admin → Billing → Licenses
2. **Add License** - Click "Add License" button
3. **Configure License** - Set up license details and target
4. **Generate JWT** - Generate JWT token for license
5. **Download License** - Download JWT file for device
6. **Monitor License** - Track license status and expiration

### Navigation
- **Menu Path**: Admin → Billing → Licenses
- **URL**: `/admin/billing/licenses`
- **Direct Access**: Click "Licenses" in the Billing section

## Core Functionality

### License List View

#### License Information Display
- **License** - License key ID with clickable link
- **License ID** - Unique system identifier (displayed with key ID)
- **Account** - Associated account name
- **Device** - Associated device ID (if assigned)
- **Status** - License status with color indicators (Active, Revoked, Expired, Suspended)
- **Issued** - When license was issued (relative format)
- **Expires** - When license expires (relative format)

#### License Status Indicators
- 🟢 **Active** - License is active and valid
- 🔴 **Revoked** - License has been revoked
- 🟡 **Expired** - License has expired
- ⚪ **Suspended** - License is suspended

#### Filtering and Search
- **Search by Account/Device/Key ID** - Find licenses by account, device, or key ID
- **Filter by Status** - Show licenses by status (Active, Revoked, Expired, Suspended)
- **Sort Options** - Sort by license, account, device, status, issued date, expires date
- **Pagination** - Navigate through multiple pages of licenses

### License Detail View

#### License Information Section
- **Basic Info** - License key ID, account, device, status
- **JWT Token** - JWT token for license (if available)
- **Expiration** - License expiration date and time
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Account, device, expiration date, status

#### License Actions
- **View License** - Access license information
- **Download JWT** - Download JWT token file (if available)
- **Delete License** - Remove license (with confirmation)

## Advanced Features

### License Creation

#### Basic License Setup
- **Account Selection** - Choose account for license (required)
- **Device Assignment** - Assign license to specific device (optional)
- **Expiration Date** - Set license expiration date
- **Status** - Set license status (Active, Revoked, Expired, Suspended)
- **JWT Generation** - Generate JWT token for license

#### License Management
- **Form Validation** - Real-time validation with error messages
- **JWT Download** - Download JWT token file for device installation
- **Status Management** - Manage license status and expiration
- **License Actions** - View, download, or delete licenses

### License Management Features

#### Quick Actions
- **View License** - Click license key ID or view button
- **Download JWT** - Download JWT token file (if available)
- **Delete License** - Remove license with confirmation

#### Bulk Operations
- **Search** - Find licenses by account, device, or key ID
- **Sorting** - Sort by license, account, device, status, issued date, expires date
- **Pagination** - Navigate through large license lists
- **Filtering** - Filter by status (Active, Revoked, Expired, Suspended)

## Common Workflows

### Workflow 1: Create New License
1. **Navigate to Licenses** - Go to Admin → Billing → Licenses
2. **Click "Add License"** - Start license creation process
3. **Select Account** - Choose account for license
4. **Assign Device** - Optionally assign license to specific device
5. **Set Expiration** - Set license expiration date
6. **Generate JWT** - Generate JWT token for license
7. **Download License** - Download JWT file for device installation

### Workflow 2: View License Details
1. **Find License** - Use search to locate license
2. **Click License Key ID** - Open license detail view
3. **View Information** - Review license details
4. **Check Status** - Verify license status and expiration
5. **Download JWT** - Download JWT token if needed

### Workflow 3: Download JWT Token
1. **Select License** - Choose license from list
2. **Click "Download JWT"** - Click download action
3. **Save File** - Save JWT file to device
4. **Install License** - Install JWT token on target device

### Workflow 4: Delete License
1. **Select License** - Choose license from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm license is removed from list

## Troubleshooting

### Common Issues

#### License Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Account Selection** - Ensure account is selected and valid
- **Device Assignment** - Verify device assignment if applicable
- **Expiration Date** - Check expiration date is valid
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### License Management Issues
- **Cannot View License** - Check admin permissions and license status
- **Download Failed** - Check if JWT token is available
- **Delete Failed** - Check license dependencies and permissions
- **License Not Found** - Verify license exists and is accessible

### Error Messages

#### "License Not Found"
- **Cause**: License ID doesn't exist in system
- **Solution**: Verify license ID and check license list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "JWT Not Available"
- **Cause**: JWT token not generated for license
- **Solution**: Generate JWT token for license or check license status

## Best Practices

### License Design
- **Descriptive Key IDs** - Use clear, descriptive license key IDs
- **Appropriate Expiration** - Set reasonable expiration dates
- **Account Assignment** - Assign licenses to appropriate accounts
- **Device Targeting** - Target specific devices when needed
- **Clear Documentation** - Document license purpose and usage

### License Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test License Functionality** - Verify licenses work as expected
- **Backup Data** - Keep backups of important license data

### JWT Token Management
- **Secure Storage** - Store JWT tokens securely
- **Regular Rotation** - Rotate JWT tokens regularly
- **Expiration Monitoring** - Monitor license expiration dates
- **Token Validation** - Validate JWT tokens before use
- **Access Control** - Control JWT token access strictly

### Security
- **Access Control** - Control license access strictly
- **Permission Management** - Manage license permissions carefully
- **Data Protection** - Protect sensitive license information
- **Audit Logging** - Log all license operations

## Technical Details

### License Data Structure
- **ID** - Unique system identifier
- **Key ID** - Human-readable license key ID
- **Account ID** - Associated account identifier
- **Device ID** - Associated device identifier (optional)
- **Status** - License status (Active, Revoked, Expired, Suspended)
- **JWT** - JWT token for license (if generated)
- **Issued At** - License issuance timestamp
- **Expires At** - License expiration timestamp

### Search and Filtering
- **Search Fields** - Account ID, device ID, key ID, status
- **Sort Options** - License, account, device, status, issued date, expires date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Active, Revoked, Expired, Suspended)

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Account Selection** - Account picker with search and selection
- **Device Assignment** - Device selector for license assignment
- **JWT Generation** - Automatic JWT token generation
- **Download Actions** - JWT token download functionality

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use licenses
- **[Account Management](./accounts.md)** - Manage accounts for license assignment
- **[Billing Management](./billing.md)** - Manage billing and license costs

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **License Errors** - Verify license exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Complete - This guide covers all aspects of license management from creation to JWT token generation and troubleshooting.
