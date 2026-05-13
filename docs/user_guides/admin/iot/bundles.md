# Bundle Management User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Bundle Management allows you to create, deploy, and monitor application bundles across your IoT devices. Bundles are collections of applications that can be installed together on devices, making it easy to deploy software packages and manage device configurations.

## Prerequisites

- **Admin permissions** - Full bundle management access
- **Applications** - Apps must be available in the system
- **Devices** - Target devices must be registered and online

## Getting Started

### Quick Start
1. **Navigate to Bundles** - Go to Admin → IOT → Bundles
2. **Add Bundle** - Click "Add Bundle" button
3. **Configure Bundle** - Set bundle name, version, and settings
4. **Deploy to Devices** - Choose target devices for deployment
5. **Monitor Progress** - Track installation progress

### Navigation
- **Menu Path**: Admin → IOT → Bundles
- **URL**: `/admin/iot/bundles`
- **Direct Access**: Click "Bundles" in the IOT section

## Core Functionality

### Bundle List View

#### Bundle Information Display
- **Bundle Name** - Human-readable bundle name with clickable link
- **Bundle ID** - Unique system identifier (displayed with name)
- **Version** - Bundle version number or "N/A"
- **Status** - Bundle status with color indicators (Draft, Published, In Progress, Cancelled, Completed, Failed)
- **Scheduled** - Scheduled deployment date (relative format)
- **Created Date** - When bundle was created (relative format)

#### Bundle Status Indicators
- 🟡 **Draft** - Bundle is being created/modified
- 🔵 **Published** - Bundle is ready for deployment
- 🔵 **In Progress** - Bundle is currently being deployed
- 🔴 **Cancelled** - Bundle deployment was cancelled
- 🟢 **Completed** - Bundle deployment completed successfully
- 🔴 **Failed** - Bundle deployment failed

#### Filtering and Search
- **Search by Name** - Find bundles by name
- **Filter by Status** - Show bundles by status (Draft, Published, Cancelled, Completed, Failed)
- **Filter by OS** - Show bundles by operating system (Android, iOS)
- **Sort Options** - Sort by name, version, status, scheduled date, created date
- **Pagination** - Navigate through multiple pages of bundles

### Bundle Detail View

#### Bundle Information Section
- **Basic Info** - Name, ID, version, status
- **Scheduling** - Scheduled deployment date and time
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, version, description, scheduling options

#### Bundle Actions
- **Edit Bundle** - Modify bundle details
- **Delete Bundle** - Remove bundle (with confirmation)
- **Deploy Bundle** - Deploy bundle to devices (for Draft bundles)
- **View Details** - Access full bundle information

## Advanced Features

### Bundle Creation

#### Basic Bundle Setup
- **Bundle Name** - Choose descriptive name (required)
- **Version** - Set version number (optional)
- **Description** - Add detailed description (optional)
- **Scheduling** - Set scheduled deployment date and time
- **Form Validation** - Real-time validation with error messages

#### Bundle Configuration
- **Form Validation** - Real-time validation with error messages
- **Scheduling Options** - Set deployment date and time
- **Bundle Management** - Edit or delete bundles
- **Status Management** - Track bundle status (Draft, Published, etc.)

#### Bundle Actions
- **Edit Bundle** - Modify bundle details
- **Delete Bundle** - Remove bundle with confirmation
- **Deploy Bundle** - Deploy bundle to devices (for Draft bundles)
- **View Details** - Access full bundle information

### Bundle Management Features

#### Quick Actions
- **Edit Bundle** - Click bundle name or edit button
- **Delete Bundle** - Remove bundle with confirmation
- **Deploy Bundle** - Deploy bundle to devices (for Draft bundles)
- **View Details** - Access full bundle management

#### Bulk Operations
- **Search** - Find bundles by name
- **Sorting** - Sort by name, version, status, scheduled date, created date
- **Pagination** - Navigate through large bundle lists
- **Filtering** - Filter by status and operating system

## Bundle Timeout & Flow Information

### ⏱️ **Critical Timeout Information**

#### **Bundle Wave Timeout: 10 Minutes**
- **Per Wave**: Each deployment wave has a **10-minute timeout**
- **Per App**: Each application within a wave has a **10-minute timeout**
- **Total Bundle Timeout**: `max(10 minutes, number_of_apps × 10 minutes)`
- **Timeout Behavior**: If deployment takes too long → **FAILED**

#### **Bundle Status Flow**
1. **DRAFT** → **PUBLISHED** (when published)
2. **PUBLISHED** → **IN_PROGRESS** (when deployment starts)
3. **IN_PROGRESS** → **COMPLETED** (all waves successful)
4. **IN_PROGRESS** → **FAILED** (any wave fails)
5. **IN_PROGRESS** → **CANCELLED** (deployment cancelled)

### 📊 **Bundle Deployment Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Publishes│    │   Bundle Status  │    │  Wave Creation  │
│     Bundle      │───▶│   PUBLISHED      │───▶│   & Dispatch    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Bundle Status  │◀───│  Wave Status     │◀───│  Device Install │
│  IN_PROGRESS    │    │  IN_PROGRESS     │    │  (10min timeout)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Bundle Status  │◀───│  Wave Status     │◀───│  Device Response│
│  COMPLETED      │    │  COMPLETED       │    │  Success/Failure│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Bundle Flow Process**

#### **Step 1: Bundle Publishing**
```
Admin Action: Publish Bundle
├── Bundle Status: DRAFT → PUBLISHED
├── Wave Creation: Create deployment waves
├── Device Dispatch: Send to target devices
└── Start Timeout Timer
```

#### **Step 2: Wave Deployment**
```
Wave Deployment:
├── Wave Status: PENDING → IN_PROGRESS
├── Bundle Status: PUBLISHED → IN_PROGRESS
├── Device Installation: 10 minutes per app
├── Monitor Progress: Track device responses
└── Update Status: Based on device responses
```

#### **Step 3: Bundle Completion**
```
All Waves Processed:
├── All Success → Bundle Status: COMPLETED
├── Any Failed → Bundle Status: FAILED
├── Cancelled → Bundle Status: CANCELLED
└── Timeout → Bundle Status: FAILED
```

### 📋 **Real-World Example: Bundle Deployment**

#### **Example Bundle: "Office Apps Bundle"**
- **Bundle ID**: `bundle_office_001`
- **Apps**: 3 applications (Word, Excel, PowerPoint)
- **Target Devices**: 5 devices
- **Expected Timeout**: `max(10 minutes, 3 apps × 10 minutes) = 30 minutes`

#### **Timeline & Expected Behavior**

##### **T+0:00 - Bundle Publishing**
```
Admin Action: Publish "Office Apps Bundle"
├── Bundle Status: DRAFT → PUBLISHED
├── Wave Creation: Create wave for 5 devices
├── Device Dispatch: Send bundle to all devices
└── Start 30-minute Timer
```

##### **T+0:01 - Wave Deployment Start**
```
Wave Status: PENDING → IN_PROGRESS
├── Bundle Status: PUBLISHED → IN_PROGRESS
├── Device 1: Installing 3 apps (30min timeout)
├── Device 2: Installing 3 apps (30min timeout)
├── Device 3: Installing 3 apps (30min timeout)
├── Device 4: Installing 3 apps (30min timeout)
└── Device 5: Installing 3 apps (30min timeout)
```

##### **T+0:15 - Device Responses**
```
Device Responses:
├── Device 1: SUCCESS (all 3 apps installed)
├── Device 2: SUCCESS (all 3 apps installed)
├── Device 3: IN_PROGRESS (installing apps)
├── Device 4: IN_PROGRESS (installing apps)
└── Device 5: IN_PROGRESS (installing apps)
```

##### **T+0:25 - All Devices Complete**
```
All Devices Complete:
├── Device 3: SUCCESS (all 3 apps installed)
├── Device 4: SUCCESS (all 3 apps installed)
├── Device 5: SUCCESS (all 3 apps installed)
├── Wave Status: IN_PROGRESS → COMPLETED
└── Bundle Status: IN_PROGRESS → COMPLETED
```

### **Total Deployment Time: 25 minutes**
- **Within 30-minute bundle timeout**
- **All devices successful**

#### **Failure Scenario Example**

##### **T+0:30 - Timeout Reached**
```
Timeout Reached (30 minutes):
├── Device 1: SUCCESS
├── Device 2: SUCCESS
├── Device 3: TIMEOUT (still installing)
├── Device 4: TIMEOUT (still installing)
├── Device 5: TIMEOUT (still installing)
├── Wave Status: IN_PROGRESS → FAILED
└── Bundle Status: IN_PROGRESS → FAILED
```

### **Bundle Status Priority Logic**

#### **Status Decision Order**
1. **IN_PROGRESS** - Any wave currently running
2. **FAILED** - Any wave failed (highest priority for failure)
3. **CANCELLED** - Deployment was cancelled
4. **COMPLETED** - All waves completed successfully
5. **PUBLISHED** - Waves pending to start (fallback)

#### **Wave Status Transitions**
- **PENDING** → **IN_PROGRESS** (when deployment starts)
- **IN_PROGRESS** → **COMPLETED** (all devices successful)
- **IN_PROGRESS** → **FAILED** (any device fails or timeout)
- **IN_PROGRESS** → **CANCELLED** (deployment cancelled)

## Common Workflows

### Workflow 1: Create New Bundle
1. **Navigate to Bundles** - Go to Admin → IOT → Bundles
2. **Click "Add Bundle"** - Start bundle creation process
3. **Enter Bundle Details** - Fill in name, version, description
4. **Set Scheduling** - Configure deployment date and time
5. **Save Bundle** - Create the bundle record
6. **Verify Creation** - Confirm bundle is created successfully

### Workflow 2: Edit Existing Bundle
1. **Find Bundle** - Use search to locate bundle
2. **Click Bundle Name** - Open bundle detail view
3. **Edit Information** - Modify name, version, description, or scheduling
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 3: Deploy Bundle
1. **Select Bundle** - Choose bundle from list (must be Draft status)
2. **Click Deploy** - Click deploy action
3. **Configure Deployment** - Set deployment parameters
4. **Monitor Progress** - Track deployment progress
5. **Verify Deployment** - Confirm bundle is deployed successfully

### Workflow 4: Delete Bundle
1. **Select Bundle** - Choose bundle from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm bundle is removed from list

### Workflow 5: Test Bundle Deployment
1. **Create Test Bundle** - Create bundle with 1-2 small apps
2. **Publish Bundle** - Change status from Draft to Published
3. **Monitor Deployment** - Watch bundle status transitions
4. **Check Timeouts** - Verify deployment completes within timeout
5. **Verify Results** - Confirm all devices receive bundle successfully

## Testing & Understanding Bundle Flow

### 🧪 **Testing Bundle Deployment**

#### **Recommended Test Setup**
- **Bundle Size**: 1-2 small applications
- **Target Devices**: 2-3 test devices
- **Expected Timeout**: `max(10 minutes, 2 apps × 10 minutes) = 20 minutes`
- **Test Duration**: 15-20 minutes

#### **Test Steps**
1. **Create Bundle** - Name: "Test Bundle v1.0"
2. **Add Apps** - Add 1-2 small applications
3. **Publish Bundle** - Change status to Published
4. **Monitor Status** - Watch for status transitions:
   - `DRAFT` → `PUBLISHED` (immediate)
   - `PUBLISHED` → `IN_PROGRESS` (when deployment starts)
   - `IN_PROGRESS` → `COMPLETED` (when all devices successful)
5. **Check Timeout** - Verify deployment completes within 20 minutes
6. **Verify Results** - Confirm all target devices received bundle

#### **Expected Test Results**
- **Bundle Status**: `COMPLETED` within timeout
- **Wave Status**: `COMPLETED` for all waves
- **Device Status**: All devices successful
- **Total Time**: 10-15 minutes (well within 20-minute timeout)

### 📊 **Understanding Bundle Status Transitions**

#### **Status Flow Visualization**
```
DRAFT ──publish──▶ PUBLISHED ──deploy──▶ IN_PROGRESS
                                              │
                                              ├──▶ COMPLETED (success)
                                              ├──▶ FAILED (timeout/error)
                                              └──▶ CANCELLED (cancelled)
```

#### **Key Status Indicators**
- **DRAFT**: Bundle is being created/modified
- **PUBLISHED**: Bundle is ready for deployment
- **IN_PROGRESS**: Bundle is currently being deployed
- **COMPLETED**: All waves completed successfully
- **FAILED**: Any wave failed or timed out
- **CANCELLED**: Deployment was cancelled

#### **Monitoring Points**
- **Publish Time**: When bundle changes from Draft to Published
- **Deploy Time**: When bundle changes from Published to In Progress
- **Completion Time**: When bundle changes to Completed/Failed
- **Timeout Check**: Verify deployment completes within calculated timeout

### 🔍 **Troubleshooting Bundle Flow**

#### **Common Flow Issues**
- **Bundle Stuck in PUBLISHED**: Check if deployment was initiated
- **Bundle Stuck in IN_PROGRESS**: Check wave status and device responses
- **Bundle Never Completes**: Check timeout limits and device connectivity
- **Status Not Updating**: Check bundle status priority logic

#### **Debug Steps**
1. **Check Bundle Status** - Verify current status
2. **Check Wave Status** - Look at individual wave statuses
3. **Check Device Status** - Verify target devices are online
4. **Check Timeout** - Calculate expected timeout and compare
5. **Check Logs** - Review deployment logs for errors


## Troubleshooting

### Common Issues

#### Bundle Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Bundle Name** - Ensure bundle name is unique and valid
- **Permission Errors** - Ensure admin permissions are available
- **Scheduling Issues** - Verify deployment date and time settings

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Bundle Management Issues
- **Cannot Edit Bundle** - Check bundle status and permissions
- **Delete Failed** - Check if bundle is in use or has dependencies
- **Bundle Not Found** - Verify bundle exists and is accessible
- **Deploy Failed** - Check if bundle is in Draft status

#### Bundle Deployment Issues
- **Deployment Timeout** - Check if deployment exceeds timeout limits
- **Wave Timeout** - Verify wave deployment completes within 10 minutes
- **Device Timeout** - Ensure devices respond within timeout period
- **Status Not Updating** - Check bundle status priority logic
- **Wave Stuck** - Monitor wave status transitions

### Error Messages

#### "Bundle Not Found"
- **Cause**: Bundle ID doesn't exist in system
- **Solution**: Verify bundle ID and check bundle list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Cannot Delete Published Bundle"
- **Cause**: Bundle is published and cannot be deleted
- **Solution**: Change bundle status to Draft first

#### "Deployment Timeout"
- **Cause**: Bundle deployment exceeded timeout limits
- **Solution**: Check device connectivity and reduce bundle size

#### "Wave Timeout"
- **Cause**: Wave deployment took longer than 10 minutes
- **Solution**: Check device performance and network speed

#### "Bundle Status Stuck"
- **Cause**: Bundle status not updating properly
- **Solution**: Check wave status transitions and priority logic

## Best Practices

### Bundle Design
- **Descriptive Names** - Use clear, descriptive bundle names
- **Consistent Naming** - Use consistent naming conventions
- **Helpful Descriptions** - Add descriptions for bundle purpose
- **Version Management** - Use proper version numbering
- **Status Management** - Track bundle status appropriately

### Bundle Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Bundle Functionality** - Verify bundles work as expected
- **Backup Data** - Keep backups of important bundle data

### Organization
- **Logical Grouping** - Group related bundles logically
- **Clear Descriptions** - Use clear descriptions for bundle purpose
- **Status Organization** - Organize bundles by status
- **Regular Cleanup** - Remove unused or duplicate bundles
- **Documentation** - Document bundle purpose and usage

### Security
- **Access Control** - Control bundle access strictly
- **Permission Management** - Manage bundle permissions carefully
- **Data Protection** - Protect sensitive bundle information
- **Audit Logging** - Log all bundle operations

## Technical Details

### Bundle Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable bundle name
- **Version** - Bundle version number
- **Description** - Bundle description
- **Status** - Bundle status (Draft, Published, In Progress, Cancelled, Completed, Failed)
- **Scheduled At** - Scheduled deployment date and time
- **Created At** - Bundle creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Bundle name
- **Sort Options** - Name, version, status, scheduled date, created date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Draft, Published, Cancelled, Completed, Failed), OS (Android, iOS)

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Scheduling Options** - Date and time picker for deployment scheduling
- **Status Management** - Track bundle status throughout lifecycle
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Device Management](./devices.md)** - Manage target devices
- **[Resources](./resources.md)** - Upload and manage bundle resources
- **[Device Profiles](./device_profiles.md)** - Configure device settings
- **[Device Tags](./device_tags.md)** - Organize devices for deployment

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Bundle Errors** - Verify bundle exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current bundle management UI and functionality.
