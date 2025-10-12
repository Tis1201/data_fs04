# Bundle Management User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Bundle Management allows you to create, deploy, and monitor application bundles across your IoT devices. Bundles are collections of applications that can be installed together on devices, making it easy to deploy software packages and manage device configurations.

## Prerequisites

- **Admin permissions** - Full bundle management access
- **Applications** - Apps must be available in the system
- **Devices** - Target devices must be registered and online
- **Resources** - Required files and resources must be uploaded

## Getting Started

### Quick Start
1. **Navigate to Bundles** - Go to Admin → IOT → Bundles
2. **Create New Bundle** - Click "Create Bundle" button
3. **Add Applications** - Select apps to include in bundle
4. **Deploy to Devices** - Choose target devices for deployment
5. **Monitor Progress** - Track installation progress

### Navigation
- **Menu Path**: Admin → IOT → Bundles
- **URL**: `/admin/iot/bundles`
- **Direct Access**: Click "Bundles" in the IOT section

## Core Functionality

### Bundle List View

#### Bundle Information Display
- **Bundle Name** - Human-readable bundle name
- **Bundle ID** - Unique system identifier
- **Version** - Bundle version number
- **Status** - Active/Inactive/Draft
- **Created Date** - When bundle was created
- **Last Modified** - Last update timestamp
- **Applications** - Number of apps in bundle
- **Devices** - Number of devices with bundle installed

#### Bundle Status Indicators
- 🟢 **Active** - Bundle is ready for deployment
- 🔴 **Inactive** - Bundle is disabled
- 🟡 **Draft** - Bundle is being created/modified
- ⚪ **Deploying** - Bundle is currently being deployed

#### Filtering and Search
- **Search by Name** - Find bundles by name
- **Filter by Status** - Show only active/inactive bundles
- **Filter by Version** - Show bundles by version
- **Filter by Date** - Show bundles by creation date
- **Sort Options** - Sort by name, status, date, etc.

### Bundle Detail View

#### Bundle Information Tab
- **Basic Info** - Name, ID, description, version
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, deployment status
- **Statistics** - Number of apps, devices, installations

#### Applications Tab
- **App List** - Applications included in bundle
- **App Details** - Version, size, dependencies
- **App Order** - Installation order and dependencies
- **App Management** - Add, remove, reorder applications

#### Deployment Tab
- **Target Devices** - Devices where bundle is deployed
- **Deployment Status** - Installation progress and status
- **Deployment History** - Previous deployment attempts
- **Deployment Logs** - Detailed deployment logs

#### Wave Management Tab
- **Wave Configuration** - Deployment wave settings
- **Wave Progress** - Current wave deployment status
- **Wave History** - Previous wave deployments
- **Wave Scheduling** - Scheduled deployment waves

## Advanced Features

### Bundle Creation

#### Basic Bundle Setup
- **Bundle Name** - Choose descriptive name
- **Description** - Add detailed description
- **Version** - Set version number
- **Category** - Assign bundle category
- **Tags** - Add tags for organization

#### Application Selection
- **App Browser** - Browse available applications
- **App Search** - Search for specific applications
- **App Filtering** - Filter by category, type, size
- **Dependency Check** - Verify app dependencies
- **Conflict Resolution** - Resolve app conflicts

#### Bundle Configuration
- **Installation Order** - Set app installation sequence
- **Dependencies** - Configure app dependencies
- **Pre-install Scripts** - Add pre-installation scripts
- **Post-install Scripts** - Add post-installation scripts
- **Rollback Configuration** - Set rollback options

### Bundle Deployment

#### Device Selection
- **Device Browser** - Browse available devices
- **Device Filtering** - Filter by status, tags, location
- **Device Groups** - Select device groups
- **Compatibility Check** - Verify device compatibility
- **Capacity Check** - Verify device capacity

#### Deployment Configuration
- **Deployment Mode** - Immediate or scheduled deployment
- **Wave Configuration** - Set deployment waves
- **Retry Settings** - Configure retry attempts
- **Timeout Settings** - Set deployment timeouts
- **Notification Settings** - Configure deployment notifications

#### Wave Management
- **Wave Creation** - Create deployment waves
- **Wave Scheduling** - Schedule wave deployments
- **Wave Monitoring** - Monitor wave progress
- **Wave Control** - Pause, resume, cancel waves
- **Wave Reporting** - Generate wave reports

### Bundle Monitoring

#### Installation Progress
- **Real-Time Status** - Live installation progress
- **Progress Tracking** - Track installation steps
- **Error Detection** - Identify installation errors
- **Success/Failure Rates** - Monitor success rates
- **Performance Metrics** - Track installation performance

#### Status Monitoring
- **Device Status** - Monitor device status during deployment
- **App Status** - Track individual app installation
- **System Status** - Monitor system resources
- **Network Status** - Track network connectivity
- **Log Monitoring** - Monitor installation logs

#### Reporting and Analytics
- **Deployment Reports** - Generate deployment reports
- **Success Analytics** - Analyze deployment success
- **Performance Analytics** - Analyze deployment performance
- **Error Analytics** - Analyze deployment errors
- **Trend Analysis** - Track deployment trends

## Bundle Installation Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **App Installation Timeout: 10 Minutes**
- **Per App**: Each application has a **10-minute timeout**
- **Timeout Behavior**: If device doesn't respond within 10 minutes → **FAILED**
- **Retry Logic**: Failed apps are retried up to 3 times
- **Total Bundle Timeout**: No overall bundle timeout (depends on app count)

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **App Installed**: Device returns `{"status": "success", "appId": "app123"}`
- **All Apps Success**: All apps in bundle install successfully
- **Bundle Complete**: Bundle status changes to `COMPLETED`

##### ❌ **Failure Cases**
- **App Timeout**: No response from device after 10 minutes
- **App Error**: Device returns `{"status": "error", "error": "Installation failed"}`
- **Device Offline**: Device goes offline during installation
- **Bundle Failed**: Any app fails after 3 retries

### 📊 **Bundle Installation Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Creates │    │   Bundle Deploy  │    │  Device Receives│
│     Bundle      │───▶│   to Device      │───▶│     Bundle      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Bundle Status  │◀───│  Monitor Progress│◀───│  Install App 1  │
│   COMPLETED     │    │                  │    │   (10min timeout)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Bundle Status  │◀───│  Monitor Progress│◀───│  Install App 2  │
│   COMPLETED     │    │                  │    │   (10min timeout)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Bundle Status  │◀───│  Monitor Progress│◀───│  Install App N  │
│   COMPLETED     │    │                  │    │   (10min timeout)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Installation Process**

#### **Step 1: Bundle Deployment**
```
Admin Action: Deploy Bundle
├── Bundle Status: DEPLOYING
├── Device Status: ONLINE
└── Start Installation Process
```

#### **Step 2: App Installation Loop**
```
For Each App in Bundle:
├── Send App to Device
├── Start 10-minute Timer
├── Wait for Device Response
│   ├── Success Response → Continue to Next App
│   ├── Error Response → Retry (up to 3 times)
│   └── Timeout (10min) → Mark as FAILED
└── Update Bundle Progress
```

#### **Step 3: Bundle Completion**
```
All Apps Processed:
├── All Success → Bundle Status: COMPLETED
├── Some Failed → Bundle Status: PARTIAL
└── All Failed → Bundle Status: FAILED
```

## Common Workflows

### Workflow 1: Create and Deploy Bundle
1. **Create Bundle** - Set up new bundle with name and description
2. **Add Applications** - Select and add applications to bundle
3. **Configure Bundle** - Set installation order and dependencies
4. **Test Bundle** - Test bundle on development device
5. **Deploy Bundle** - Deploy to target devices
6. **Monitor Progress** - Track installation progress (10min per app)
7. **Verify Installation** - Confirm bundle is working properly

### Workflow 2: Update Existing Bundle
1. **Select Bundle** - Choose bundle to update
2. **Modify Applications** - Add, remove, or update applications
3. **Update Configuration** - Modify bundle configuration
4. **Version Bundle** - Create new version
5. **Deploy Update** - Deploy updated bundle
6. **Monitor Update** - Track update progress
7. **Verify Update** - Confirm update is successful

### Workflow 3: Wave Deployment
1. **Create Wave** - Set up deployment wave
2. **Configure Wave** - Set wave parameters and timing
3. **Schedule Wave** - Schedule wave deployment
4. **Monitor Wave** - Track wave progress
5. **Control Wave** - Pause, resume, or cancel as needed
6. **Complete Wave** - Finish wave deployment
7. **Generate Report** - Create wave deployment report

## 📋 **Real-World Example: Bundle Installation**

### **Example Bundle: "Office Apps Bundle"**
- **Bundle ID**: `bundle_office_001`
- **Apps**: 3 applications (Word, Excel, PowerPoint)
- **Target Device**: `device_office_001`

### **Timeline & Expected Behavior**

#### **T+0:00 - Bundle Deployment**
```
Admin Action: Deploy "Office Apps Bundle"
├── Bundle Status: DEPLOYING
├── Device Status: ONLINE
└── Start Installation Process
```

#### **T+0:01 - App 1: Word Installation**
```
Send Word App to Device
├── Start 10-minute Timer
├── Device Response: "Installing Word..."
└── Expected: Success within 10 minutes
```

#### **T+0:05 - App 1: Word Success**
```
Device Response: {"status": "success", "appId": "word_001"}
├── App 1 Status: COMPLETED
├── Bundle Progress: 33% (1/3 apps)
└── Continue to App 2
```

#### **T+0:06 - App 2: Excel Installation**
```
Send Excel App to Device
├── Start 10-minute Timer
├── Device Response: "Installing Excel..."
└── Expected: Success within 10 minutes
```

#### **T+0:08 - App 2: Excel Success**
```
Device Response: {"status": "success", "appId": "excel_001"}
├── App 2 Status: COMPLETED
├── Bundle Progress: 67% (2/3 apps)
└── Continue to App 3
```

#### **T+0:09 - App 3: PowerPoint Installation**
```
Send PowerPoint App to Device
├── Start 10-minute Timer
├── Device Response: "Installing PowerPoint..."
└── Expected: Success within 10 minutes
```

#### **T+0:12 - App 3: PowerPoint Success**
```
Device Response: {"status": "success", "appId": "powerpoint_001"}
├── App 3 Status: COMPLETED
├── Bundle Progress: 100% (3/3 apps)
└── Bundle Status: COMPLETED
```

### **Total Installation Time: 12 minutes**
- **Word**: 5 minutes
- **Excel**: 3 minutes  
- **PowerPoint**: 4 minutes
- **All within 10-minute timeout per app**

### **Failure Scenario Example**

#### **T+0:06 - App 2: Excel Installation**
```
Send Excel App to Device
├── Start 10-minute Timer
├── Device Response: "Installing Excel..."
└── Wait for response...
```

#### **T+0:16 - App 2: Excel Timeout**
```
No response after 10 minutes
├── App 2 Status: FAILED (timeout)
├── Retry Attempt 1: Send Excel again
├── Start new 10-minute Timer
└── Wait for response...
```

#### **T+0:26 - App 2: Excel Retry Timeout**
```
No response after 10 minutes (retry 1)
├── App 2 Status: FAILED (timeout)
├── Retry Attempt 2: Send Excel again
├── Start new 10-minute Timer
└── Wait for response...
```

#### **T+0:36 - App 2: Excel Final Timeout**
```
No response after 10 minutes (retry 2)
├── App 2 Status: FAILED (final timeout)
├── Bundle Status: PARTIAL (2/3 apps successful)
└── Installation Complete with Errors
```

### Workflow 4: Bundle Troubleshooting
1. **Identify Issue** - Determine deployment problem
2. **Check Logs** - Review deployment and device logs
3. **Verify Configuration** - Check bundle and device configuration
4. **Test Manually** - Test deployment manually
5. **Fix Issues** - Resolve identified problems
6. **Retry Deployment** - Attempt deployment again
7. **Monitor Results** - Track retry results

## Troubleshooting

### Common Issues

#### Bundle Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Resources** - Ensure required resources are available
- **Check Dependencies** - Verify app dependencies are met
- **Check Conflicts** - Resolve app conflicts
- **Check Configuration** - Verify bundle configuration

#### Deployment Failures
- **Check Device Status** - Ensure devices are online
- **Check Device Capacity** - Verify device has sufficient space
- **Check Network** - Verify network connectivity
- **Check Compatibility** - Ensure device compatibility
- **Check Logs** - Review deployment logs for errors

#### Installation Failures
- **Check App Dependencies** - Verify all dependencies are met
- **Check Device Resources** - Ensure sufficient resources
- **Check Installation Order** - Verify correct installation sequence
- **Check Scripts** - Review pre/post-install scripts
- **Check Permissions** - Verify device permissions

#### Wave Deployment Issues
- **Check Wave Configuration** - Verify wave settings
- **Check Device Availability** - Ensure devices are available
- **Check Scheduling** - Verify wave scheduling
- **Check Network Load** - Monitor network capacity
- **Check System Resources** - Monitor system resources

### Error Messages

#### "Bundle Not Found"
- **Cause**: Bundle ID doesn't exist in system
- **Solution**: Verify bundle ID and check bundle list

#### "Device Offline"
- **Cause**: Target device is not connected
- **Solution**: Check device status and network connection

#### "Insufficient Space"
- **Cause**: Device doesn't have enough storage space
- **Solution**: Free up space on device or reduce bundle size

#### "Dependency Missing"
- **Cause**: Required dependency is not available
- **Solution**: Install missing dependency or update bundle

#### "Installation Timeout"
- **Cause**: Installation took too long to complete
- **Solution**: Check device performance and network speed

## Best Practices

### Bundle Creation
- **Descriptive Names** - Use clear, descriptive bundle names
- **Version Control** - Maintain proper version numbering
- **Dependency Management** - Clearly define app dependencies
- **Testing** - Test bundles on development devices first
- **Documentation** - Document bundle contents and configuration

### Deployment Management
- **Wave Deployment** - Use waves for large deployments
- **Monitoring** - Monitor deployment progress closely
- **Rollback Planning** - Plan for rollback scenarios
- **Resource Management** - Monitor system resources during deployment
- **Error Handling** - Implement proper error handling

### Performance Optimization
- **Bundle Size** - Keep bundle sizes reasonable
- **Installation Order** - Optimize installation sequence
- **Resource Usage** - Monitor resource usage during deployment
- **Network Optimization** - Optimize network usage
- **Caching** - Use caching for frequently deployed bundles

### Security
- **Access Control** - Limit bundle access to authorized users
- **Validation** - Validate bundle contents before deployment
- **Audit Logging** - Log all bundle operations
- **Secure Deployment** - Use secure deployment methods
- **Regular Updates** - Keep bundles updated with security patches

## Related Features

- **[Device Management](./devices.md)** - Manage target devices
- **[Resources](./resources.md)** - Upload and manage bundle resources
- **[Device Profiles](./device_profiles.md)** - Configure device settings
- **[Device Tags](./device_tags.md)** - Organize devices for deployment
- **[Preclaims](./preclaims.md)** - Pre-configure device claims

## API Reference

### Bundle Management API
- **GET /api/admin/iot/bundles** - List all bundles
- **POST /api/admin/iot/bundles** - Create new bundle
- **GET /api/admin/iot/bundles/{id}** - Get bundle details
- **PUT /api/admin/iot/bundles/{id}** - Update bundle
- **DELETE /api/admin/iot/bundles/{id}** - Delete bundle

### Bundle Deployment API
- **POST /api/admin/iot/bundles/{id}/deploy** - Deploy bundle
- **GET /api/admin/iot/bundles/{id}/deployments** - Get deployment history
- **POST /api/admin/iot/bundles/{id}/waves** - Create deployment wave
- **GET /api/admin/iot/bundles/{id}/waves** - Get wave information

### Bundle Monitoring API
- **GET /api/admin/iot/bundles/{id}/status** - Get bundle status
- **GET /api/admin/iot/bundles/{id}/progress** - Get deployment progress
- **GET /api/admin/iot/bundles/{id}/logs** - Get deployment logs
- **GET /api/admin/iot/bundles/{id}/metrics** - Get deployment metrics

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Deployment Logs** - Review deployment logs for errors
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of bundle management from creation to deployment and monitoring.
