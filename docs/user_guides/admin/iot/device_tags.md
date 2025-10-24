# Device Tags User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Beginner

## Overview

Device Tags provide a simple system for organizing and categorizing your IoT devices. Tags allow you to group devices by location, function, department, or any other criteria, making it easier to manage device fleets and perform operations on tagged devices.

## Prerequisites

- **Admin permissions** - Full device tag management access
- **Device access** - Access to devices for tagging
- **Organization planning** - Plan for device organization structure

## Getting Started

### Quick Start
1. **Navigate to Device Tags** - Go to Admin → IOT → Device Tags
2. **Create New Tag** - Click "Add Tag" button
3. **Configure Tag** - Set up tag name, description, and account
4. **Assign to Devices** - Apply tags to target devices
5. **Use for Filtering** - Filter devices by tags

### Navigation
- **Menu Path**: Admin → IOT → Device Tags
- **URL**: `/admin/iot/device_tags`
- **Direct Access**: Click "Device Tags" in the IOT section

## Core Functionality

### Tag List View

#### Tag Information Display
- **Tag Name** - Human-readable tag name with clickable link
- **Tag ID** - Unique system identifier (displayed with name)
- **Description** - Tag description or "N/A" if not set
- **Created Date** - When tag was created (relative format)

#### Filtering and Search
- **Search by Name** - Find tags by name
- **Sort Options** - Sort by name, description, created date
- **Pagination** - Navigate through multiple pages of tags

### Tag Detail View

#### Tag Information Section
- **Basic Info** - Name, ID, description
- **Account Association** - Associated account (optional)
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, description, account selection

#### Tag Actions
- **Edit Tag** - Modify tag details
- **Delete Tag** - Remove tag (with confirmation)
- **View Details** - Access full tag information

## Advanced Features

### Tag Creation

#### Basic Tag Setup
- **Tag Name** - Choose descriptive name (required)
- **Description** - Add detailed description (optional)
- **Account Association** - Select account (optional, defaults to system account)

#### Tag Configuration
- **Form Validation** - Real-time validation with error messages
- **Account Selection** - Link tag to specific account
- **Description Management** - Add helpful descriptions
- **Tag Management** - Edit or delete tags

#### Tag Actions
- **Edit Tag** - Modify tag details
- **Delete Tag** - Remove tag with confirmation
- **View Details** - Access full tag information

### Tag Management Features

#### Quick Actions
- **Edit Tag** - Click tag name or edit button
- **Delete Tag** - Remove tag with confirmation
- **View Details** - Access full tag management

#### Bulk Operations
- **Search** - Find tags by name
- **Sorting** - Sort by name, description, or creation date
- **Pagination** - Navigate through large tag lists

## Common Workflows

### Workflow 1: Create New Tag
1. **Navigate to Device Tags** - Go to Admin → IOT → Device Tags
2. **Click "Add Tag"** - Start tag creation process
3. **Enter Tag Details** - Fill in name, description, and account
4. **Save Tag** - Create the tag record
5. **Verify Creation** - Confirm tag is created successfully

### Workflow 2: Edit Existing Tag
1. **Find Tag** - Use search to locate tag
2. **Click Tag Name** - Open tag detail view
3. **Edit Information** - Modify name, description, or account
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 3: Delete Tag
1. **Select Tag** - Choose tag from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm tag is removed from list

### Workflow 4: Tag Organization
1. **Create Tags** - Create tags for different purposes
2. **Assign to Devices** - Apply tags to devices
3. **Use for Filtering** - Filter devices by tags
4. **Manage Tags** - Edit or delete tags as needed

## Troubleshooting

### Common Issues

#### Tag Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Tag Name** - Ensure tag name is unique and valid
- **Account Selection** - Verify account exists and is accessible
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction

#### Tag Management Issues
- **Cannot Edit Tag** - Check admin permissions and tag status
- **Delete Failed** - Check if tag is in use or has dependencies
- **Tag Not Found** - Verify tag exists and is accessible

### Error Messages

#### "Tag Not Found"
- **Cause**: Tag ID doesn't exist in system
- **Solution**: Verify tag ID and check tag list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Tag Name Already Exists"
- **Cause**: Tag name is already in use
- **Solution**: Choose a different tag name

## Best Practices

### Tag Design
- **Descriptive Names** - Use clear, descriptive tag names
- **Consistent Naming** - Use consistent naming conventions
- **Helpful Descriptions** - Add descriptions for tag purpose
- **Account Organization** - Link tags to appropriate accounts
- **Regular Review** - Review tags regularly for accuracy

### Tag Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Tag Usage** - Verify tags work with device filtering
- **Backup Data** - Keep backups of important tag data

### Organization
- **Logical Grouping** - Group related tags logically
- **Clear Descriptions** - Use clear descriptions for tag purpose
- **Account Association** - Link tags to appropriate accounts
- **Regular Cleanup** - Remove unused or duplicate tags
- **Documentation** - Document tag purpose and usage

### Security
- **Access Control** - Control tag access strictly
- **Permission Management** - Manage tag permissions carefully
- **Data Protection** - Protect sensitive tag information
- **Audit Logging** - Log all tag operations

## Technical Details

### Tag Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable tag name
- **Description** - Optional tag description
- **Account ID** - Associated account identifier (optional)
- **Created At** - Tag creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Tag name
- **Sort Options** - Name, description, created date
- **Pagination** - Configurable page size and navigation

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Account Selection** - Optional account association
- **Description Management** - Optional description field
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use tags
- **[Bundle Management](./bundles.md)** - Deploy bundles to tagged devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to tagged devices

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Tag Errors** - Verify tag exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current device tag management UI and functionality.
