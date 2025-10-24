# Listeners User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Listeners are event-driven components that monitor system events and trigger actions based on specific conditions. They enable automated responses to system events such as device status changes, user actions, or system alerts, providing real-time event processing and automation capabilities.

## Prerequisites

- **Admin permissions** - Full listener management access
- **Event understanding** - Knowledge of system events and triggers

## Getting Started

### Quick Start
1. **Navigate to Listeners** - Go to Admin → Settings → Event Listeners
2. **Add Listener** - Click "Add Listener" button
3. **Configure Listener** - Set listener name, postfix, and description
4. **Set Connections** - Configure webhook and WhatsApp connections
5. **Set Status** - Set listener status (Active/Inactive)
6. **Save Listener** - Save the listener endpoint

### Navigation
- **Menu Path**: Admin → Settings → Event Listeners
- **URL**: `/admin/settings/listeners`
- **Direct Access**: Click "Event Listeners" in the Settings section

## Core Functionality

### Listener List View

#### Listener Information Display
- **Name** - Human-readable listener name with clickable link
- **Listener ID** - Unique system identifier (displayed with name)
- **Endpoint** - Listener endpoint URL with postfix
- **Created At** - When listener was created (relative format)
- **Connections** - Associated webhook and WhatsApp connections
- **Status** - Listener status (Active, Inactive)

#### Listener Status Indicators
- 🟢 **Active** - Listener is active and monitoring events
- 🔴 **Inactive** - Listener is disabled

#### Filtering and Search
- **Search by Name/Postfix** - Find listeners by name or postfix
- **Filter by Status** - Show listeners by status (Active, Inactive)
- **Sort Options** - Sort by name, status, created date
- **Pagination** - Navigate through multiple pages of listeners

### Listener Detail View

#### Listener Information Section
- **Basic Info** - Name, ID, description, endpoint URL
- **Status** - Listener status (Active, Inactive)
- **Form Validation** - Real-time validation with error messages
- **Form Fields** - Name, postfix, description, status

#### Connection Configuration
- **Webhook Connections** - Associated webhook endpoints
- **WhatsApp Connections** - Associated WhatsApp accounts
- **Listen to All** - Option to listen to all events
- **Connection Management** - Add/remove connections

#### Listener Actions
- **Edit Listener** - Modify listener details
- **Activate/Deactivate** - Toggle listener status
- **Delete Listener** - Remove listener (with confirmation)

## Advanced Features

### Listener Creation

#### Basic Listener Setup
- **Listener Name** - Choose descriptive name (required)
- **Postfix** - Set listener postfix for endpoint URL (required)
- **Description** - Add detailed description (optional)
- **Status** - Set listener status (Active, Inactive)

#### Endpoint Configuration
- **Endpoint URL** - Generated from base path and postfix
- **Base Path** - `/api/listen` (system-defined)
- **Postfix** - Custom postfix for listener endpoint
- **Full URL** - Complete listener endpoint URL

#### Connection Management
- **Webhook Connections** - Associate webhook endpoints
- **WhatsApp Connections** - Associate WhatsApp accounts
- **Listen to All** - Option to listen to all events
- **Connection Selection** - Choose specific connections

#### Listener Management
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Toggle listener active/inactive status
- **Listener Actions** - Edit, activate/deactivate, or delete listeners
- **Connection Tracking** - Track associated webhook and WhatsApp connections

## Common Workflows

### Workflow 1: Create New Listener
1. **Navigate to Listeners** - Go to Admin → Settings → Event Listeners
2. **Click "Add Listener"** - Start listener creation process
3. **Enter Listener Details** - Fill in name, postfix, and description
4. **Configure Connections** - Set webhook and WhatsApp connections
5. **Set Status** - Set listener to Active or Inactive
6. **Save Listener** - Save the listener endpoint
7. **Verify Creation** - Confirm listener is created successfully

### Workflow 2: View Listener Details
1. **Find Listener** - Use search to locate listener
2. **Click Listener Name** - Open listener detail view
3. **View Information** - Review listener details and connections
4. **Check Status** - Verify listener status and endpoint URL

### Workflow 3: Edit Listener
1. **Select Listener** - Choose listener from list
2. **Click Edit** - Open listener for editing
3. **Modify Information** - Update name, postfix, description, or connections
4. **Save Changes** - Confirm changes with save button
5. **Verify Update** - Confirm changes are saved

### Workflow 4: Toggle Listener Status
1. **Select Listener** - Choose listener from list
2. **Click Activate/Deactivate** - Toggle listener status
3. **Confirm Action** - Confirm status change in dialog
4. **Verify Status** - Confirm status change is applied

### Workflow 5: Delete Listener
1. **Select Listener** - Choose listener from list
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm listener is removed from list


## Troubleshooting

### Common Issues

#### Listener Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Listener Name** - Ensure listener name is unique and valid
- **Postfix** - Verify postfix is unique and valid
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Listener Management Issues
- **Cannot Edit Listener** - Check admin permissions and listener status
- **Status Toggle Failed** - Check listener permissions and status
- **Delete Failed** - Check listener dependencies and permissions
- **Listener Not Found** - Verify listener exists and is accessible

#### Connection Issues
- **Webhook Connections** - Check webhook endpoint availability
- **WhatsApp Connections** - Check WhatsApp account status
- **Connection Configuration** - Verify connection settings
- **Connection Status** - Check connection health

### Error Messages

#### "Listener Not Found"
- **Cause**: Listener ID doesn't exist in system
- **Solution**: Verify listener ID and check listener list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Postfix Already Exists"
- **Cause**: Postfix is already in use
- **Solution**: Choose a different postfix for the listener

#### "Connection Failed"
- **Cause**: Webhook or WhatsApp connection failed
- **Solution**: Check connection status and configuration

## Best Practices

### Listener Design
- **Descriptive Names** - Use clear, descriptive listener names
- **Unique Postfixes** - Use unique postfixes for listener endpoints
- **Helpful Descriptions** - Add descriptions for listener purpose
- **Appropriate Status** - Set appropriate initial status
- **Clear Documentation** - Document listener purpose and usage

### Listener Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Listener Functionality** - Verify listeners work as expected
- **Backup Data** - Keep backups of important listener data

### Connection Management
- **Webhook Connections** - Choose appropriate webhook endpoints
- **WhatsApp Connections** - Select appropriate WhatsApp accounts
- **Connection Health** - Monitor connection health regularly
- **Connection Testing** - Test connections periodically
- **Connection Optimization** - Optimize connection performance

### Endpoint Management
- **Unique Postfixes** - Ensure postfixes are unique across listeners
- **Status Management** - Manage listener active/inactive status appropriately
- **Connection Tracking** - Track associated webhook and WhatsApp connections
- **Organization** - Organize listeners logically
- **Cleanup** - Clean up unused or invalid listeners

## Technical Details

### Listener Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable listener name
- **Postfix** - Listener postfix for endpoint URL
- **Description** - Listener description
- **Status** - Listener status (Active, Inactive)
- **Created At** - Listener creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Listener name, postfix, description
- **Sort Options** - Name, status, created date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Status (Active, Inactive)

### Form Features
- **Real-time Validation** - Form validation with error messages
- **Postfix Validation** - Unique postfix validation
- **Status Management** - Active/Inactive status toggle
- **Connection Management** - Webhook and WhatsApp connection selection
- **Save/Cancel Actions** - Standard form actions

### Connection Management
- **Webhook Connections** - Associate webhook endpoints
- **WhatsApp Connections** - Associate WhatsApp accounts
- **Listen to All** - Option to listen to all events
- **Connection Display** - Visual connection badges

## Related Features

- **[Webhooks](./webhooks.md)** - Webhook integration for listener actions
- **[WhatsApp](./whatsapp.md)** - WhatsApp integration for notifications

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Listener Errors** - Verify listener exists and is accessible
- **Permission Issues** - Check admin permissions
- **Connection Issues** - Check webhook and WhatsApp connection status

---

**Status**: ✅ Updated - This guide now accurately reflects the current listener management UI and functionality.
