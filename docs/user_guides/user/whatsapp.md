# User WhatsApp Guide

**Last Updated**: 2025-10-12  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **User WhatsApp** feature provides WhatsApp integration for IoT device notifications and messaging. You can configure WhatsApp accounts, send device alerts, receive status updates, and manage WhatsApp-based communications for your IoT infrastructure.

## Prerequisites

- **User account** - Valid user account with WhatsApp integration permissions
- **WhatsApp Business Account** - Valid WhatsApp Business account
- **Device access** - Access to devices for WhatsApp notifications
- **WhatsApp API** - WhatsApp Business API access

## Getting Started

### Quick Start
1. **Access WhatsApp** - Navigate to User → Integrations → WhatsApp
2. **Configure Account** - Set up WhatsApp Business account
3. **Create Templates** - Create message templates for notifications
4. **Set Up Alerts** - Configure device alert notifications
5. **Test Integration** - Test WhatsApp messaging functionality

### Navigation
- **Menu Path**: User → Integrations → WhatsApp
- **URL**: `/user/integrations/whatsapp/accounts`
- **Direct Access**: Click "WhatsApp" in the Integrations section

## Core Functionality

### WhatsApp Account Management

#### Account Configuration
- **Account Name** - Descriptive name for WhatsApp account
- **Phone Number** - WhatsApp Business phone number
- **API Credentials** - WhatsApp Business API credentials
- **Webhook URL** - Webhook URL for receiving messages
- **Account Status** - Active, inactive, or pending status
- **Verification Status** - Phone number verification status

#### Account Information
- **Account ID** - Unique account identifier
- **Business Name** - WhatsApp Business name
- **Business Category** - Business category classification
- **Account Type** - Business or Enterprise account type
- **Creation Date** - When the account was created
- **Last Activity** - Last activity timestamp
- **Message Count** - Total messages sent/received
- **Status** - Current account status

#### Account Status Indicators
- 🟢 **Active** - Account is active and operational
- 🔴 **Inactive** - Account is inactive
- 🟡 **Pending** - Account is pending verification
- 🔵 **Verified** - Account is verified and ready
- ⚪ **Suspended** - Account is suspended
- 🟠 **Error** - Account has errors and needs attention

### Message Templates

#### Template Creation
- **Template Name** - Descriptive name for the template
- **Template Type** - Type of message template
- **Template Content** - Message content and format
- **Template Variables** - Dynamic variables in the template
- **Template Language** - Language of the template
- **Template Category** - Category for template organization

#### Template Types
- **Device Alerts** - Device status and alert notifications
- **System Notifications** - System-wide notifications
- **User Messages** - User-specific messages
- **Bulk Notifications** - Bulk notification messages
- **Emergency Alerts** - Emergency and critical alerts
- **Status Updates** - Regular status update messages

#### Template Information
- **Template ID** - Unique template identifier
- **Template Status** - Approved, pending, or rejected status
- **Approval Date** - When the template was approved
- **Usage Count** - Number of times template has been used
- **Last Used** - Last time template was used
- **Template Version** - Version number for template tracking

### WhatsApp Messaging

#### Message Sending
- **Recipient Selection** - Choose message recipients
- **Template Selection** - Select message template
- **Variable Substitution** - Substitute template variables
- **Message Scheduling** - Schedule message delivery
- **Message Priority** - Set message priority level
- **Delivery Confirmation** - Confirm message delivery

#### Message Types
- **Text Messages** - Plain text messages
- **Template Messages** - Pre-approved template messages
- **Media Messages** - Messages with images, documents, etc.
- **Interactive Messages** - Messages with buttons and lists
- **Location Messages** - Messages with location information
- **Contact Messages** - Messages with contact information

#### Message Status
- 🟢 **Sent** - Message sent successfully
- 🔴 **Failed** - Message failed to send
- 🟡 **Pending** - Message pending delivery
- 🔵 **Delivered** - Message delivered to recipient
- ⚪ **Read** - Message read by recipient
- 🟠 **Expired** - Message expired before delivery

## Advanced Features

### WhatsApp Integration Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Message Delivery Timeout: 10 Seconds**
- **Per Message**: Each WhatsApp message has a **10-second timeout**
- **Timeout Behavior**: If message delivery takes too long → **FAILED**
- **Retry Logic**: Failed messages are retried up to 2 times
- **Total Message Timeout**: 30 seconds for complete message delivery (2 retries)

#### **Template Validation Timeout: 5 Seconds**
- **Per Template**: Each template validation has a **5-second timeout**
- **Timeout Behavior**: If validation takes too long → **FAILED**
- **Retry Logic**: Failed validations are retried up to 2 times
- **Total Validation Timeout**: 15 seconds for complete template validation

#### **Webhook Processing Timeout: 15 Seconds**
- **Per Webhook**: Each webhook processing has a **15-second timeout**
- **Timeout Behavior**: If webhook processing takes too long → **FAILED**
- **Retry Logic**: Failed webhooks are retried up to 2 times
- **Total Webhook Timeout**: 45 seconds for complete webhook processing

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Message Sent**: WhatsApp message sent successfully
- **Template Validated**: Message template validated successfully
- **Webhook Processed**: Webhook message processed successfully
- **No Errors**: No errors in WhatsApp operations

##### ❌ **Failure Cases**
- **Message Timeout**: Message delivery took too long
- **Template Validation Failed**: Template validation failed
- **Webhook Timeout**: Webhook processing took too long
- **API Error**: WhatsApp API returned an error

### 📊 **WhatsApp Integration Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Message       │    │   Template       │    │  WhatsApp       │
│   Creation      │───▶│   Validation     │───▶│   API           │
│                 │    │  (5sec timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Message        │◀───│  Message         │◀───│  Message        │
│   Delivered     │    │   Delivery       │    │   Sending       │
│                 │    │  (10sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Webhook        │◀───│  Webhook         │◀───│  Message        │
│   Processed     │    │   Processing     │    │   Received      │
│                 │    │  (15sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed WhatsApp Integration Process**

#### **Step 1: Message Creation**
```
Message Creation:
├── Select Template
├── Substitute Variables
├── Validate Message Content
├── Prepare Message Payload
└── Queue Message for Sending
```

#### **Step 2: Message Delivery**
```
Message Delivery:
├── Start 10-second Timer
├── Send to WhatsApp API
├── Monitor Delivery Status
├── Handle Delivery Response
└── Update Message Status
```

#### **Step 3: Webhook Processing**
```
Webhook Processing:
├── Start 15-second Timer
├── Receive Webhook Message
├── Process Message Content
├── Update System Status
└── Send Response
```

### Device Alert Integration

#### Alert Types
- **Device Online/Offline** - Device connection status alerts
- **Device Errors** - Device error and failure alerts
- **Device Performance** - Device performance alerts
- **Device Maintenance** - Device maintenance alerts
- **Device Security** - Device security alerts
- **Custom Alerts** - User-defined custom alerts

#### Alert Configuration
- **Alert Triggers** - Conditions that trigger alerts
- **Alert Recipients** - Who receives the alerts
- **Alert Frequency** - How often alerts are sent
- **Alert Escalation** - Alert escalation rules
- **Alert Suppression** - Alert suppression rules
- **Alert Templates** - Message templates for alerts

#### Alert Delivery
- **Immediate Delivery** - Send alerts immediately
- **Scheduled Delivery** - Send alerts at scheduled times
- **Batched Delivery** - Send alerts in batches
- **Priority Delivery** - Send high-priority alerts first
- **Conditional Delivery** - Send alerts based on conditions
- **Delivery Confirmation** - Confirm alert delivery

### Message Analytics

#### Message Statistics
- **Message Volume** - Number of messages sent/received
- **Delivery Rate** - Percentage of successful deliveries
- **Response Rate** - Percentage of message responses
- **Error Rate** - Percentage of failed messages
- **Average Delivery Time** - Average time for message delivery
- **Peak Usage Times** - Times of highest message activity

#### Performance Metrics
- **API Response Time** - Time taken for API responses
- **Webhook Processing Time** - Time taken to process webhooks
- **Template Usage** - Usage statistics for templates
- **User Engagement** - User engagement with messages
- **System Performance** - Overall system performance
- **Cost Analysis** - Cost analysis for WhatsApp usage

## Common Workflows

### Workflow 1: Set Up WhatsApp Integration
1. **Create Account** - Create WhatsApp Business account
2. **Configure API** - Configure WhatsApp Business API
3. **Verify Phone Number** - Verify WhatsApp phone number
4. **Create Templates** - Create message templates
5. **Test Integration** - Test WhatsApp functionality
6. **Configure Alerts** - Set up device alert notifications
7. **Go Live** - Activate WhatsApp integration

### Workflow 2: Send Device Alert
1. **Device Event** - Device generates alert event
2. **Alert Processing** - System processes alert
3. **Template Selection** - Select appropriate message template
4. **Message Creation** - Create WhatsApp message
5. **Message Sending** - Send message via WhatsApp API
6. **Delivery Confirmation** - Confirm message delivery
7. **Status Update** - Update alert status

### Workflow 3: Handle Incoming Messages
1. **Message Received** - Receive message via webhook
2. **Message Processing** - Process incoming message
3. **Message Parsing** - Parse message content
4. **Response Generation** - Generate appropriate response
5. **Response Sending** - Send response message
6. **Status Update** - Update message status
7. **Log Activity** - Log message activity

### Workflow 4: WhatsApp Account Management
1. **Review Account** - Review WhatsApp account status
2. **Check Usage** - Check account usage statistics
3. **Update Templates** - Update message templates
4. **Monitor Performance** - Monitor account performance
5. **Handle Issues** - Address any account issues
6. **Optimize Settings** - Optimize account settings
7. **Generate Reports** - Generate account reports

## 📋 **Real-World Example: Device Offline Alert**

### **Example Alert: "Office Device Offline"**
- **Device**: Office-001 (Windows IoT device)
- **Alert Type**: Device Offline
- **Recipients**: IT Team (3 members)
- **Purpose**: Notify IT team when device goes offline

### **Timeline & Expected Behavior**

#### **T+0:00 - Device Offline Event**
```
Device Offline Event:
├── Device: Office-001
├── Event: Device went offline
├── Timestamp: 2025-10-12 14:30:00
├── Alert Trigger: Device offline
└── Status: ALERT_TRIGGERED
```

#### **T+0:05 - Alert Processing**
```
Alert Processing:
├── Select Template: "Device Offline Alert"
├── Substitute Variables: Device name, timestamp
├── Prepare Message: "Office-001 went offline at 14:30:00"
├── Start 5-second template validation timer
└── Status: PROCESSING
```

#### **T+0:07 - Template Validation**
```
Template Validation:
├── Template: "Device Offline Alert"
├── Validation: SUCCESS
├── Variables: Substituted successfully
├── Validation Time: 2 seconds
└── Status: VALIDATED
```

#### **T+0:10 - Message Sending**
```
Message Sending:
├── Recipients: IT Team (3 members)
├── Message: "Office-001 went offline at 14:30:00"
├── Start 10-second delivery timer
└── Status: SENDING
```

#### **T+0:15 - Message Delivery**
```
Message Delivery:
├── Recipient 1: Message delivered (3 seconds)
├── Recipient 2: Message delivered (4 seconds)
├── Recipient 3: Message delivered (5 seconds)
├── Delivery Time: 5 seconds
└── Status: DELIVERED
```

#### **T+0:20 - Delivery Confirmation**
```
Delivery Confirmation:
├── All Messages: DELIVERED
├── Delivery Rate: 100%
├── Total Time: 20 seconds
└── Status: COMPLETE
```

### **Total Alert Time: 20 seconds**
- **Alert Processing**: 5 seconds
- **Template Validation**: 2 seconds
- **Message Sending**: 5 seconds
- **Delivery Confirmation**: 8 seconds
- **Within 10-second message timeout**

### **Webhook Processing Example**

#### **T+0:00 - Webhook Received**
```
Webhook Received:
├── Message: "Device Office-001 is back online"
├── Sender: System
├── Start 15-second webhook timer
└── Status: PROCESSING
```

#### **T+0:05 - Message Processing**
```
Message Processing:
├── Parse Message: "Device Office-001 is back online"
├── Extract Device: Office-001
├── Extract Status: Online
├── Processing Time: 5 seconds
└── Status: PROCESSED
```

#### **T+0:10 - System Update**
```
System Update:
├── Update Device Status: ONLINE
├── Update Last Seen: Current timestamp
├── Update System Status: SUCCESS
├── Update Time: 5 seconds
└── Status: UPDATED
```

#### **T+0:12 - Response Sent**
```
Response Sent:
├── Response: "Device status updated successfully"
├── Response Time: 2 seconds
├── Total Processing Time: 12 seconds
└── Status: COMPLETE
```

### **Total Webhook Time: 12 seconds**
- **Message Processing**: 5 seconds
- **System Update**: 5 seconds
- **Response Sent**: 2 seconds
- **Within 15-second webhook timeout**

### **Failure Scenario Example**

#### **T+0:00 - Message Sending Request**
```
Message Sending:
├── Recipients: IT Team (3 members)
├── Message: "Office-001 went offline at 14:30:00"
├── Start 10-second delivery timer
└── Status: SENDING
```

#### **T+0:05 - API Call**
```
API Call:
├── WhatsApp API: Called
├── API Response: Slow response
├── Delivery Status: Pending
└── Status: WAITING
```

#### **T+0:10 - Delivery Timeout**
```
Delivery Timeout:
├── 10-second timer elapsed
├── API Response: Still pending
├── Status: TIMEOUT
└── Retry Attempt 1
```

#### **T+0:12 - Retry Attempt**
```
Retry Attempt:
├── Start new 10-second Timer
├── Retry API call
├── API Response: Still slow
└── Status: RETRYING
```

#### **T+0:22 - Retry Timeout**
```
Retry Timeout:
├── 10-second timer elapsed (retry 1)
├── API Response: Still pending
├── Status: TIMEOUT
└── Retry Attempt 2
```

#### **T+0:24 - Final Retry**
```
Final Retry:
├── Start new 10-second Timer
├── Retry API call
├── API Response: Still slow
└── Status: RETRYING
```

#### **T+0:34 - Final Timeout**
```
Final Timeout:
├── 10-second timer elapsed (retry 2)
├── API Response: Still pending
├── Status: FAILED
└── Error: "Message delivery timeout after 3 attempts"
```

## Troubleshooting

### Common Issues

#### WhatsApp API Problems
- **Check API Credentials** - Verify WhatsApp API credentials
- **Check API Status** - Verify WhatsApp API is operational
- **Check Rate Limits** - Verify API rate limits are not exceeded
- **Check Network** - Verify network connectivity
- **Check Logs** - Review WhatsApp API logs
- **Contact Support** - Contact WhatsApp support if needed

#### Message Delivery Issues
- **Check Recipient Numbers** - Verify recipient phone numbers
- **Check Message Format** - Verify message format is correct
- **Check Template Status** - Verify message templates are approved
- **Check Account Status** - Verify WhatsApp account is active
- **Check Delivery Status** - Check message delivery status
- **Check Logs** - Review message delivery logs

#### Webhook Processing Problems
- **Check Webhook URL** - Verify webhook URL is correct
- **Check Webhook Security** - Verify webhook security settings
- **Check Webhook Processing** - Verify webhook processing logic
- **Check System Status** - Verify system is available
- **Check Network** - Verify network connectivity
- **Check Logs** - Review webhook processing logs

### Error Messages

#### "WhatsApp API Error"
- **Cause**: WhatsApp API returned an error
- **Solution**: Check API credentials and status

#### "Message Delivery Failed"
- **Cause**: Message failed to deliver
- **Solution**: Check recipient number and message format

#### "Template Not Approved"
- **Cause**: Message template is not approved
- **Solution**: Wait for template approval or use approved template

#### "Webhook Processing Failed"
- **Cause**: Webhook processing failed
- **Solution**: Check webhook URL and processing logic

#### "Account Suspended"
- **Cause**: WhatsApp account is suspended
- **Solution**: Contact WhatsApp support to resolve suspension

## Best Practices

### WhatsApp Integration
- **Use Approved Templates** - Use only approved message templates
- **Respect Rate Limits** - Respect WhatsApp API rate limits
- **Monitor Performance** - Monitor integration performance
- **Handle Errors** - Handle errors gracefully
- **Test Regularly** - Test integration regularly
- **Keep Updated** - Keep integration updated

### Message Management
- **Clear Messages** - Use clear and concise messages
- **Appropriate Timing** - Send messages at appropriate times
- **Respect Recipients** - Respect recipient preferences
- **Monitor Delivery** - Monitor message delivery
- **Handle Responses** - Handle incoming messages appropriately
- **Document Usage** - Document message usage and patterns

### Security and Privacy
- **Secure Credentials** - Keep API credentials secure
- **Protect Data** - Protect user data and privacy
- **Comply with Regulations** - Comply with data protection regulations
- **Monitor Access** - Monitor access to WhatsApp integration
- **Audit Usage** - Audit WhatsApp usage regularly
- **Incident Response** - Have incident response procedures

## Related Features

- **[Devices](./devices.md)** - Device management and monitoring
- **[Logs](./logs.md)** - WhatsApp integration logs and diagnostics
- **[Dashboard](./dashboard.md)** - WhatsApp integration overview
- **[Support](./support.md)** - Help with WhatsApp integration issues
- **[Account](./account.md)** - Account settings and management

## API Reference

### WhatsApp Integration API
- **GET /api/user/integrations/whatsapp/accounts** - Get WhatsApp accounts
- **POST /api/user/integrations/whatsapp/accounts** - Create WhatsApp account
- **GET /api/user/integrations/whatsapp/accounts/{id}** - Get account details
- **PUT /api/user/integrations/whatsapp/accounts/{id}** - Update account
- **DELETE /api/user/integrations/whatsapp/accounts/{id}** - Delete account

### Message Management API
- **POST /api/user/integrations/whatsapp/messages** - Send message
- **GET /api/user/integrations/whatsapp/messages** - Get message list
- **GET /api/user/integrations/whatsapp/messages/{id}** - Get message details
- **POST /api/user/integrations/whatsapp/messages/{id}/status** - Get message status

### Template Management API
- **GET /api/user/integrations/whatsapp/templates** - Get template list
- **POST /api/user/integrations/whatsapp/templates** - Create template
- **GET /api/user/integrations/whatsapp/templates/{id}** - Get template details
- **PUT /api/user/integrations/whatsapp/templates/{id}** - Update template

## Support

### Getting Help
- **In-App Help** - Use the help system within the WhatsApp page
- **Documentation** - Check the comprehensive user guides
- **Support Portal** - Access the support system
- **Community** - Join the user community for help

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of user WhatsApp integration from setup to messaging and troubleshooting.
