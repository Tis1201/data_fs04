# PIN Rules User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

PIN Rules provide a hierarchical system for managing device PINs and access control. This system allows you to create rules that determine which PINs can be used to claim devices, with support for inheritance, precedence, and complex rule logic.

## Prerequisites

- **Admin permissions** - Full PIN rule management access
- **Device understanding** - Knowledge of device types and requirements
- **PIN management** - Understanding of PIN-based device claiming
- **Rule planning** - Plan for PIN rule hierarchy and logic

## Getting Started

### Quick Start
1. **Navigate to PIN Rules** - Go to Admin → IOT → Pin Rules
2. **Create New Rule** - Click "Create PIN Rule" button
3. **Configure Rule** - Set up rule conditions and actions
4. **Set Precedence** - Define rule precedence and inheritance
5. **Test Rule** - Test rule with sample devices
6. **Deploy Rule** - Apply rule to target devices

### Navigation
- **Menu Path**: Admin → IOT → Pin Rules
- **URL**: `/admin/iot/pin-rules`
- **Direct Access**: Click "Pin Rules" in the IOT section

## Core Functionality

### PIN Rule List View

#### Rule Information Display
- **Rule Name** - Human-readable rule name
- **Rule ID** - Unique system identifier
- **Priority** - Rule precedence/priority level
- **Status** - Active/Inactive/Draft
- **Created Date** - When rule was created
- **Last Modified** - Last update timestamp
- **Device Count** - Number of devices affected
- **Rule Type** - Rule category/type

#### Rule Status Indicators
- 🟢 **Active** - Rule is active and enforced
- 🔴 **Inactive** - Rule is disabled
- 🟡 **Draft** - Rule is being created/modified
- ⚪ **Testing** - Rule is being tested

#### Filtering and Search
- **Search by Name** - Find rules by name
- **Filter by Status** - Show only active/inactive rules
- **Filter by Type** - Show rules by type
- **Filter by Priority** - Show rules by priority level
- **Sort Options** - Sort by name, priority, status, date, etc.

### PIN Rule Detail View

#### Rule Information Tab
- **Basic Info** - Name, ID, description, priority
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, usage statistics
- **Type Info** - Rule type and category

#### Rule Configuration Tab
- **Rule Conditions** - Conditions that trigger the rule
- **Rule Actions** - Actions performed when rule matches
- **Rule Logic** - Logical operators and conditions
- **Rule Parameters** - Rule-specific parameters
- **Rule Validation** - Rule validation settings

#### Rule Hierarchy Tab
- **Parent Rules** - Parent rule relationships
- **Child Rules** - Child rule relationships
- **Inheritance** - Rule inheritance settings
- **Precedence** - Rule precedence configuration
- **Override Settings** - Rule override configuration

#### Device Assignment Tab
- **Assigned Devices** - Devices affected by rule
- **Assignment History** - Rule assignment history
- **Assignment Status** - Current assignment status
- **Assignment Management** - Manage device assignments

## Advanced Features

### PIN Rule Creation

#### Basic Rule Setup
- **Rule Name** - Choose descriptive name
- **Description** - Add detailed description
- **Priority** - Set rule priority/precedence
- **Rule Type** - Select rule type/category
- **Tags** - Add tags for organization

#### Rule Conditions
- **Device Conditions** - Device-specific conditions
- **Account Conditions** - Account-specific conditions
- **Time Conditions** - Time-based conditions
- **Location Conditions** - Location-based conditions
- **Custom Conditions** - Custom condition logic

#### Rule Actions
- **PIN Actions** - PIN-related actions
- **Access Actions** - Access control actions
- **Notification Actions** - Notification actions
- **Logging Actions** - Logging and audit actions
- **Custom Actions** - Custom action logic

#### Rule Logic
- **Logical Operators** - AND, OR, NOT operators
- **Condition Groups** - Group conditions logically
- **Nested Logic** - Complex nested conditions
- **Rule Evaluation** - Rule evaluation order
- **Rule Optimization** - Optimize rule performance

### PIN Rule Hierarchy

#### Rule Inheritance
- **Parent Rules** - Set parent rule relationships
- **Inheritance Rules** - Define inheritance behavior
- **Override Rules** - Override inherited settings
- **Inheritance Validation** - Validate inheritance rules
- **Inheritance Documentation** - Document inheritance structure

#### Rule Precedence
- **Priority Levels** - Set rule priority levels
- **Precedence Rules** - Define precedence behavior
- **Conflict Resolution** - Handle rule conflicts
- **Precedence Validation** - Validate precedence rules
- **Precedence Documentation** - Document precedence structure

#### Rule Overrides
- **Override Conditions** - Set override conditions
- **Override Actions** - Define override actions
- **Override Logic** - Implement override logic
- **Override Validation** - Validate override rules
- **Override Documentation** - Document override behavior

### PIN Rule Management

#### Rule Testing
- **Test Environment** - Set up test environment
- **Test Configuration** - Configure test settings
- **Test Execution** - Run rule tests
- **Test Results** - Review test results
- **Test Validation** - Validate test results

#### Rule Deployment
- **Deployment Planning** - Plan rule deployment
- **Deployment Execution** - Execute rule deployment
- **Deployment Monitoring** - Monitor deployment progress
- **Deployment Validation** - Validate deployment results
- **Deployment Rollback** - Rollback if needed

#### Rule Monitoring
- **Rule Execution** - Monitor rule execution
- **Rule Performance** - Track rule performance
- **Rule Errors** - Monitor rule errors
- **Rule Logs** - Review rule logs
- **Rule Analytics** - Analyze rule usage

## Common Workflows

### Workflow 1: Create and Deploy PIN Rule
1. **Create Rule** - Set up new rule with name and description
2. **Configure Conditions** - Set up rule conditions
3. **Configure Actions** - Define rule actions
4. **Set Precedence** - Set rule priority and precedence
5. **Test Rule** - Test rule with sample devices
6. **Deploy Rule** - Deploy rule to target devices
7. **Monitor Rule** - Track rule execution and performance

### Workflow 2: Update Existing PIN Rule
1. **Select Rule** - Choose rule to update
2. **Modify Conditions** - Update rule conditions
3. **Modify Actions** - Update rule actions
4. **Update Precedence** - Modify rule precedence
5. **Test Updates** - Test updated rule
6. **Deploy Updates** - Deploy updated rule
7. **Monitor Updates** - Track update progress

### Workflow 3: Rule Hierarchy Management
1. **Create Parent Rule** - Set up parent rule
2. **Create Child Rules** - Set up child rules
3. **Configure Inheritance** - Set inheritance rules
4. **Set Precedence** - Configure rule precedence
5. **Test Hierarchy** - Test rule hierarchy
6. **Deploy Hierarchy** - Deploy rule hierarchy
7. **Monitor Hierarchy** - Track hierarchy performance

### Workflow 4: PIN Rule Troubleshooting
1. **Identify Issue** - Determine rule problem
2. **Check Rule Logic** - Review rule conditions and actions
3. **Check Precedence** - Verify rule precedence
4. **Check Logs** - Review rule execution logs
5. **Test Manually** - Test rule manually
6. **Fix Issues** - Resolve identified problems
7. **Retry Rule** - Attempt rule execution again

## Troubleshooting

### Common Issues

#### Rule Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Rule Logic** - Verify rule logic is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run rule validation

#### Rule Execution Failures
- **Check Rule Conditions** - Verify rule conditions are met
- **Check Rule Actions** - Verify rule actions are valid
- **Check Rule Logic** - Verify rule logic is correct
- **Check Dependencies** - Ensure all dependencies are met
- **Check Logs** - Review rule execution logs

#### Rule Precedence Issues
- **Check Priority Levels** - Verify priority levels are set correctly
- **Check Inheritance** - Verify inheritance rules are correct
- **Check Overrides** - Verify override rules are correct
- **Check Conflicts** - Resolve rule conflicts
- **Check Validation** - Run precedence validation

#### Rule Performance Issues
- **Check Rule Complexity** - Simplify complex rules
- **Check Rule Optimization** - Optimize rule performance
- **Check Resource Usage** - Monitor resource usage
- **Check Execution Time** - Monitor execution time
- **Check Logs** - Review performance logs

### Error Messages

#### "Rule Not Found"
- **Cause**: Rule ID doesn't exist in system
- **Solution**: Verify rule ID and check rule list

#### "Rule Logic Error"
- **Cause**: Rule logic is invalid or malformed
- **Solution**: Fix rule logic and validate

#### "Rule Conflict"
- **Cause**: Rule conflicts with another rule
- **Solution**: Resolve rule conflict

#### "Rule Execution Failed"
- **Cause**: Rule execution failed
- **Solution**: Check rule conditions and actions

#### "Rule Validation Error"
- **Cause**: Rule validation failed
- **Solution**: Fix validation errors and retry

## Best Practices

### Rule Design
- **Standardization** - Use consistent naming and structure
- **Documentation** - Document rule purpose and logic
- **Version Control** - Maintain proper version numbering
- **Testing** - Test rules thoroughly before deployment
- **Validation** - Validate rules before deployment

### Rule Management
- **Modular Design** - Create modular, reusable rules
- **Inheritance** - Use rule inheritance for common logic
- **Override Management** - Manage rule overrides carefully
- **Conflict Resolution** - Implement proper conflict resolution
- **Change Management** - Track and manage rule changes

### Performance Optimization
- **Rule Optimization** - Optimize rule performance
- **Resource Management** - Monitor resource usage
- **Execution Time** - Monitor execution time
- **Caching** - Use caching for frequently used rules
- **Indexing** - Use proper indexing for rule conditions

### Security
- **Access Control** - Limit rule access to authorized users
- **Rule Security** - Secure rule configurations
- **Audit Logging** - Log all rule operations
- **Validation** - Validate rule security settings
- **Regular Updates** - Keep rules updated with security patches

## Related Features

- **[Device Management](./devices.md)** - Manage devices that use PIN rules
- **[Device Profiles](./device_profiles.md)** - Configure device profiles with PIN rules
- **[Device Tags](./device_tags.md)** - Organize devices for PIN rule assignment
- **[Factory Tokens](./factory_tokens.md)** - Manage factory tokens for device registration
- **[Preclaims](./preclaims.md)** - Pre-configure device claims with PIN rules

## API Reference

### PIN Rule Management API
- **GET /api/admin/iot/pin-rules** - List all PIN rules
- **POST /api/admin/iot/pin-rules** - Create new PIN rule
- **GET /api/admin/iot/pin-rules/{id}** - Get PIN rule details
- **PUT /api/admin/iot/pin-rules/{id}** - Update PIN rule
- **DELETE /api/admin/iot/pin-rules/{id}** - Delete PIN rule

### PIN Rule Assignment API
- **POST /api/admin/iot/pin-rules/{id}/assign** - Assign PIN rule to devices
- **GET /api/admin/iot/pin-rules/{id}/assignments** - Get assignment history
- **PUT /api/admin/iot/pin-rules/{id}/assignments/{deviceId}** - Update assignment
- **DELETE /api/admin/iot/pin-rules/{id}/assignments/{deviceId}** - Remove assignment

### PIN Rule Execution API
- **POST /api/admin/iot/pin-rules/{id}/execute** - Execute PIN rule
- **GET /api/admin/iot/pin-rules/{id}/execution** - Get execution history
- **GET /api/admin/iot/pin-rules/{id}/logs** - Get rule execution logs
- **GET /api/admin/iot/pin-rules/{id}/metrics** - Get rule performance metrics

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Rule Logs** - Review rule execution logs
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of PIN rule management from creation to deployment and troubleshooting.
