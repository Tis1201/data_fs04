# Resources User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Resources allow you to upload, manage, and distribute files, applications, and other assets to your IoT devices. This includes applications, configuration files, firmware updates, and any other files needed for device operation.

## Prerequisites

- **Admin permissions** - Full resource management access
- **File management** - Understanding of file types and formats
- **Storage knowledge** - Knowledge of storage requirements and limits

## Getting Started

### Quick Start
1. **Navigate to Resources** - Go to Admin → IOT → Resources
2. **Add Resource** - Click "Add Resource" button
3. **Select File** - Choose file to upload
4. **Configure Resource** - Set resource name, type, and properties
5. **Upload File** - Upload file to system
6. **Manage Resource** - Organize and manage uploaded resources

### Navigation
- **Menu Path**: Admin → IOT → Resources
- **URL**: `/admin/iot/resources`
- **Direct Access**: Click "Resources" in the IOT section

## Core Functionality

### Resource List View

#### Resource Information Display
- **Resource Name** - Human-readable resource name with clickable link
- **Resource ID** - Unique system identifier (displayed with name)
- **Type** - Resource type (File, Image, Video, Document, Binary)
- **Target** - Resource target (User, Device, Account)
- **Package Name** - Package name or "N/A"
- **Version** - Resource version or "N/A"
- **Format** - File format
- **Size** - File size in human-readable format
- **Created Date** - When resource was created (relative format)

#### Filtering and Search
- **Search by Name/Type/Package** - Find resources by name, type, or package name
- **Sort Options** - Sort by name, type, target, package name, version, format, size, created date
- **Pagination** - Navigate through multiple pages of resources

### Resource Detail View

#### Resource Information Section
- **Basic Info** - Name, ID, type, target
- **File Info** - File size, format, package name, version
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, type, target, package name, version, file upload

#### Resource Actions
- **View Resource** - Access resource details
- **Download Resource** - Download resource file (if available)
- **Delete Resource** - Remove resource (with confirmation)

## Advanced Features

### Resource Creation

#### Basic Resource Setup
- **Resource Name** - Choose descriptive name (required)
- **Resource Type** - Select type (File, Image, Video, Document, Binary)
- **Target** - Select target (User, Device, Account)
- **Package Name** - Set package name (optional)
- **Version** - Set version number (optional)
- **File Upload** - Upload resource file

#### Resource Configuration
- **Form Validation** - Real-time validation with error messages
- **File Upload** - Smart file upload with validation
- **Type Selection** - Choose appropriate resource type
- **Target Selection** - Select resource target
- **Resource Management** - Edit or delete resources

#### Resource Actions
- **View Resource** - Access resource details
- **Download Resource** - Download resource file (if available)
- **Delete Resource** - Remove resource with confirmation

### Resource Management Features

#### Quick Actions
- **View Resource** - Click resource name or view button
- **Download Resource** - Download resource file (if available)
- **Delete Resource** - Remove resource with confirmation

#### Bulk Operations
- **Search** - Find resources by name, type, or package name
- **Sorting** - Sort by name, type, target, package name, version, format, size, created date
- **Pagination** - Navigate through large resource lists

## Common Workflows

### Workflow 1: Create New Resource
1. **Navigate to Resources** - Go to Admin → IOT → Resources
2. **Click "Add Resource"** - Start resource creation process
3. **Enter Resource Details** - Fill in name, type, target, package name, version
4. **Upload File** - Upload resource file
5. **Save Resource** - Create the resource record
6. **Verify Creation** - Confirm resource is created successfully

### Workflow 2: View Resource Details
1. **Find Resource** - Use search to locate resource
2. **Click Resource Name** - Open resource detail view
3. **View Information** - Review resource details
4. **Download File** - Download resource file (if available)

### Workflow 3: Delete Resource
1. **Select Resource** - Choose resource from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm resource is removed from list

### Workflow 4: Resource Management
1. **Create Resources** - Create resources for different purposes
2. **Upload Files** - Upload resource files
3. **Organize Resources** - Organize resources by type and target
4. **Manage Resources** - Edit or delete resources as needed


## Troubleshooting

### Common Issues

#### Resource Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Resource Name** - Ensure resource name is unique and valid
- **File Upload** - Verify file upload is successful
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction

#### Resource Management Issues
- **Cannot View Resource** - Check admin permissions and resource status
- **Delete Failed** - Check if resource is in use or has dependencies
- **Resource Not Found** - Verify resource exists and is accessible
- **Download Failed** - Check if resource file is available

### Error Messages

#### "Resource Not Found"
- **Cause**: Resource ID doesn't exist in system
- **Solution**: Verify resource ID and check resource list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "File Upload Failed"
- **Cause**: File upload failed
- **Solution**: Check file size, format, and network connection

## Best Practices

### Resource Design
- **Descriptive Names** - Use clear, descriptive resource names
- **Consistent Naming** - Use consistent naming conventions
- **Helpful Descriptions** - Add descriptions for resource purpose
- **Type Selection** - Choose appropriate resource type
- **Target Selection** - Select appropriate resource target

### Resource Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Resource Usage** - Verify resources work with device assignment
- **Backup Data** - Keep backups of important resource data

### Organization
- **Logical Grouping** - Group related resources logically
- **Clear Descriptions** - Use clear descriptions for resource purpose
- **Type Organization** - Organize resources by type
- **Regular Cleanup** - Remove unused or duplicate resources
- **Documentation** - Document resource purpose and usage

### Security
- **Access Control** - Control resource access strictly
- **Permission Management** - Manage resource permissions carefully
- **Data Protection** - Protect sensitive resource information
- **Audit Logging** - Log all resource operations

## Technical Details

### Resource Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable resource name
- **Type** - Resource type (File, Image, Video, Document, Binary)
- **Target** - Resource target (User, Device, Account)
- **Package Name** - Optional package name
- **Version** - Optional version number
- **Format** - File format
- **Size** - File size in bytes
- **Path** - File storage path
- **Created At** - Resource creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Resource name, type, package name
- **Sort Options** - Name, type, target, package name, version, format, size, created date
- **Pagination** - Configurable page size and navigation

### Form Features
- **Real-time Validation** - Form validation with error messages
- **File Upload** - Smart file upload with validation
- **Type Selection** - Resource type selection
- **Target Selection** - Resource target selection
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Bundle Management](./bundles.md)** - Use resources in bundles
- **[Device Management](./devices.md)** - Distribute resources to devices
- **[Device Profiles](./device_profiles.md)** - Include resources in profiles
- **[Device Tags](./device_tags.md)** - Organize devices for resource distribution

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Resource Errors** - Verify resource exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current resource management UI and functionality.
