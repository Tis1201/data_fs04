# Preclaims User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Preclaims allow you to pre-configure device claims before devices are registered. This enables bulk device setup, automated claiming workflows, and streamlined device deployment by preparing device claims in advance.

## Prerequisites

- **Admin permissions** - Full preclaim management access
- **Device understanding** - Knowledge of device types and requirements
- **Bulk operations** - Experience with bulk device operations

## Getting Started

### Quick Start
1. **Navigate to Preclaims** - Go to Admin → IOT → Preclaims
2. **Add Preclaim Set** - Click "Add Preclaim Set" button
3. **Upload Device Data** - Upload CSV/XLSX file with device MAC addresses
4. **Configure Settings** - Set preclaim name, description, and expiration
5. **Create Preclaim** - Create the preclaim set
6. **Monitor Usage** - Track preclaim usage and device claims

### Navigation
- **Menu Path**: Admin → IOT → Preclaims
- **URL**: `/admin/iot/preclaims`
- **Direct Access**: Click "Preclaims" in the IOT section

## Core Functionality

### Preclaim List View

#### Preclaim Information Display
- **Preclaim Name** - Human-readable preclaim name with clickable link
- **Preclaim ID** - Unique system identifier (displayed with name)
- **Status** - Preclaim status with color indicators (Active, Inactive)
- **Expires** - Expiration date (relative format)
- **Added** - When preclaim was created (relative format)

#### Preclaim Status Indicators
- 🟢 **Active** - Preclaim is active and can be used
- 🔴 **Inactive** - Preclaim is disabled

#### Filtering and Search
- **Search by Name/Description** - Find preclaims by name or description
- **Filter by Status** - Show preclaims by status (Active, Inactive)
- **Sort Options** - Sort by name, status, expiration date, created date
- **Pagination** - Navigate through multiple pages of preclaims

### Preclaim Detail View

#### Preclaim Information Section
- **Basic Info** - Name, ID, description, status
- **Expiration** - Expiration date and time
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, description, expiration date, file upload

#### Preclaim Actions
- **View Details** - Access preclaim information
- **Edit Preclaim** - Modify preclaim details
- **Delete Preclaim** - Remove preclaim (with confirmation)

## Advanced Features

### Preclaim Creation

#### Basic Preclaim Setup
- **Preclaim Name** - Choose descriptive name (required)
- **Description** - Add detailed description (optional)
- **Device Profile** - Assign device profile to auto-configure claimed devices (optional)
- **Expiration Date** - Set preclaim expiration date
- **File Upload** - Upload CSV/XLSX file with device MAC addresses
- **Form Validation** - Real-time validation with error messages

#### File Upload Configuration
- **Supported Formats** - CSV and XLSX files
- **File Validation** - Validate file format and content
- **MAC Address Processing** - Extract and process MAC addresses
- **Error Handling** - Handle upload errors and validation issues

#### Preclaim Management
- **Form Validation** - Real-time validation with error messages
- **File Upload** - Smart file upload with validation
- **Expiration Management** - Set and manage expiration dates
- **Preclaim Actions** - View, edit, or delete preclaims

### Device Profile Integration

#### Automatic Profile Assignment
When you assign a device profile to a preclaim set, all devices claimed through that preclaim will automatically receive the profile configuration. This enables:
- **Zero-Touch Deployment**: Devices auto-configure when claimed
- **Consistent Configuration**: All devices get identical settings
- **Simplified Management**: Update profile instead of individual devices

#### How It Works
1. **Create/Select Profile** - Choose or create a device profile with desired settings
2. **Assign to Preclaim** - Select the profile when creating/editing preclaim set
3. **Claim Devices** - When devices are claimed via PIN:
   - System creates device-level copy of the profile
   - Profile is automatically assigned to the claimed device
   - Settings are pushed to device when it connects
4. **Device Configured** - Device receives and applies all profile settings

#### Profile Requirements
- **Profile Level**: Must be GLOBAL-level profile
- **Profile Status**: Must be active
- **Profile Scope**: Can be from any account (if admin)
- **Optional Field**: Preclaims can be created without a profile

#### Profile Lifecycle
```
GLOBAL Profile (Template)
    ↓ Preclaim Created with Profile
    ↓ Device Claimed via Preclaim
DEVICE Profile (Copy)
    ↓ Auto-assigned to Device
    ↓ Device Connects
Settings Applied to Device
```

### Preclaim Management Features

#### Quick Actions
- **View Details** - Click preclaim name or view button
- **Edit Preclaim** - Modify preclaim details (including profile)
- **Delete Preclaim** - Remove preclaim with confirmation

#### Bulk Operations
- **Search** - Find preclaims by name or description
- **Sorting** - Sort by name, status, expiration date, created date
- **Pagination** - Navigate through large preclaim lists
- **Filtering** - Filter by status (Active, Inactive)

## Common Workflows

### Workflow 1: Create New Preclaim Set with Device Profile
1. **Navigate to Preclaims** - Go to Admin → IOT → Preclaims
2. **Click "Add Preclaim Set"** - Start preclaim creation process
3. **Enter Preclaim Details** - Fill in name, description, expiration date
4. **Select Device Profile** - Choose profile to auto-configure claimed devices (optional)
5. **Upload Device File** - Upload CSV/XLSX file with MAC addresses
6. **Create Preclaim** - Create the preclaim set
7. **Verify Creation** - Confirm preclaim is created successfully

### Workflow 2: View Preclaim Details
1. **Find Preclaim** - Use search to locate preclaim
2. **Click Preclaim Name** - Open preclaim detail view
3. **View Information** - Review preclaim details
4. **Check Status** - Verify preclaim status and expiration

### Workflow 3: Edit Preclaim
1. **Select Preclaim** - Choose preclaim from list
2. **Click View Details** - Open preclaim detail view
3. **Edit Information** - Modify name, description, or expiration
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 4: Delete Preclaim
1. **Select Preclaim** - Choose preclaim from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm preclaim is removed from list


## Troubleshooting

### Common Issues

#### Preclaim Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Preclaim Name** - Ensure preclaim name is unique and valid
- **File Upload** - Verify file upload is successful and format is supported
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Preclaim Management Issues
- **Cannot View Preclaim** - Check admin permissions and preclaim status
- **Delete Failed** - Check if preclaim is in use or has dependencies
- **Preclaim Not Found** - Verify preclaim exists and is accessible
- **File Upload Failed** - Check file format and size

### Error Messages

#### "Preclaim Not Found"
- **Cause**: Preclaim ID doesn't exist in system
- **Solution**: Verify preclaim ID and check preclaim list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "File Upload Failed"
- **Cause**: File upload failed
- **Solution**: Check file format (CSV/XLSX), size, and network connection

## Best Practices

### Preclaim Design
- **Descriptive Names** - Use clear, descriptive preclaim names
- **Helpful Descriptions** - Add descriptions for preclaim purpose
- **Device Profiles** - Assign profiles for automatic device configuration
- **Profile Templates** - Create reusable profiles for common device types
- **Appropriate Expiration** - Set reasonable expiration dates
- **File Organization** - Organize device files logically
- **Clear Documentation** - Document preclaim purpose and usage

### Device Profile Best Practices
- **Test Profiles** - Test profiles on sample devices before bulk deployment
- **Profile Naming** - Use descriptive names that indicate purpose (e.g., "Retail Kiosk Standard")
- **Profile Documentation** - Document what each profile configures
- **Profile Versioning** - Consider creating new profiles instead of modifying existing ones for major changes
- **Account Scope** - Keep profiles within appropriate account scope
- **Active Status** - Ensure profiles are active before assigning to preclaims

### File Management
- **Supported Formats** - Use CSV or XLSX files only
- **File Validation** - Validate file format and content before upload
- **MAC Address Format** - Ensure MAC addresses are in correct format
- **File Size** - Keep file sizes reasonable
- **Backup Files** - Keep backups of device files

### Preclaim Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Preclaim Functionality** - Verify preclaims work as expected
- **Backup Data** - Keep backups of important preclaim data

### Security
- **Access Control** - Control preclaim access strictly
- **Permission Management** - Manage preclaim permissions carefully
- **Data Protection** - Protect sensitive preclaim information
- **Audit Logging** - Log all preclaim operations

## Technical Details

### Preclaim Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable preclaim name
- **Description** - Preclaim description
- **Status** - Preclaim status (Active, Inactive)
- **Expires At** - Expiration date and time
- **Created At** - Preclaim creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Preclaim name, description
- **Sort Options** - Name, status, expiration date, created date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Active, Inactive)

### Form Features
- **Real-time Validation** - Form validation with error messages
- **File Upload** - CSV/XLSX file upload with validation
- **Expiration Management** - Date picker for expiration dates
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Device Management](./devices.md)** - Manage claimed devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to claimed devices
- **[Device Tags](./device_tags.md)** - Organize devices for preclaiming
- **[Accounts](./accounts.md)** - Manage accounts for device assignment

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Preclaim Errors** - Verify preclaim exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current preclaim management UI and functionality.
