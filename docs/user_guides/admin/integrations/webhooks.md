# Webhooks User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Webhooks allow you to receive real-time notifications about events in the IoT Management System. They enable external systems to be notified when specific events occur, such as device status changes, bundle deployments, or user actions, allowing for seamless integration with third-party services.

## Prerequisites

- **Admin permissions** - Full webhook management access
- **HTTP knowledge** - Understanding of HTTP requests and responses
- **Integration experience** - Experience with external system integration

## Getting Started

### Quick Start
1. **Navigate to Webhooks** - Go to Admin → Settings → Webhook Endpoints
2. **Add Webhook** - Click "Add Webhook" button
3. **Configure Webhook** - Set webhook name, postfix, and description
4. **Set Status** - Set webhook status (Active/Inactive)
5. **Save Webhook** - Save the webhook endpoint
6. **Monitor Webhook** - Track webhook usage and status

### Navigation
- **Menu Path**: Admin → Settings → Webhook Endpoints
- **URL**: `/admin/settings/webhook`
- **Direct Access**: Click "Webhook Endpoints" in the Settings section

## Core Functionality

### Webhook List View

#### Webhook Information Display
- **Name** - Human-readable webhook name with clickable link
- **Webhook ID** - Unique system identifier (displayed with name)
- **Endpoint** - Webhook endpoint URL with postfix
- **Created At** - When webhook was created (relative format)
- **Last Used** - Last time webhook was used (relative format)
- **Status** - Webhook status (Active, Inactive)

#### Webhook Status Indicators
- 🟢 **Active** - Webhook is active and receiving events
- 🔴 **Inactive** - Webhook is disabled

#### Filtering and Search
- **Search by Name/Postfix** - Find webhooks by name or postfix
- **Filter by Status** - Show webhooks by status (Active, Inactive)
- **Sort Options** - Sort by name, status, created date, last used date
- **Pagination** - Navigate through multiple pages of webhooks

### Webhook Detail View

#### Webhook Information Section
- **Basic Info** - Name, ID, description, endpoint URL
- **Status** - Webhook status (Active, Inactive)
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, postfix, description, status

#### Webhook Actions
- **Edit Webhook** - Modify webhook details
- **Activate/Deactivate** - Toggle webhook status
- **Delete Webhook** - Remove webhook (with confirmation)

## Advanced Features

### Webhook Creation

#### Basic Webhook Setup
- **Webhook Name** - Choose descriptive name (required)
- **Postfix** - Set webhook postfix for endpoint URL (required)
- **Description** - Add detailed description (optional)
- **Status** - Set webhook status (Active, Inactive)

#### Endpoint Configuration
- **Endpoint URL** - Generated from base path and postfix
- **Base Path** - `/api/webhook` (system-defined)
- **Postfix** - Custom postfix for webhook endpoint
- **Full URL** - Complete webhook endpoint URL

#### Webhook Management
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Toggle webhook active/inactive status
- **Webhook Actions** - Edit, activate/deactivate, or delete webhooks
- **Usage Tracking** - Track webhook usage and last used timestamp

## Common Workflows

### Workflow 1: Create New Webhook
1. **Navigate to Webhooks** - Go to Admin → Settings → Webhook Endpoints
2. **Click "Add Webhook"** - Start webhook creation process
3. **Enter Webhook Details** - Fill in name, postfix, and description
4. **Set Status** - Set webhook to Active or Inactive
5. **Save Webhook** - Save the webhook endpoint
6. **Verify Creation** - Confirm webhook is created successfully

### Workflow 2: View Webhook Details
1. **Find Webhook** - Use search to locate webhook
2. **Click Webhook Name** - Open webhook detail view
3. **View Information** - Review webhook details
4. **Check Status** - Verify webhook status and endpoint URL

### Workflow 3: Edit Webhook
1. **Select Webhook** - Choose webhook from list
2. **Click Edit** - Open webhook for editing
3. **Modify Information** - Update name, postfix, description, or status
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 4: Toggle Webhook Status
1. **Select Webhook** - Choose webhook from list
2. **Click Activate/Deactivate** - Toggle webhook status
3. **Confirm Action** - Confirm status change in dialog
4. **Verify Status** - Confirm status change is applied

### Workflow 5: Delete Webhook
1. **Select Webhook** - Choose webhook from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm webhook is removed from list


## Troubleshooting

### Common Issues

#### Webhook Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Webhook Name** - Ensure webhook name is unique and valid
- **Postfix** - Verify postfix is unique and valid
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Webhook Management Issues
- **Cannot Edit Webhook** - Check admin permissions and webhook status
- **Status Toggle Failed** - Check webhook permissions and status
- **Delete Failed** - Check webhook dependencies and permissions
- **Webhook Not Found** - Verify webhook exists and is accessible

### Error Messages

#### "Webhook Not Found"
- **Cause**: Webhook ID doesn't exist in system
- **Solution**: Verify webhook ID and check webhook list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Postfix Already Exists"
- **Cause**: Postfix is already in use
- **Solution**: Choose a different postfix for the webhook

## Best Practices

### Webhook Design
- **Descriptive Names** - Use clear, descriptive webhook names
- **Unique Postfixes** - Use unique postfixes for webhook endpoints
- **Helpful Descriptions** - Add descriptions for webhook purpose
- **Appropriate Status** - Set appropriate initial status
- **Clear Documentation** - Document webhook purpose and usage

### Webhook Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Webhook Functionality** - Verify webhooks work as expected
- **Backup Data** - Keep backups of important webhook data

### Endpoint Management
- **Unique Postfixes** - Ensure postfixes are unique across webhooks
- **Status Management** - Manage webhook active/inactive status appropriately
- **Usage Tracking** - Monitor webhook usage and last used timestamps
- **Organization** - Organize webhooks logically
- **Cleanup** - Clean up unused or invalid webhooks

### Security
- **Access Control** - Control webhook access strictly
- **Permission Management** - Manage webhook permissions carefully
- **Data Protection** - Protect sensitive webhook information
- **Audit Logging** - Log all webhook operations

## Technical Details

### Webhook Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable webhook name
- **Postfix** - Webhook postfix for endpoint URL
- **Description** - Webhook description
- **Status** - Webhook status (Active, Inactive)
- **Created At** - Webhook creation timestamp
- **Last Used At** - Last time webhook was used
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Webhook name, postfix, description
- **Sort Options** - Name, status, created date, last used date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Active, Inactive)

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Postfix Validation** - Unique postfix validation
- **Status Management** - Active/Inactive status toggle
- **Save/Cancel Actions** - Standard form actions

## Related Features

- **[Listeners](./listeners.md)** - Event listeners for webhook triggers
- **[API Keys](./api_keys.md)** - API key management for webhook authentication
- **[Monitor](./monitor.md)** - System monitoring for webhook performance

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Webhook Errors** - Verify webhook exists and is accessible
- **Permission Issues** - Check admin permissions

---

**Status**: ✅ Updated - This guide now accurately reflects the current webhook management UI and functionality.
