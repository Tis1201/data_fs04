# Device Profiles User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Device Profiles allow you to create standardized configurations for your IoT devices. Profiles define settings and behaviors that can be applied to multiple devices, ensuring consistency and simplifying device management across your fleet.

## Prerequisites

- **Admin permissions** - Full device profile management access
- **Device understanding** - Knowledge of device types and requirements
- **Configuration planning** - Plan for device configuration needs

## Getting Started

### Quick Start
1. **Navigate to Device Profiles** - Go to Admin → IOT → Device Profiles
2. **Create New Profile** - Click "Create Profile" button
3. **Configure Settings** - Set up profile configuration
4. **Assign to Devices** - Apply profile to target devices

### Navigation
- **Menu Path**: Admin → IOT → Device Profiles
- **URL**: `/admin/iot/device-profiles`
- **Direct Access**: Click "Device Profiles" in the IOT section

## Core Functionality

### Profile List View

#### Profile Information Display
- **Profile Name** - Human-readable profile name with clickable link
- **Profile ID** - Unique system identifier (displayed with name)
- **Description** - Profile description or "No description"
- **Status** - Active/Inactive status with color indicators
- **Assigned Devices** - Number of devices using this profile
- **Account** - Associated account name
- **Created Date** - When profile was created (relative format)

#### Profile Status Indicators
- 🟢 **Active** - Profile is ready for use (green badge)
- 🔴 **Inactive** - Profile is disabled (gray badge)

#### Filtering and Search
- **Search by Name/ID** - Find profiles by name or ID
- **Filter by Status** - Show only active/inactive profiles
- **Sort Options** - Sort by name, status, created date
- **Pagination** - Navigate through multiple pages of profiles

### Profile Detail View

#### Profile Information Section
- **Basic Info** - Name, ID, description
- **Account Association** - Associated account
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, description, settings configuration

#### Profile Actions
- **Edit Profile** - Modify profile details
- **Delete Profile** - Remove profile (with confirmation)
- **View Details** - Access full profile information

## Advanced Features

### Profile Creation

#### Basic Profile Setup
- **Profile Name** - Choose descriptive name (required)
- **Description** - Add detailed description (optional)
- **Settings Configuration** - Configure device settings
- **Account Association** - Link to specific account

#### Profile Configuration
- **Form Validation** - Real-time validation with error messages
- **Settings Editor** - Visual settings configuration interface
- **Account Selection** - Link profile to specific account
- **Profile Management** - Edit or delete profiles

#### Profile Actions
- **Edit Profile** - Modify profile details
- **Delete Profile** - Remove profile with confirmation
- **View Details** - Access full profile information

### Profile Management Features

#### Quick Actions
- **Edit Profile** - Click profile name or edit button
- **Delete Profile** - Remove profile with confirmation
- **View Details** - Access full profile management

#### Bulk Operations
- **Search** - Find profiles by name or ID
- **Sorting** - Sort by name, status, or creation date
- **Pagination** - Navigate through large profile lists

## Common Workflows

### Workflow 1: Create New Profile
1. **Navigate to Device Profiles** - Go to Admin → IOT → Device Profiles
2. **Click "Create Profile"** - Start profile creation process
3. **Enter Profile Details** - Fill in name, description, and settings
4. **Configure Settings** - Set up device configuration settings
5. **Save Profile** - Create the profile record
6. **Verify Creation** - Confirm profile is created successfully

### Workflow 2: Edit Existing Profile
1. **Find Profile** - Use search to locate profile
2. **Click Profile Name** - Open profile detail view
3. **Edit Information** - Modify name, description, or settings
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 3: Delete Profile
1. **Select Profile** - Choose profile from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm profile is removed from list

### Workflow 4: Profile Management
1. **Create Profiles** - Create profiles for different device types
2. **Configure Settings** - Set up device configuration settings
3. **Assign to Devices** - Apply profiles to devices
4. **Manage Profiles** - Edit or delete profiles as needed


## Troubleshooting

### Common Issues

#### Profile Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Profile Name** - Ensure profile name is unique and valid
- **Settings Configuration** - Verify settings are properly configured
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction

#### Profile Management Issues
- **Cannot Edit Profile** - Check admin permissions and profile status
- **Delete Failed** - Check if profile is in use or has dependencies
- **Profile Not Found** - Verify profile exists and is accessible

### Error Messages

#### "Profile Not Found"
- **Cause**: Profile ID doesn't exist in system
- **Solution**: Verify profile ID and check profile list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Profile Name Already Exists"
- **Cause**: Profile name is already in use
- **Solution**: Choose a different profile name

## Best Practices

### Profile Design
- **Descriptive Names** - Use clear, descriptive profile names
- **Consistent Naming** - Use consistent naming conventions
- **Helpful Descriptions** - Add descriptions for profile purpose
- **Account Organization** - Link profiles to appropriate accounts
- **Regular Review** - Review profiles regularly for accuracy

### Profile Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Profile Usage** - Verify profiles work with device assignment
- **Backup Data** - Keep backups of important profile data

### Organization
- **Logical Grouping** - Group related profiles logically
- **Clear Descriptions** - Use clear descriptions for profile purpose
- **Account Association** - Link profiles to appropriate accounts
- **Regular Cleanup** - Remove unused or duplicate profiles
- **Documentation** - Document profile purpose and usage

### Security
- **Access Control** - Control profile access strictly
- **Permission Management** - Manage profile permissions carefully
- **Data Protection** - Protect sensitive profile information
- **Audit Logging** - Log all profile operations

## Technical Details

### Profile Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable profile name
- **Description** - Optional profile description
- **Settings** - Device configuration settings
- **Account ID** - Associated account identifier
- **Is Active** - Profile status (active/inactive)
- **Created At** - Profile creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Profile name, description
- **Filter Options** - Status (active/inactive)
- **Sort Options** - Name, status, created date
- **Pagination** - Configurable page size and navigation

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Settings Editor** - Visual settings configuration interface
- **Account Selection** - Optional account association
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use profiles
- **[Bundle Management](./bundles.md)** - Deploy applications to profiles
- **[Device Tags](./device_tags.md)** - Organize devices for profile assignment

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Profile Errors** - Verify profile exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current device profile management UI and functionality.
