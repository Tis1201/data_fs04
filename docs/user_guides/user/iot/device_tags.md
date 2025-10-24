# User Device Tags Guide

**Last Updated**: 2025-10-12  
**Audience**: End Users  
**Complexity**: Beginner

## Overview

The **User Device Tags** feature allows you to organize and categorize your IoT devices using custom tags. You can create tags, assign them to devices, and use them for filtering, searching, and bulk operations across your device fleet.

## Prerequisites

- **User account** - Valid user account with device access permissions
- **Device access** - Access to devices for tagging
- **Basic organization** - Understanding of device categorization

## Getting Started

### Quick Start
1. **Access Device Tags** - Navigate to User → IoT → Device Tags
2. **Create Tags** - Create custom tags for device organization
3. **Assign Tags** - Assign tags to devices
4. **Filter Devices** - Use tags to filter and search devices
5. **Bulk Operations** - Perform bulk operations on tagged devices

### Navigation
- **Menu Path**: User → IoT → Device Tags
- **URL**: `/user/iot/device_tags`
- **Direct Access**: Click "Device Tags" in the IoT section

## Core Functionality

### Tag Management

#### Tag Creation
- **Tag Name** - Descriptive name for the tag
- **Tag Description** - Detailed description of tag purpose
- **Tag Color** - Visual color for tag identification
- **Tag Category** - Category for tag organization
- **Tag Priority** - Priority level for tag importance
- **Tag Visibility** - Public or private tag visibility

#### Tag Information
- **Tag ID** - Unique tag identifier
- **Creation Date** - When the tag was created
- **Last Modified** - Last modification date
- **Device Count** - Number of devices using this tag
- **Usage Statistics** - How frequently the tag is used
- **Tag Hierarchy** - Parent-child tag relationships

#### Tag Status Indicators
- 🟢 **Active** - Tag is active and available for use
- 🔴 **Inactive** - Tag is inactive and not available
- 🟡 **Pending** - Tag is pending approval
- 🔵 **System** - System-generated tag
- ⚪ **Custom** - User-created custom tag
- 🟠 **Archived** - Tag is archived and read-only

### Device Tagging

#### Tag Assignment
- **Single Device** - Assign tags to individual devices
- **Multiple Devices** - Assign tags to multiple devices
- **Bulk Assignment** - Assign tags to devices in bulk
- **Tag Removal** - Remove tags from devices
- **Tag Replacement** - Replace existing tags with new ones
- **Tag Validation** - Validate tag assignments

#### Tag Operations
- **Add Tags** - Add new tags to devices
- **Remove Tags** - Remove tags from devices
- **Update Tags** - Update existing tag assignments
- **Copy Tags** - Copy tags from one device to another
- **Merge Tags** - Merge similar tags together
- **Split Tags** - Split tags into multiple tags

### Tag-Based Operations

#### Device Filtering
- **Filter by Tag** - Show only devices with specific tags
- **Filter by Multiple Tags** - Show devices with multiple tags
- **Exclude Tags** - Exclude devices with specific tags
- **Tag Combinations** - Use AND/OR logic for tag filtering
- **Saved Filters** - Save frequently used tag filters
- **Filter History** - View previous filter selections

#### Bulk Operations
- **Bulk Tag Assignment** - Assign tags to multiple devices
- **Bulk Tag Removal** - Remove tags from multiple devices
- **Bulk Device Actions** - Perform actions on tagged devices
- **Bulk Configuration** - Apply configurations to tagged devices
- **Bulk Monitoring** - Monitor tagged devices together
- **Bulk Reporting** - Generate reports for tagged devices

## Advanced Features

### Tag Organization

#### Tag Categories
- **Location Tags** - Office, Warehouse, Remote, etc.
- **Function Tags** - Kiosk, Display, Sensor, etc.
- **Status Tags** - Active, Maintenance, Testing, etc.
- **Priority Tags** - Critical, High, Medium, Low
- **Department Tags** - IT, Operations, Security, etc.
- **Custom Categories** - User-defined categories

#### Tag Hierarchy
- **Parent Tags** - Main category tags
- **Child Tags** - Sub-category tags
- **Tag Inheritance** - Child tags inherit parent properties
- **Tag Dependencies** - Tags that depend on other tags
- **Tag Relationships** - Related tag connections
- **Tag Validation** - Validate tag hierarchy

#### Tag Templates
- **Pre-Built Templates** - Common tag combinations
- **Custom Templates** - User-defined tag templates
- **Template Application** - Apply templates to devices
- **Template Modification** - Modify existing templates
- **Template Sharing** - Share templates with team
- **Template Versioning** - Version control for templates

### Tag Analytics

#### Tag Usage Statistics
- **Most Used Tags** - Tags used most frequently
- **Tag Growth** - How tag usage changes over time
- **Device Distribution** - How devices are distributed across tags
- **Tag Efficiency** - How effectively tags are used
- **Tag Trends** - Trends in tag usage patterns
- **Tag Performance** - Performance metrics for tags

#### Tag Reports
- **Tag Summary** - Summary of all tags and usage
- **Device Tag Report** - Report of device tag assignments
- **Tag Usage Report** - Detailed tag usage statistics
- **Tag Performance Report** - Tag performance analysis
- **Tag Audit Report** - Audit trail of tag changes
- **Custom Reports** - User-defined tag reports

## Common Workflows

### Workflow 1: Create and Assign Tags
1. **Create Tags** - Create new tags for device organization
2. **Define Categories** - Organize tags into categories
3. **Assign to Devices** - Assign tags to appropriate devices
4. **Validate Assignments** - Verify tag assignments are correct
5. **Test Filtering** - Test tag-based filtering
6. **Document Usage** - Document tag usage and purpose
7. **Share with Team** - Share tag structure with team

### Workflow 2: Bulk Device Tagging
1. **Select Devices** - Choose devices for bulk tagging
2. **Choose Tags** - Select tags to assign
3. **Review Assignment** - Review tag assignments
4. **Execute Assignment** - Apply tags to selected devices
5. **Verify Results** - Confirm tags were applied correctly
6. **Update Documentation** - Update device documentation
7. **Monitor Usage** - Monitor tag usage and effectiveness

### Workflow 3: Tag-Based Device Management
1. **Filter by Tags** - Filter devices using tags
2. **Select Tagged Devices** - Choose devices from filtered results
3. **Perform Actions** - Execute actions on tagged devices
4. **Monitor Progress** - Watch action progress
5. **Handle Issues** - Address any issues that arise
6. **Verify Results** - Confirm actions completed successfully
7. **Update Tags** - Update tags based on results

### Workflow 4: Tag Maintenance
1. **Review Tag Usage** - Analyze tag usage statistics
2. **Identify Unused Tags** - Find tags that are not being used
3. **Clean Up Tags** - Remove or archive unused tags
4. **Optimize Structure** - Improve tag organization
5. **Update Documentation** - Update tag documentation
6. **Train Users** - Train users on updated tag structure
7. **Monitor Adoption** - Monitor adoption of new structure

## Tag Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Tag Assignment Timeout: 30 Seconds**
- **Per Device**: Each device tag assignment has a **30-second timeout**
- **Timeout Behavior**: If assignment takes too long → **FAILED**
- **Retry Logic**: Failed assignments are retried up to 2 times
- **Total Assignment Timeout**: 90 seconds for complete assignment (2 retries)

#### **Bulk Tag Operation Timeout: 5 Minutes**
- **Per Bulk Operation**: Each bulk operation has a **5-minute timeout**
- **Timeout Behavior**: If bulk operation takes too long → **FAILED**
- **Retry Logic**: Failed bulk operations are retried up to 2 times
- **Total Bulk Timeout**: 15 minutes for complete bulk operation

#### **Tag Filter Timeout: 10 Seconds**
- **Per Filter**: Each tag filter has a **10-second timeout**
- **Timeout Behavior**: If filter takes too long → **SHOW PARTIAL RESULTS**
- **Fallback**: Display cached results if filter fails
- **Retry Logic**: Failed filters are retried up to 2 times

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Tags Assigned**: Tags assigned successfully to devices
- **Filter Applied**: Tag filter applied successfully
- **Bulk Operation Complete**: Bulk operation completed successfully
- **No Errors**: No errors in tag operations

##### ❌ **Failure Cases**
- **Assignment Timeout**: Tag assignment took too long
- **Bulk Operation Timeout**: Bulk operation took too long
- **Filter Timeout**: Tag filter took too long
- **Permission Denied**: Insufficient permissions for tag operations

### 📊 **Tag Operations Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Tag           │    │   Device         │    │  Tag            │
│   Assignment    │───▶│   Selection      │───▶│   Application   │
│   Request       │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Tag            │◀───│  Tag             │◀───│  Tag            │
│   Assignment    │    │   Processing     │    │   Validation    │
│   Complete      │    │  (30sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Device         │◀───│  Tag             │◀───│  Tag            │
│   Updated       │    │   Filter         │    │   Search        │
│                 │    │  (10sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Tag Operations Process**

#### **Step 1: Tag Assignment**
```
Tag Assignment:
├── Start 30-second Timer
├── Validate Tag Assignment
├── Apply Tag to Device
├── Update Device Record
└── Confirm Assignment
```

#### **Step 2: Tag Filtering**
```
Tag Filtering:
├── Start 10-second Timer
├── Parse Filter Criteria
├── Execute Database Query
├── Process Results
└── Return Filtered Devices
```

#### **Step 3: Bulk Operations**
```
Bulk Operations:
├── Start 5-minute Timer
├── Validate Bulk Operation
├── Process Multiple Devices
├── Update Device Records
└── Confirm Completion
```

## 📋 **Real-World Example: Office Device Tagging**

### **Example Tagging: "Office Device Organization"**
- **Tags**: Location, Function, Priority, Department
- **Devices**: 10 office devices
- **Purpose**: Organize office devices for better management

### **Timeline & Expected Behavior**

#### **T+0:00 - Tag Creation**
```
Tag Creation:
├── Location Tags: Office, Conference Room, Reception
├── Function Tags: Kiosk, Display, Workstation
├── Priority Tags: Critical, High, Medium, Low
├── Department Tags: IT, HR, Finance, Operations
└── Status: TAGS_CREATED
```

#### **T+0:05 - Device Selection**
```
Device Selection:
├── Select Devices: 10 office devices
├── Review Device List: All devices online
├── Prepare Tag Assignment
└── Status: DEVICES_SELECTED
```

#### **T+0:10 - Tag Assignment**
```
Tag Assignment:
├── Start 30-second Timer
├── Assign Location Tags: Office (8), Conference Room (2)
├── Assign Function Tags: Workstation (6), Kiosk (2), Display (2)
├── Assign Priority Tags: High (3), Medium (5), Low (2)
└── Status: TAGS_ASSIGNING
```

#### **T+0:15 - Assignment Complete**
```
Assignment Complete:
├── All Tags Assigned: SUCCESS
├── Assignment Time: 5 seconds per device
├── Total Time: 15 seconds
├── Devices Tagged: 10/10
└── Status: COMPLETE
```

#### **T+0:20 - Tag Filtering Test**
```
Tag Filtering Test:
├── Filter by Location: Office (8 devices)
├── Filter by Function: Workstation (6 devices)
├── Filter by Priority: High (3 devices)
├── Filter by Department: IT (4 devices)
└── Status: FILTERING_SUCCESS
```

### **Total Tagging Time: 20 seconds**
- **Tag Creation**: 5 seconds
- **Device Selection**: 5 seconds
- **Tag Assignment**: 15 seconds
- **Filtering Test**: 5 seconds
- **Within 30-second assignment timeout**

### **Bulk Tag Operation Example**

#### **T+0:00 - Bulk Operation Start**
```
Bulk Operation:
├── Operation: Assign "Maintenance" tag
├── Target Devices: 5 devices
├── Start 5-minute Timer
└── Status: BULK_OPERATION_STARTED
```

#### **T+0:10 - Bulk Processing**
```
Bulk Processing:
├── Device 1: Tag assigned (2 seconds)
├── Device 2: Tag assigned (2 seconds)
├── Device 3: Tag assigned (2 seconds)
├── Device 4: Tag assigned (2 seconds)
└── Device 5: Tag assigned (2 seconds)
```

#### **T+0:15 - Bulk Complete**
```
Bulk Complete:
├── All Devices Tagged: SUCCESS
├── Total Time: 15 seconds
├── Devices Processed: 5/5
└── Status: BULK_OPERATION_COMPLETE
```

### **Failure Scenario Example**

#### **T+0:00 - Tag Assignment Request**
```
Tag Assignment:
├── Tag: "Critical" priority tag
├── Device: Office-001
├── Start 30-second Timer
└── Status: ASSIGNING
```

#### **T+0:15 - Assignment Processing**
```
Assignment Processing:
├── Device Status: ONLINE
├── Tag Validation: VALID
├── Assignment: In progress
└── Status: PROCESSING
```

#### **T+0:30 - Assignment Timeout**
```
Assignment Timeout:
├── 30-second timer elapsed
├── Assignment: Still processing
├── Status: TIMEOUT
└── Retry Attempt 1
```

#### **T+0:35 - Retry Attempt**
```
Retry Attempt:
├── Start new 30-second Timer
├── Retry tag assignment
├── Device Status: Still ONLINE
└── Status: RETRYING
```

#### **T+1:05 - Retry Timeout**
```
Retry Timeout:
├── 30-second timer elapsed (retry 1)
├── Assignment: Still processing
├── Status: TIMEOUT
└── Retry Attempt 2
```

#### **T+1:10 - Final Retry**
```
Final Retry:
├── Start new 30-second Timer
├── Retry tag assignment
├── Device Status: Still ONLINE
└── Status: RETRYING
```

#### **T+1:40 - Final Timeout**
```
Final Timeout:
├── 30-second timer elapsed (retry 2)
├── Assignment: Still processing
├── Status: FAILED
└── Error: "Tag assignment timeout after 3 attempts"
```

## Troubleshooting

### Common Issues

#### Tag Assignment Problems
- **Check Device Status** - Verify device is online
- **Check Tag Validity** - Verify tag exists and is valid
- **Check Permissions** - Verify user has tag assignment permissions
- **Check Device Capacity** - Ensure device can accept more tags
- **Check Network** - Verify network connectivity
- **Check Logs** - Review tag assignment logs

#### Tag Filtering Issues
- **Check Filter Syntax** - Verify filter syntax is correct
- **Check Tag Names** - Verify tag names are spelled correctly
- **Check Tag Status** - Ensure tags are active
- **Check Device Tags** - Verify devices have the expected tags
- **Check Database** - Verify database connectivity
- **Check Logs** - Review filtering logs

#### Bulk Operation Failures
- **Check Device List** - Verify all devices are valid
- **Check Operation Size** - Ensure operation size is reasonable
- **Check System Load** - Monitor system performance
- **Check Network** - Verify network connectivity
- **Check Permissions** - Verify bulk operation permissions
- **Check Logs** - Review bulk operation logs

### Error Messages

#### "Tag Assignment Failed"
- **Cause**: Unable to assign tag to device
- **Solution**: Check device status and tag validity

#### "Tag Filter Timeout"
- **Cause**: Tag filter took too long to execute
- **Solution**: Simplify filter criteria or try again

#### "Bulk Operation Failed"
- **Cause**: Bulk operation failed
- **Solution**: Check device list and system status

#### "Permission Denied"
- **Cause**: Insufficient permissions for tag operations
- **Solution**: Contact administrator for access

#### "Tag Not Found"
- **Cause**: Specified tag does not exist
- **Solution**: Check tag name or create the tag

## Best Practices

### Tag Design
- **Consistent Naming** - Use consistent tag naming conventions
- **Logical Categories** - Organize tags into logical categories
- **Clear Descriptions** - Provide clear tag descriptions
- **Color Coding** - Use colors for visual identification
- **Hierarchy** - Use tag hierarchy for organization
- **Documentation** - Document tag usage and purpose

### Tag Management
- **Regular Review** - Review tag usage regularly
- **Clean Up** - Remove unused or obsolete tags
- **Standardization** - Standardize tag usage across team
- **Training** - Train users on tag usage
- **Monitoring** - Monitor tag usage and effectiveness
- **Feedback** - Collect feedback on tag structure

### Tag Operations
- **Batch Operations** - Use bulk operations for efficiency
- **Validation** - Validate tag assignments before applying
- **Testing** - Test tag operations on small groups first
- **Monitoring** - Monitor tag operation performance
- **Error Handling** - Handle tag operation errors gracefully
- **Documentation** - Document tag operation procedures

## Related Features

- **[Devices](./devices.md)** - Device management and monitoring
- **[Device Profiles](./device_profiles.md)** - Device configuration management
- **[Bundles](./bundles.md)** - Application installation and management
- **[Logs](./logs.md)** - Tag operation logs and diagnostics
- **[Dashboard](./dashboard.md)** - Tag usage overview

## API Reference

### Tag Management API
- **GET /api/user/iot/device-tags** - Get tag list
- **POST /api/user/iot/device-tags** - Create new tag
- **GET /api/user/iot/device-tags/{id}** - Get tag details
- **PUT /api/user/iot/device-tags/{id}** - Update tag
- **DELETE /api/user/iot/device-tags/{id}** - Delete tag

### Tag Assignment API
- **POST /api/user/iot/device-tags/assign** - Assign tags to devices
- **DELETE /api/user/iot/device-tags/assign** - Remove tags from devices
- **GET /api/user/iot/device-tags/devices** - Get devices by tags
- **POST /api/user/iot/device-tags/bulk** - Bulk tag operations

### Tag Filtering API
- **GET /api/user/iot/device-tags/filter** - Filter devices by tags
- **POST /api/user/iot/device-tags/search** - Search tags
- **GET /api/user/iot/device-tags/stats** - Get tag statistics
- **GET /api/user/iot/device-tags/reports** - Generate tag reports

## Support

### Getting Help
- **In-App Help** - Use the help system within the device tags page
- **Documentation** - Check the comprehensive user guides
- **Support Portal** - Access the support system
- **Community** - Join the user community for help

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of user device tagging from creation to assignment and management.
