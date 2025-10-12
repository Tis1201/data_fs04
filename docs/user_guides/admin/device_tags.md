# Device Tags User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Beginner

## Overview

Device Tags provide a flexible system for organizing and categorizing your IoT devices. Tags allow you to group devices by location, function, department, or any other criteria, making it easier to manage large device fleets and perform bulk operations.

## Prerequisites

- **Admin permissions** - Full device tag management access
- **Device access** - Access to devices for tagging
- **Organization planning** - Plan for device organization structure
- **Tag strategy** - Define tagging strategy and conventions

## Getting Started

### Quick Start
1. **Navigate to Device Tags** - Go to Admin → IOT → Device Tags
2. **Create New Tag** - Click "Create Tag" button
3. **Configure Tag** - Set up tag name, color, and properties
4. **Assign to Devices** - Apply tags to target devices
5. **Use for Filtering** - Filter devices by tags
6. **Perform Bulk Operations** - Execute operations on tagged devices

### Navigation
- **Menu Path**: Admin → IOT → Device Tags
- **URL**: `/admin/iot/device_tags`
- **Direct Access**: Click "Device Tags" in the IOT section

## Core Functionality

### Tag List View

#### Tag Information Display
- **Tag Name** - Human-readable tag name
- **Tag ID** - Unique system identifier
- **Color** - Visual tag color indicator
- **Category** - Tag category/type
- **Created Date** - When tag was created
- **Last Modified** - Last update timestamp
- **Device Count** - Number of devices with this tag
- **Usage** - Tag usage statistics

#### Tag Status Indicators
- 🟢 **Active** - Tag is active and available
- 🔴 **Inactive** - Tag is disabled
- 🟡 **Draft** - Tag is being created/modified
- ⚪ **Archived** - Tag is archived

#### Filtering and Search
- **Search by Name** - Find tags by name
- **Filter by Category** - Show tags by category
- **Filter by Status** - Show only active/inactive tags
- **Filter by Usage** - Show tags by usage frequency
- **Sort Options** - Sort by name, category, usage, date, etc.

### Tag Detail View

#### Tag Information Tab
- **Basic Info** - Name, ID, description, color
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, usage statistics
- **Category Info** - Tag category and type

#### Tag Configuration Tab
- **Tag Properties** - Tag-specific properties
- **Tag Rules** - Tag assignment rules
- **Tag Validation** - Tag validation settings
- **Tag Permissions** - Tag access permissions
- **Tag Metadata** - Additional tag metadata

#### Device Assignment Tab
- **Tagged Devices** - Devices with this tag
- **Assignment History** - Tag assignment history
- **Assignment Status** - Current assignment status
- **Assignment Management** - Manage device assignments

#### Tag Usage Tab
- **Usage Statistics** - Tag usage analytics
- **Usage History** - Historical usage data
- **Usage Patterns** - Tag usage patterns
- **Usage Reports** - Tag usage reports

## Advanced Features

### Tag Creation

#### Basic Tag Setup
- **Tag Name** - Choose descriptive name
- **Description** - Add detailed description
- **Color** - Select visual color indicator
- **Category** - Assign tag category
- **Icon** - Choose tag icon (optional)

#### Tag Properties
- **Tag Type** - Set tag type (location, function, department, etc.)
- **Tag Value** - Set tag value (optional)
- **Tag Metadata** - Add custom metadata
- **Tag Rules** - Set tag assignment rules
- **Tag Validation** - Configure tag validation

#### Tag Categories
- **Location Tags** - Physical location tags
- **Function Tags** - Device function tags
- **Department Tags** - Organizational department tags
- **Status Tags** - Device status tags
- **Custom Tags** - Custom tag categories

### Tag Management

#### Tag Organization
- **Tag Hierarchy** - Create tag hierarchies
- **Tag Groups** - Group related tags
- **Tag Relationships** - Define tag relationships
- **Tag Dependencies** - Set tag dependencies
- **Tag Inheritance** - Configure tag inheritance

#### Tag Assignment
- **Individual Assignment** - Assign tags to individual devices
- **Bulk Assignment** - Assign tags to multiple devices
- **Auto Assignment** - Automatic tag assignment based on rules
- **Assignment Validation** - Validate tag assignments
- **Assignment History** - Track assignment history

#### Tag Operations
- **Tag Filtering** - Filter devices by tags
- **Tag Search** - Search devices by tags
- **Tag Grouping** - Group devices by tags
- **Tag Sorting** - Sort devices by tags
- **Tag Export** - Export device lists by tags

### Tag Analytics

#### Usage Analytics
- **Tag Usage Statistics** - Track tag usage frequency
- **Tag Usage Trends** - Analyze tag usage trends
- **Tag Usage Patterns** - Identify usage patterns
- **Tag Usage Reports** - Generate usage reports
- **Tag Usage Optimization** - Optimize tag usage

#### Performance Analytics
- **Tag Performance** - Monitor tag performance
- **Tag Efficiency** - Analyze tag efficiency
- **Tag Optimization** - Optimize tag structure
- **Tag Recommendations** - Get tag recommendations
- **Tag Best Practices** - Follow tag best practices

## Common Workflows

### Workflow 1: Create and Assign Tags
1. **Create Tag** - Set up new tag with name and properties
2. **Configure Tag** - Set tag category, color, and rules
3. **Select Devices** - Choose devices to tag
4. **Assign Tags** - Apply tags to selected devices
5. **Verify Assignment** - Confirm tags are applied correctly
6. **Test Filtering** - Test device filtering by tags
7. **Document Usage** - Document tag usage and purpose

### Workflow 2: Organize Device Fleet
1. **Plan Tag Structure** - Design tag organization structure
2. **Create Tag Categories** - Set up tag categories
3. **Create Tags** - Create tags for each category
4. **Assign Tags** - Apply tags to devices
5. **Verify Organization** - Confirm device organization
6. **Test Operations** - Test bulk operations on tagged devices
7. **Maintain Tags** - Keep tags updated and organized

### Workflow 3: Bulk Device Operations
1. **Select Tag** - Choose tag for bulk operations
2. **Filter Devices** - Filter devices by tag
3. **Review Selection** - Review selected devices
4. **Choose Operation** - Select bulk operation to perform
5. **Execute Operation** - Execute operation on tagged devices
6. **Monitor Progress** - Track operation progress
7. **Verify Results** - Confirm operation results

### Workflow 4: Tag Maintenance
1. **Review Tags** - Review existing tags
2. **Identify Issues** - Identify tag problems
3. **Update Tags** - Update tag information
4. **Clean Up Tags** - Remove unused or duplicate tags
5. **Reorganize Tags** - Reorganize tag structure
6. **Test Changes** - Test tag changes
7. **Document Changes** - Document tag changes

## Troubleshooting

### Common Issues

#### Tag Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Tag Name** - Ensure tag name is unique and valid
- **Check Tag Properties** - Verify tag properties are valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Validation** - Run tag validation

#### Tag Assignment Failures
- **Check Device Status** - Ensure devices are available
- **Check Tag Status** - Verify tag is active
- **Check Assignment Rules** - Verify assignment rules
- **Check Permissions** - Verify assignment permissions
- **Check Logs** - Review assignment logs

#### Tag Filtering Issues
- **Check Tag Assignment** - Verify tags are assigned correctly
- **Check Filter Logic** - Verify filter logic is correct
- **Check Tag Status** - Ensure tags are active
- **Check Device Status** - Verify device status
- **Check Logs** - Review filtering logs

#### Tag Performance Issues
- **Check Tag Count** - Monitor number of tags
- **Check Assignment Count** - Monitor tag assignments
- **Check Filter Complexity** - Simplify complex filters
- **Check System Resources** - Monitor system resources
- **Check Logs** - Review performance logs

### Error Messages

#### "Tag Not Found"
- **Cause**: Tag ID doesn't exist in system
- **Solution**: Verify tag ID and check tag list

#### "Tag Name Already Exists"
- **Cause**: Tag name is already in use
- **Solution**: Choose a different tag name

#### "Tag Assignment Failed"
- **Cause**: Tag assignment failed
- **Solution**: Check device status and assignment logs

#### "Tag Filter Error"
- **Cause**: Tag filter is invalid
- **Solution**: Fix filter logic and retry

#### "Tag Validation Error"
- **Cause**: Tag validation failed
- **Solution**: Fix validation errors and retry

## Best Practices

### Tag Design
- **Consistent Naming** - Use consistent naming conventions
- **Clear Categories** - Create clear tag categories
- **Descriptive Names** - Use descriptive tag names
- **Color Coding** - Use colors for visual organization
- **Documentation** - Document tag purpose and usage

### Tag Organization
- **Hierarchical Structure** - Use hierarchical tag structure
- **Logical Grouping** - Group related tags logically
- **Minimal Overlap** - Minimize tag overlap and confusion
- **Regular Review** - Regularly review and update tags
- **Clean Up** - Remove unused or duplicate tags

### Tag Usage
- **Consistent Application** - Apply tags consistently
- **Bulk Operations** - Use tags for bulk operations
- **Filtering** - Use tags for device filtering
- **Reporting** - Use tags for reporting and analytics
- **Automation** - Use tags for automation

### Performance
- **Tag Limits** - Monitor tag count and limits
- **Assignment Limits** - Monitor tag assignment limits
- **Filter Optimization** - Optimize tag filtering
- **Indexing** - Use proper indexing for tag operations
- **Caching** - Use caching for frequently used tags

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use tags
- **[Bundle Management](./bundles.md)** - Deploy bundles to tagged devices
- **[Device Profiles](./device_profiles.md)** - Apply profiles to tagged devices
- **[PIN Rules](./pin_rules.md)** - Apply PIN rules to tagged devices
- **[Preclaims](./preclaims.md)** - Organize preclaims with tags

## API Reference

### Tag Management API
- **GET /api/admin/iot/device_tags** - List all device tags
- **POST /api/admin/iot/device_tags** - Create new device tag
- **GET /api/admin/iot/device_tags/{id}** - Get device tag details
- **PUT /api/admin/iot/device_tags/{id}** - Update device tag
- **DELETE /api/admin/iot/device_tags/{id}** - Delete device tag

### Tag Assignment API
- **POST /api/admin/iot/device_tags/{id}/assign** - Assign tag to devices
- **GET /api/admin/iot/device_tags/{id}/assignments** - Get assignment history
- **PUT /api/admin/iot/device_tags/{id}/assignments/{deviceId}** - Update assignment
- **DELETE /api/admin/iot/device_tags/{id}/assignments/{deviceId}** - Remove assignment

### Tag Operations API
- **GET /api/admin/iot/device_tags/{id}/devices** - Get devices with tag
- **POST /api/admin/iot/device_tags/{id}/filter** - Filter devices by tag
- **GET /api/admin/iot/device_tags/{id}/analytics** - Get tag analytics
- **GET /api/admin/iot/device_tags/{id}/usage** - Get tag usage statistics

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Tag Logs** - Review tag operation logs
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of device tag management from creation to usage and troubleshooting.
