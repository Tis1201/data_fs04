# PIN Rules User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

PIN Rules provide a system for managing device PINs and access control. This system allows you to create rules that determine which PINs can be used to claim devices, with support for app targeting and device selection.

## Prerequisites

- **Admin permissions** - Full PIN rule management access
- **Device understanding** - Knowledge of device types and requirements
- **App management** - Understanding of app-based device rules

## Getting Started

### Quick Start
1. **Navigate to PIN Rules** - Go to Admin → IOT → Pin Rules
2. **Add Pin Rule** - Click "Add Pin Rule" button
3. **Configure Rule** - Set up rule name, description, and apps
4. **Set Target** - Choose target devices (all devices or specific devices)
5. **Activate Rule** - Set rule status to active
6. **Save Rule** - Save the PIN rule

### Navigation
- **Menu Path**: Admin → IOT → Pin Rules
- **URL**: `/admin/iot/pin-rules`
- **Direct Access**: Click "Pin Rules" in the IOT section

## Core Functionality

### PIN Rule List View

#### Rule Information Display
- **Rule Name** - Human-readable rule name with clickable link
- **Rule ID** - Unique system identifier (displayed with name)
- **Type** - Rule type (Admin default, Admin custom, User default, User custom)
- **Apps** - Number of apps associated with rule
- **Target** - Target type (All Devices or specific device count)
- **Status** - Rule status (Active, Inactive)
- **Created** - When rule was created (relative format)

#### Rule Status Indicators
- 🟢 **Active** - Rule is active and enforced
- 🔴 **Inactive** - Rule is disabled

#### Filtering and Search
- **Search by Name/Description/Apps** - Find rules by name, description, or apps
- **Filter by Status** - Show rules by status (Active, Inactive)
- **Sort Options** - Sort by name, type, status, created date
- **Pagination** - Navigate through multiple pages of rules

### PIN Rule Detail View

#### Rule Information Section
- **Basic Info** - Name, ID, description, status
- **Rule Type** - Admin default, Admin custom, User default, User custom
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, description, apps, target type, target value, status

#### Rule Actions
- **Edit Rule** - Modify rule details
- **Delete Rule** - Remove rule (not available for default rules)

## Advanced Features

### PIN Rule Creation

#### Basic Rule Setup
- **Rule Name** - Choose descriptive name (required)
- **Description** - Add detailed description (optional)
- **Apps** - Select apps to associate with rule
- **Target Type** - Choose target type (All Devices or Specific Devices)
- **Target Value** - Select specific devices if targeting specific devices
- **Status** - Set rule status (Active, Inactive)

#### App Selection
- **App Picker** - Browse and select available apps
- **App Validation** - Validate selected apps
- **App Management** - Add or remove apps from rule
- **App Display** - Show selected apps in rule

#### Device Targeting
- **All Devices** - Target all devices in system
- **Specific Devices** - Target specific devices
- **Device Selection** - Select devices from device list
- **Device Validation** - Validate selected devices

#### Rule Management
- **Form Validation** - Real-time validation with error messages
- **Rule Actions** - Edit or delete rules
- **Default Rule Protection** - Default rules cannot be deleted
- **Rule Status** - Manage rule active/inactive status

## Common Workflows

### Workflow 1: Create New PIN Rule
1. **Navigate to PIN Rules** - Go to Admin → IOT → Pin Rules
2. **Click "Add Pin Rule"** - Start PIN rule creation process
3. **Enter Rule Details** - Fill in name, description, and apps
4. **Set Target Type** - Choose All Devices or Specific Devices
5. **Select Devices** - If targeting specific devices, select them
6. **Set Status** - Set rule to Active or Inactive
7. **Save Rule** - Save the PIN rule

### Workflow 2: Edit Existing PIN Rule
1. **Find Rule** - Use search to locate rule
2. **Click Rule Name** - Open rule detail view
3. **Edit Information** - Modify name, description, apps, or target
4. **Update Status** - Change rule status if needed
5. **Save Changes** - Confirm changes with save button
6. **Verify Update** - Confirm changes are saved

### Workflow 3: Delete PIN Rule
1. **Select Rule** - Choose rule from list
2. **Click Delete** - Click delete action (not available for default rules)
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm rule is removed from list

### Workflow 4: Manage Rule Status
1. **Select Rule** - Choose rule from list
2. **Edit Rule** - Open rule for editing
3. **Change Status** - Toggle between Active and Inactive
4. **Save Changes** - Save status change
5. **Verify Status** - Confirm status change is applied

## Troubleshooting

### Common Issues

#### Rule Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Rule Name** - Ensure rule name is unique and valid
- **App Selection** - Verify app selection is successful
- **Device Targeting** - Check device selection if targeting specific devices
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Rule Management Issues
- **Cannot Edit Rule** - Check admin permissions and rule type
- **Delete Failed** - Check if rule is a default rule (cannot be deleted)
- **Rule Not Found** - Verify rule exists and is accessible
- **Status Change Failed** - Check rule permissions and status

### Error Messages

#### "Rule Not Found"
- **Cause**: Rule ID doesn't exist in system
- **Solution**: Verify rule ID and check rule list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Default Rule Cannot Be Deleted"
- **Cause**: Attempting to delete a default rule
- **Solution**: Default rules cannot be deleted, only custom rules can be deleted

## Best Practices

### Rule Design
- **Descriptive Names** - Use clear, descriptive rule names
- **Helpful Descriptions** - Add descriptions for rule purpose
- **App Selection** - Choose relevant apps for rules
- **Target Selection** - Select appropriate target devices
- **Clear Documentation** - Document rule purpose and usage

### Rule Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Rule Functionality** - Verify rules work as expected
- **Backup Data** - Keep backups of important rule data

### App and Device Management
- **App Selection** - Choose appropriate apps for rules
- **Device Targeting** - Select appropriate target devices
- **Validation** - Validate app and device selections
- **Organization** - Organize rules logically
- **Cleanup** - Clean up unused or invalid rules

### Security
- **Access Control** - Control rule access strictly
- **Permission Management** - Manage rule permissions carefully
- **Data Protection** - Protect sensitive rule information
- **Audit Logging** - Log all rule operations

## Technical Details

### PIN Rule Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable rule name
- **Description** - Rule description
- **Rule Type** - Admin default, Admin custom, User default, User custom
- **Apps** - Associated apps (comma-separated)
- **Target Type** - All devices or specific devices
- **Target Value** - Specific device IDs if targeting specific devices
- **Is Active** - Rule status (true/false)
- **Created At** - Rule creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Rule name, description, apps
- **Sort Options** - Name, type, status, created date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Active, Inactive)

### Form Features
- **Real-time Validation** - Form validation with error messages
- **App Selection** - App picker with search and selection
- **Device Targeting** - Device selector for specific device targeting
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use PIN rules
- **[Device Profiles](./device_profiles.md)** - Configure device profiles with PIN rules
- **[Device Tags](./device_tags.md)** - Organize devices for PIN rule assignment
- **[Preclaims](./preclaims.md)** - Pre-configure device claims with PIN rules

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Rule Errors** - Verify rule exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current PIN rule management UI and functionality.
