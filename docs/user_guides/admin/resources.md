# Resources User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Resources allow you to upload, manage, and distribute files, applications, and other assets to your IoT devices. This includes applications, configuration files, firmware updates, and any other files needed for device operation.

## Prerequisites

- **Admin permissions** - Full resource management access
- **File management** - Understanding of file types and formats
- **Storage knowledge** - Knowledge of storage requirements and limits
- **Security awareness** - Understanding of file security and validation

## Getting Started

### Quick Start
1. **Navigate to Resources** - Go to Admin → IOT → Resources
2. **Upload Resource** - Click "Upload Resource" button
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
- **Resource Name** - Human-readable resource name
- **Resource ID** - Unique system identifier
- **File Type** - Type of resource (app, config, firmware, etc.)
- **File Size** - Size of the resource file
- **Upload Date** - When resource was uploaded
- **Last Modified** - Last update timestamp
- **Version** - Resource version number
- **Status** - Active/Inactive/Processing
- **Usage Count** - Number of times resource is used

#### Resource Status Indicators
- 🟢 **Active** - Resource is active and available
- 🔴 **Inactive** - Resource is disabled
- 🟡 **Processing** - Resource is being processed
- ⚪ **Error** - Resource has processing errors

#### Filtering and Search
- **Search by Name** - Find resources by name
- **Filter by Type** - Show resources by file type
- **Filter by Status** - Show only active/inactive resources
- **Filter by Size** - Show resources by file size
- **Filter by Date** - Show resources by upload date
- **Sort Options** - Sort by name, type, size, date, usage, etc.

### Resource Detail View

#### Resource Information Tab
- **Basic Info** - Name, ID, description, type
- **File Info** - File size, format, checksum
- **Upload Info** - Uploaded by, upload date, last modified
- **Version Info** - Version number, version history
- **Usage Info** - Usage count, usage statistics

#### Resource Configuration Tab
- **Resource Settings** - Resource-specific settings
- **Access Control** - Resource access permissions
- **Distribution Settings** - Distribution configuration
- **Validation Settings** - Resource validation settings
- **Metadata** - Additional resource metadata

#### Usage History Tab
- **Usage Events** - Historical usage events
- **Usage Statistics** - Usage analytics and trends
- **Usage Reports** - Resource usage reports
- **Distribution History** - Distribution history

## Advanced Features

### Resource Upload

#### File Selection
- **File Browser** - Browse and select files
- **File Validation** - Validate file format and size
- **File Preview** - Preview file contents
- **File Information** - Display file information
- **File Security** - Check file security

#### Upload Configuration
- **Resource Name** - Set resource name
- **Resource Type** - Select resource type
- **Resource Description** - Add resource description
- **Access Control** - Set access permissions
- **Distribution Settings** - Configure distribution

#### Upload Process
- **File Upload** - Upload file to server
- **File Processing** - Process uploaded file
- **File Validation** - Validate file integrity
- **File Storage** - Store file securely
- **File Indexing** - Index file for search

### Resource Management

#### File Operations
- **File Download** - Download resource files
- **File Update** - Update existing resources
- **File Delete** - Delete resources
- **File Copy** - Copy resources
- **File Move** - Move resources

#### Version Management
- **Version Control** - Manage resource versions
- **Version History** - Track version history
- **Version Comparison** - Compare versions
- **Version Rollback** - Rollback to previous versions
- **Version Cleanup** - Clean up old versions

#### Access Control
- **Permission Management** - Manage resource permissions
- **Access Logging** - Log resource access
- **Security Validation** - Validate resource security
- **Threat Detection** - Detect security threats
- **Incident Response** - Respond to security incidents

## Resource Upload Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **File Upload Timeout: 30 Minutes**
- **Per File**: Each file upload has a **30-minute timeout**
- **Timeout Behavior**: If upload takes too long → **FAILED**
- **Retry Logic**: Failed uploads are retried up to 3 times
- **Chunked Upload**: Large files use chunked upload with 5-minute chunks

#### **File Processing Timeout: 10 Minutes**
- **Per File**: Each file processing has a **10-minute timeout**
- **Timeout Behavior**: If processing takes too long → **FAILED**
- **Retry Logic**: Failed processing is retried up to 2 times
- **Processing Types**: Validation, virus scan, format conversion

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Upload Complete**: File uploaded successfully
- **Processing Complete**: File processed successfully
- **Validation Passed**: File validation passed
- **Resource Active**: Resource is active and available

##### ❌ **Failure Cases**
- **Upload Timeout**: Upload takes longer than 30 minutes
- **Processing Timeout**: Processing takes longer than 10 minutes
- **Validation Failed**: File validation failed
- **Storage Full**: Insufficient storage space
- **File Corrupted**: File is corrupted or invalid

### 📊 **Resource Upload Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Selects │    │   File Upload    │    │  File Received  │
│      File       │───▶│   Process        │───▶│   by Server     │
│                 │    │  (30min timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Resource Status│◀───│  File Processing │◀───│  File Validation│
│    ACTIVE       │    │  (10min timeout) │    │   & Security    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Resource Ready │◀───│  File Storage    │◀───│  File Indexing  │
│   for Use       │    │   & Metadata     │    │   & Search      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Upload Process**

#### **Step 1: File Upload**
```
Admin Upload Request:
├── Select File
├── Start 30-minute Timer
├── Begin Chunked Upload
├── Monitor Upload Progress
└── Complete Upload
```

#### **Step 2: File Processing**
```
Upload Complete:
├── Start 10-minute Timer
├── Validate File Format
├── Scan for Viruses
├── Generate Checksum
└── Process File Metadata
```

#### **Step 3: Resource Creation**
```
Processing Complete:
├── Create Resource Record
├── Store File Securely
├── Index for Search
├── Set Resource Status: ACTIVE
└── Resource Ready for Use
```

## Common Workflows

### Workflow 1: Upload and Manage Resource
1. **Select File** - Choose file to upload
2. **Configure Resource** - Set resource name, type, and properties
3. **Upload File** - Upload file to system (30-minute timeout)
4. **Monitor Processing** - Track file processing (10-minute timeout)
5. **Verify Resource** - Confirm resource is active and available
6. **Organize Resource** - Organize resource in appropriate categories
7. **Manage Access** - Set access permissions and distribution settings

### Workflow 2: Resource Version Management
1. **Select Resource** - Choose resource to update
2. **Upload New Version** - Upload new version of resource
3. **Process New Version** - Process new version
4. **Compare Versions** - Compare with previous version
5. **Update Resource** - Update resource with new version
6. **Test New Version** - Test new version functionality
7. **Deploy New Version** - Deploy new version to devices

### Workflow 3: Resource Distribution
1. **Select Resource** - Choose resource to distribute
2. **Configure Distribution** - Set distribution settings
3. **Select Target Devices** - Choose target devices
4. **Initiate Distribution** - Start distribution process
5. **Monitor Progress** - Track distribution progress
6. **Verify Distribution** - Confirm resource is distributed
7. **Update Usage Stats** - Update resource usage statistics

### Workflow 4: Resource Troubleshooting
1. **Identify Issue** - Determine resource problem
2. **Check Upload Status** - Verify upload status
3. **Check Processing Status** - Verify processing status
4. **Check File Integrity** - Verify file integrity
5. **Check Storage** - Verify storage availability
6. **Check Logs** - Review resource logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Application Upload**

### **Example Resource: "Office App v2.1"**
- **Resource Type**: Application
- **File Size**: 50 MB
- **File Format**: .apk (Android Application Package)
- **Target Devices**: Office IoT devices

### **Timeline & Expected Behavior**

#### **T+0:00 - File Upload Start**
```
Admin Action: Upload "Office App v2.1"
├── File Size: 50 MB
├── File Type: .apk
├── Start 30-minute Timer
└── Begin Chunked Upload
```

#### **T+0:05 - Upload Progress**
```
Upload Progress: 20% (10 MB uploaded)
├── Chunk 1: Complete
├── Chunk 2: Complete
├── Chunk 3: In Progress
└── Upload Status: UPLOADING
```

#### **T+0:15 - Upload Complete**
```
Upload Progress: 100% (50 MB uploaded)
├── All Chunks: Complete
├── File Checksum: Generated
├── Upload Status: COMPLETE
└── Start File Processing
```

#### **T+0:16 - File Processing Start**
```
File Processing: Started
├── Start 10-minute Timer
├── Validate .apk Format: VALID
├── Virus Scan: CLEAN
└── Processing Status: PROCESSING
```

#### **T+0:18 - File Processing Complete**
```
File Processing: Complete
├── Format Validation: PASSED
├── Virus Scan: PASSED
├── Metadata Extraction: COMPLETE
└── Processing Status: COMPLETE
```

#### **T+0:19 - Resource Creation**
```
Resource Creation: Complete
├── Resource ID: "resource_office_app_001"
├── Resource Status: ACTIVE
├── File Storage: SECURE
└── Resource Ready for Use
```

### **Total Upload Time: 19 minutes**
- **File Upload**: 15 minutes
- **File Processing**: 2 minutes
- **Resource Creation**: 1 minute
- **Within 30-minute upload timeout**

### **Failure Scenario Example**

#### **T+0:00 - File Upload Start**
```
Admin Action: Upload "Large App v3.0"
├── File Size: 200 MB
├── File Type: .apk
├── Start 30-minute Timer
└── Begin Chunked Upload
```

#### **T+0:25 - Upload Progress**
```
Upload Progress: 60% (120 MB uploaded)
├── Chunk 1-6: Complete
├── Chunk 7: In Progress
├── Network Issue: Slow connection
└── Upload Status: UPLOADING
```

#### **T+0:35 - Upload Timeout**
```
Upload Progress: 70% (140 MB uploaded)
├── No response after 30 minutes
├── Upload Status: TIMEOUT
├── Retry Attempt 1: Restart upload
└── Start new 30-minute Timer
```

#### **T+1:05 - Upload Retry Timeout**
```
Upload Progress: 80% (160 MB uploaded)
├── No response after 30 minutes (retry 1)
├── Upload Status: TIMEOUT
├── Retry Attempt 2: Restart upload
└── Start new 30-minute Timer
```

#### **T+1:35 - Upload Final Timeout**
```
Upload Progress: 85% (170 MB uploaded)
├── No response after 30 minutes (retry 2)
├── Upload Status: FAILED
├── Resource Status: ERROR
└── Upload Failed - File too large or network issues
```

## Troubleshooting

### Common Issues

#### Upload Failures
- **Check File Size** - Verify file size is within limits
- **Check File Format** - Verify file format is supported
- **Check Network** - Verify network connectivity
- **Check Storage** - Verify sufficient storage space
- **Check Logs** - Review upload logs

#### Processing Failures
- **Check File Integrity** - Verify file is not corrupted
- **Check File Format** - Verify file format is valid
- **Check Processing Time** - Monitor processing time
- **Check Server Resources** - Verify server resources
- **Check Logs** - Review processing logs

#### Access Issues
- **Check Permissions** - Verify user permissions
- **Check Resource Status** - Verify resource is active
- **Check Access Control** - Verify access control settings
- **Check Account Status** - Verify account status
- **Check Logs** - Review access logs

#### Performance Issues
- **Check File Size** - Monitor file sizes
- **Check Upload Speed** - Monitor upload speeds
- **Check Server Load** - Monitor server performance
- **Check Storage Performance** - Monitor storage performance
- **Check Logs** - Review performance logs

### Error Messages

#### "Upload Timeout"
- **Cause**: Upload took longer than 30 minutes
- **Solution**: Check network speed and file size

#### "Processing Timeout"
- **Cause**: Processing took longer than 10 minutes
- **Solution**: Check file format and server performance

#### "File Too Large"
- **Cause**: File exceeds size limits
- **Solution**: Reduce file size or use chunked upload

#### "Invalid File Format"
- **Cause**: File format is not supported
- **Solution**: Convert file to supported format

#### "Storage Full"
- **Cause**: Insufficient storage space
- **Solution**: Free up storage space or increase storage

## Best Practices

### File Management
- **File Organization** - Organize files logically
- **File Naming** - Use consistent naming conventions
- **File Versioning** - Maintain proper version control
- **File Cleanup** - Clean up unused files regularly
- **File Backup** - Backup important files

### Upload Management
- **File Validation** - Validate files before upload
- **File Compression** - Compress files when appropriate
- **Chunked Upload** - Use chunked upload for large files
- **Progress Monitoring** - Monitor upload progress
- **Error Handling** - Handle upload errors gracefully

### Security
- **File Scanning** - Scan files for viruses
- **Access Control** - Control file access strictly
- **Audit Logging** - Log all file operations
- **File Encryption** - Encrypt sensitive files
- **Regular Updates** - Keep file system updated

### Performance
- **File Optimization** - Optimize file sizes
- **Storage Management** - Manage storage efficiently
- **Caching** - Use caching for frequently accessed files
- **Load Balancing** - Balance file operations load
- **Monitoring** - Monitor file system performance

## Related Features

- **[Bundle Management](./bundles.md)** - Use resources in bundles
- **[Device Management](./devices.md)** - Distribute resources to devices
- **[Device Profiles](./device_profiles.md)** - Include resources in profiles
- **[Device Tags](./device_tags.md)** - Organize devices for resource distribution
- **[Accounts](./accounts.md)** - Manage resource access by account

## API Reference

### Resource Management API
- **GET /api/admin/iot/resources** - List all resources
- **POST /api/admin/iot/resources** - Upload new resource
- **GET /api/admin/iot/resources/{id}** - Get resource details
- **PUT /api/admin/iot/resources/{id}** - Update resource
- **DELETE /api/admin/iot/resources/{id}** - Delete resource

### Resource Upload API
- **POST /api/admin/iot/resources/upload** - Upload resource file
- **GET /api/admin/iot/resources/upload/{id}/status** - Get upload status
- **POST /api/admin/iot/resources/upload/{id}/chunk** - Upload file chunk
- **POST /api/admin/iot/resources/upload/{id}/complete** - Complete upload

### Resource Distribution API
- **POST /api/admin/iot/resources/{id}/distribute** - Distribute resource
- **GET /api/admin/iot/resources/{id}/distribution** - Get distribution status
- **GET /api/admin/iot/resources/{id}/usage** - Get resource usage statistics
- **GET /api/admin/iot/resources/{id}/download** - Download resource

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Resource Logs** - Review resource operation logs
- **Upload Logs** - Check upload-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of resource management from upload to distribution and troubleshooting.
