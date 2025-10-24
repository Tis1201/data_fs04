# User Bundles Guide

**Last Updated**: 2025-10-12  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **User Bundles** feature allows you to create, deploy, and manage application bundles for your IoT devices. You can package multiple applications together, deploy them to devices, and monitor installation progress in real-time.

## Prerequisites

- **User account** - Valid user account with bundle management permissions
- **Device access** - Access to target devices for bundle deployment
- **Application files** - Applications to include in bundles

## Getting Started

### Quick Start
1. **Access Bundles** - Navigate to User → IoT → Bundles
2. **Create Bundle** - Create a new application bundle
3. **Add Applications** - Add applications to the bundle
4. **Deploy Bundle** - Deploy bundle to target devices
5. **Monitor Progress** - Watch installation progress in real-time

### Navigation
- **Menu Path**: User → IoT → Bundles
- **URL**: `/user/iot/bundles`
- **Direct Access**: Click "Bundles" in the IoT section

## Core Functionality

### Bundle Management

#### Bundle Creation
- **Bundle Name** - Descriptive name for the bundle
- **Bundle Description** - Detailed description of bundle contents
- **Bundle Version** - Version number for tracking
- **Target Devices** - Devices to receive the bundle
- **Installation Order** - Order of application installation
- **Dependencies** - Application dependencies and requirements

#### Bundle Information
- **Bundle ID** - Unique bundle identifier
- **Creation Date** - When the bundle was created
- **Last Modified** - Last modification date
- **Bundle Size** - Total size of all applications
- **Application Count** - Number of applications in bundle
- **Deployment Status** - Current deployment status

#### Bundle Status Indicators
- 🟢 **Ready** - Bundle is ready for deployment
- 🟡 **Deploying** - Bundle is currently being deployed
- 🔴 **Failed** - Bundle deployment failed
- 🔵 **Completed** - Bundle deployment completed successfully
- ⚪ **Draft** - Bundle is in draft mode
- 🟠 **Paused** - Bundle deployment is paused

### Application Management

#### Application Types
- **Windows Applications** - .exe, .msi, .appx files
- **Linux Applications** - .deb, .rpm, .tar.gz files
- **Android Applications** - .apk files
- **iOS Applications** - .ipa files
- **Web Applications** - HTML, CSS, JavaScript files
- **Configuration Files** - JSON, XML, YAML files

#### Application Information
- **Application Name** - Name of the application
- **Application Version** - Version of the application
- **File Size** - Size of the application file
- **Installation Path** - Where to install the application
- **Installation Parameters** - Command-line parameters
- **Dependencies** - Required dependencies

#### Application Status
- 🟢 **Installed** - Application installed successfully
- 🔴 **Failed** - Application installation failed
- 🟡 **Installing** - Application is being installed
- ⚪ **Pending** - Application waiting to be installed
- 🔵 **Skipped** - Application installation was skipped
- 🟠 **Retrying** - Application installation is being retried

### Bundle Deployment

#### Deployment Options
- **Target Selection** - Choose devices for deployment
- **Deployment Schedule** - Schedule deployment time
- **Installation Order** - Set application installation order
- **Rollback Options** - Configure rollback settings
- **Notification Settings** - Set deployment notifications
- **Progress Monitoring** - Enable real-time progress tracking

#### Deployment Process
- **Bundle Validation** - Validate bundle before deployment
- **Device Preparation** - Prepare target devices
- **Application Installation** - Install applications in order
- **Progress Tracking** - Monitor installation progress
- **Completion Verification** - Verify successful installation
- **Status Reporting** - Report deployment results

## Advanced Features

### Bundle Installation Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **App Installation Timeout: 10 Minutes**
- **Per Application**: Each application has a **10-minute timeout**
- **Timeout Behavior**: If app installation takes too long → **FAILED**
- **Retry Logic**: Failed apps are retried up to 3 times
- **Total App Timeout**: 30 minutes for complete app installation (3 retries)

#### **Bundle Deployment Timeout: 30 Minutes**
- **Per Bundle**: Each bundle has a **30-minute deployment timeout**
- **Timeout Behavior**: If bundle deployment takes too long → **FAILED**
- **Retry Logic**: Failed bundles are retried up to 2 times
- **Total Bundle Timeout**: 90 minutes for complete bundle deployment

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **All Apps Installed**: All applications installed successfully
- **No Errors**: No installation errors occurred
- **Devices Responding**: All target devices respond correctly
- **Verification Passed**: Installation verification successful

##### ❌ **Failure Cases**
- **App Timeout**: Application installation took too long
- **Bundle Timeout**: Bundle deployment took too long
- **Device Offline**: Target device went offline during installation
- **Installation Error**: Application installation failed with errors

### 📊 **Bundle Installation Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bundle        │    │   Device         │    │  Application    │
│   Deployment    │───▶│   Preparation    │───▶│   Installation  │
│   Started       │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Bundle         │◀───│  App             │◀───│  App            │
│   Complete      │    │   Installation   │    │   Processing    │
│                 │    │  (10min timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Status         │◀───│  Installation    │◀───│  Next           │
│   Update        │    │   Verification   │    │   Application   │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Bundle Installation Process**

#### **Step 1: Bundle Deployment**
```
Bundle Deployment:
├── Start 30-minute Timer
├── Validate Bundle
├── Prepare Target Devices
├── Begin Application Installation
└── Start Progress Monitoring
```

#### **Step 2: Application Installation Loop**
```
For Each Application:
├── Start 10-minute Timer
├── Download Application
├── Install Application
├── Verify Installation
└── Report Status
```

#### **Step 3: Bundle Completion**
```
Bundle Completion:
├── Verify All Applications
├── Update Device Status
├── Generate Report
├── Send Notifications
└── Mark Bundle Complete
```

### Bundle Templates

#### Pre-Built Templates
- **Office Bundle** - Microsoft Office applications
- **Security Bundle** - Security and antivirus software
- **Development Bundle** - Development tools and IDEs
- **Media Bundle** - Media players and editing software
- **Productivity Bundle** - Productivity and collaboration tools
- **Custom Bundle** - User-defined application bundle

#### Template Features
- **Application Lists** - Pre-configured application lists
- **Installation Scripts** - Automated installation scripts
- **Configuration Files** - Pre-configured settings
- **Dependency Management** - Automatic dependency resolution
- **Version Control** - Template version management
- **Customization** - Modify templates for specific needs

### Deployment Scheduling

#### Schedule Options
- **Immediate** - Deploy bundle immediately
- **Scheduled** - Deploy at specific date and time
- **Recurring** - Deploy on recurring schedule
- **Conditional** - Deploy based on conditions
- **Maintenance Window** - Deploy during maintenance windows
- **User Initiated** - Deploy when user is ready

#### Schedule Management
- **Schedule Creation** - Create deployment schedules
- **Schedule Modification** - Modify existing schedules
- **Schedule Cancellation** - Cancel scheduled deployments
- **Schedule Monitoring** - Monitor scheduled deployments
- **Schedule History** - View deployment history
- **Schedule Templates** - Use pre-built schedule templates

## Common Workflows

### Workflow 1: Create and Deploy Bundle
1. **Create Bundle** - Start new bundle creation
2. **Add Applications** - Add applications to bundle
3. **Configure Settings** - Set installation parameters
4. **Select Devices** - Choose target devices
5. **Deploy Bundle** - Start deployment process
6. **Monitor Progress** - Watch installation progress
7. **Verify Results** - Confirm successful installation

### Workflow 2: Bundle Template Usage
1. **Select Template** - Choose pre-built template
2. **Customize Template** - Modify template for needs
3. **Add Custom Apps** - Add additional applications
4. **Configure Deployment** - Set deployment options
5. **Deploy Bundle** - Start deployment process
6. **Monitor Progress** - Watch installation progress
7. **Review Results** - Check deployment results

### Workflow 3: Scheduled Bundle Deployment
1. **Create Bundle** - Create new bundle
2. **Set Schedule** - Configure deployment schedule
3. **Configure Notifications** - Set up notifications
4. **Save Schedule** - Save scheduled deployment
5. **Monitor Schedule** - Watch scheduled deployment
6. **Handle Issues** - Address any deployment issues
7. **Review Results** - Check deployment results

### Workflow 4: Bundle Rollback
1. **Identify Issue** - Find failed bundle deployment
2. **Initiate Rollback** - Start rollback process
3. **Select Rollback Options** - Choose rollback method
4. **Execute Rollback** - Perform rollback operation
5. **Monitor Progress** - Watch rollback progress
6. **Verify Rollback** - Confirm rollback success
7. **Document Results** - Record rollback results

## 📋 **Real-World Example: Office Apps Bundle Installation**

### **Example Bundle: "Office Apps Bundle"**
- **Bundle Name**: Office Productivity Suite
- **Applications**: 3 applications (Word, Excel, PowerPoint)
- **Target Devices**: 5 office devices
- **Purpose**: Deploy office applications to office devices

### **Timeline & Expected Behavior**

#### **T+0:00 - Bundle Deployment Start**
```
Bundle Deployment:
├── Bundle: "Office Apps Bundle"
├── Applications: 3 apps
├── Target Devices: 5 devices
├── Start 30-minute Timer
└── Status: DEPLOYING
```

#### **T+0:05 - Device Preparation**
```
Device Preparation:
├── Check Device Status: All 5 devices ONLINE
├── Prepare Installation Environment
├── Download Bundle Files
├── Progress: 10% complete
└── Status: PREPARING
```

#### **T+0:10 - Application 1 Installation**
```
Application 1 - Microsoft Word:
├── Start 10-minute Timer
├── Download Word Installer
├── Install Word Application
├── Progress: 25% complete
└── Status: INSTALLING
```

#### **T+0:15 - Application 1 Complete**
```
Application 1 Complete:
├── Word Installation: SUCCESS
├── Installation Time: 5 minutes
├── Progress: 40% complete
└── Status: INSTALLED
```

#### **T+0:20 - Application 2 Installation**
```
Application 2 - Microsoft Excel:
├── Start 10-minute Timer
├── Download Excel Installer
├── Install Excel Application
├── Progress: 55% complete
└── Status: INSTALLING
```

#### **T+0:25 - Application 2 Complete**
```
Application 2 Complete:
├── Excel Installation: SUCCESS
├── Installation Time: 5 minutes
├── Progress: 70% complete
└── Status: INSTALLED
```

#### **T+0:30 - Application 3 Installation**
```
Application 3 - Microsoft PowerPoint:
├── Start 10-minute Timer
├── Download PowerPoint Installer
├── Install PowerPoint Application
├── Progress: 85% complete
└── Status: INSTALLING
```

#### **T+0:35 - Application 3 Complete**
```
Application 3 Complete:
├── PowerPoint Installation: SUCCESS
├── Installation Time: 5 minutes
├── Progress: 100% complete
└── Status: INSTALLED
```

#### **T+0:40 - Bundle Verification**
```
Bundle Verification:
├── Verify All Applications: SUCCESS
├── Check Device Status: All devices ONLINE
├── Test Application Launch: SUCCESS
├── Bundle Status: COMPLETED
└── Total Time: 40 minutes
```

### **Total Bundle Installation Time: 40 minutes**
- **Device Preparation**: 5 minutes
- **Application 1 (Word)**: 5 minutes
- **Application 2 (Excel)**: 5 minutes
- **Application 3 (PowerPoint)**: 5 minutes
- **Bundle Verification**: 5 minutes
- **Within 30-minute bundle timeout**

### **Failure Scenario Example**

#### **T+0:00 - Bundle Deployment Start**
```
Bundle Deployment:
├── Bundle: "Office Apps Bundle"
├── Applications: 3 apps
├── Target Devices: 5 devices
├── Start 30-minute Timer
└── Status: DEPLOYING
```

#### **T+0:10 - Application 1 Installation**
```
Application 1 - Microsoft Word:
├── Start 10-minute Timer
├── Download Word Installer
├── Install Word Application
├── Progress: 25% complete
└── Status: INSTALLING
```

#### **T+0:15 - Application 1 Complete**
```
Application 1 Complete:
├── Word Installation: SUCCESS
├── Installation Time: 5 minutes
├── Progress: 40% complete
└── Status: INSTALLED
```

#### **T+0:20 - Application 2 Installation**
```
Application 2 - Microsoft Excel:
├── Start 10-minute Timer
├── Download Excel Installer
├── Install Excel Application
├── Progress: 55% complete
└── Status: INSTALLING
```

#### **T+0:30 - Application 2 Timeout**
```
Application 2 Timeout:
├── 10-minute timer elapsed
├── Excel Installation: TIMEOUT
├── Progress: 55% complete
├── Status: FAILED
└── Retry Attempt 1
```

#### **T+0:35 - Retry Attempt 1**
```
Retry Attempt 1:
├── Start new 10-minute Timer
├── Retry Excel Installation
├── Progress: 55% complete
└── Status: RETRYING
```

#### **T+0:45 - Retry Timeout**
```
Retry Timeout:
├── 10-minute timer elapsed (retry 1)
├── Excel Installation: TIMEOUT
├── Progress: 55% complete
├── Status: FAILED
└── Retry Attempt 2
```

#### **T+0:50 - Retry Attempt 2**
```
Retry Attempt 2:
├── Start new 10-minute Timer
├── Retry Excel Installation
├── Progress: 55% complete
└── Status: RETRYING
```

#### **T+1:00 - Final Timeout**
```
Final Timeout:
├── 10-minute timer elapsed (retry 2)
├── Excel Installation: TIMEOUT
├── Progress: 55% complete
├── Status: FAILED
└── Bundle Status: FAILED
```

#### **T+1:05 - Bundle Failure**
```
Bundle Failure:
├── Excel Installation: FAILED after 3 attempts
├── Bundle Status: FAILED
├── Installed Apps: 1 (Word)
├── Failed Apps: 1 (Excel)
├── Pending Apps: 1 (PowerPoint)
└── Total Time: 65 minutes
```

## Troubleshooting

### Common Issues

#### Bundle Creation Problems
- **Check File Formats** - Verify application file formats are supported
- **Check File Size** - Ensure files are within size limits
- **Check Dependencies** - Verify all dependencies are included
- **Check Permissions** - Verify user has bundle creation permissions
- **Check Storage** - Ensure sufficient storage space

#### Deployment Failures
- **Check Device Status** - Verify target devices are online
- **Check Network** - Verify network connectivity
- **Check Device Resources** - Ensure devices have sufficient resources
- **Check Installation Paths** - Verify installation paths are valid
- **Check Logs** - Review deployment logs for errors

#### Installation Timeouts
- **Check Device Performance** - Monitor device performance
- **Check Network Speed** - Verify network speed is adequate
- **Check Application Size** - Consider application size and complexity
- **Check Device Load** - Ensure device is not overloaded
- **Check Installation Scripts** - Verify installation scripts are correct

#### Application Failures
- **Check Application Compatibility** - Verify application compatibility
- **Check System Requirements** - Ensure system requirements are met
- **Check Installation Parameters** - Verify installation parameters
- **Check Dependencies** - Ensure all dependencies are available
- **Check Logs** - Review application installation logs

### Error Messages

#### "Bundle Creation Failed"
- **Cause**: Unable to create bundle
- **Solution**: Check file formats and permissions

#### "Deployment Timeout"
- **Cause**: Bundle deployment took too long
- **Solution**: Check device status and network connectivity

#### "Application Installation Failed"
- **Cause**: Application installation failed
- **Solution**: Check application compatibility and system requirements

#### "Device Offline"
- **Cause**: Target device is not connected
- **Solution**: Check device power and network connection

#### "Insufficient Resources"
- **Cause**: Device doesn't have enough resources
- **Solution**: Free up device resources or choose different device

## Best Practices

### Bundle Design
- **Logical Grouping** - Group related applications together
- **Dependency Management** - Include all required dependencies
- **Version Control** - Use version numbers for tracking
- **Documentation** - Document bundle contents and purpose
- **Testing** - Test bundles before deployment

### Deployment Planning
- **Schedule Maintenance** - Deploy during maintenance windows
- **Monitor Resources** - Ensure devices have sufficient resources
- **Plan Rollbacks** - Have rollback plans ready
- **Notify Users** - Inform users of planned deployments
- **Monitor Progress** - Watch deployment progress closely

### Application Management
- **Compatibility Testing** - Test applications before bundling
- **Resource Requirements** - Document resource requirements
- **Installation Scripts** - Use reliable installation scripts
- **Configuration Management** - Manage application configurations
- **Update Management** - Plan for application updates

### Monitoring and Maintenance
- **Progress Tracking** - Monitor deployment progress
- **Error Handling** - Handle errors promptly
- **Performance Monitoring** - Monitor post-deployment performance
- **User Feedback** - Collect user feedback on deployments
- **Documentation Updates** - Keep documentation current

## Related Features

- **[Devices](./devices.md)** - Device management and monitoring
- **[Device Profiles](./device_profiles.md)** - Device configuration management
- **[Device Tags](./device_tags.md)** - Device organization
- **[Logs](./logs.md)** - Deployment logs and diagnostics
- **[Dashboard](./dashboard.md)** - Bundle deployment overview

## API Reference

### Bundle Management API
- **GET /api/user/iot/bundles** - Get bundle list
- **POST /api/user/iot/bundles** - Create new bundle
- **GET /api/user/iot/bundles/{id}** - Get bundle details
- **PUT /api/user/iot/bundles/{id}** - Update bundle
- **DELETE /api/user/iot/bundles/{id}** - Delete bundle

### Bundle Deployment API
- **POST /api/user/iot/bundles/{id}/deploy** - Deploy bundle
- **GET /api/user/iot/bundles/{id}/deployments** - Get deployment history
- **POST /api/user/iot/bundles/{id}/rollback** - Rollback deployment
- **GET /api/user/iot/bundles/{id}/status** - Get deployment status

### Bundle Monitoring API
- **WebSocket /api/user/iot/bundles/{id}/ws** - Real-time deployment updates
- **GET /api/user/iot/bundles/{id}/logs** - Get deployment logs
- **GET /api/user/iot/bundles/{id}/progress** - Get deployment progress
- **POST /api/user/iot/bundles/{id}/pause** - Pause deployment

## Support

### Getting Help
- **In-App Help** - Use the help system within the bundles page
- **Documentation** - Check the comprehensive user guides
- **Support Portal** - Access the support system
- **Community** - Join the user community for help

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of user bundle management from creation to deployment and monitoring.
