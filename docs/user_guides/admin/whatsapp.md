# WhatsApp User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

WhatsApp integration allows you to send notifications, alerts, and messages to users via WhatsApp. This enables real-time communication for device status updates, system alerts, and important notifications directly to users' mobile devices.

## Prerequisites

- **Admin permissions** - Full WhatsApp integration access
- **WhatsApp Business API** - Access to WhatsApp Business API
- **Phone number verification** - Verified phone numbers for messaging
- **Message templates** - Approved message templates for business messaging

## Getting Started

### Quick Start
1. **Navigate to WhatsApp** - Go to Admin → Integrations → Whatsapp
2. **Create WhatsApp Account** - Click "Create WhatsApp Account" button
3. **Configure Account** - Set up WhatsApp Business API credentials
4. **Verify Phone Numbers** - Verify phone numbers for messaging
5. **Create Message Templates** - Create approved message templates
6. **Test Integration** - Test WhatsApp messaging functionality

### Navigation
- **Menu Path**: Admin → Integrations → Whatsapp
- **URL**: `/admin/settings/whatsapp/accounts`
- **Direct Access**: Click "Whatsapp" in the Integrations section

## Core Functionality

### WhatsApp Account List View

#### Account Information Display
- **Account Name** - Human-readable account name
- **Account ID** - Unique system identifier
- **Phone Number** - WhatsApp Business phone number
- **Status** - Active/Inactive/Verification Pending
- **Created Date** - When account was created
- **Last Used** - Last time account was used
- **Message Count** - Number of messages sent
- **Success Rate** - Message delivery success rate
- **Template Count** - Number of message templates

#### Account Status Indicators
- 🟢 **Active** - Account is active and can send messages
- 🔴 **Inactive** - Account is disabled
- 🟡 **Verification Pending** - Phone number verification pending
- ⚪ **Error** - Account has configuration errors

#### Filtering and Search
- **Search by Name** - Find accounts by name
- **Search by Phone** - Find accounts by phone number
- **Filter by Status** - Show only active/inactive accounts
- **Filter by Date** - Show accounts by creation date
- **Filter by Usage** - Show accounts by message count
- **Sort Options** - Sort by name, status, usage, date, etc.

### WhatsApp Account Detail View

#### Account Information Tab
- **Basic Info** - Name, ID, phone number, status
- **Creation Info** - Created by, created date, last modified
- **API Info** - WhatsApp Business API credentials
- **Usage Info** - Message count, success rate, usage statistics

#### Account Configuration Tab
- **API Settings** - WhatsApp Business API configuration
- **Authentication** - API authentication settings
- **Webhook Settings** - Webhook configuration for message status
- **Rate Limits** - Message rate limiting settings
- **Security Settings** - Security and access control

#### Message Templates Tab
- **Template List** - Available message templates
- **Template Status** - Template approval status
- **Template Usage** - Template usage statistics
- **Template Management** - Create, update, delete templates

#### Message History Tab
- **Message Logs** - Historical message logs
- **Delivery Status** - Message delivery status
- **Error Logs** - Message delivery errors
- **Analytics** - Message analytics and insights

## Advanced Features

### WhatsApp Account Creation

#### Basic Account Setup
- **Account Name** - Choose descriptive name
- **Description** - Add detailed description
- **Phone Number** - Set WhatsApp Business phone number
- **Business Name** - Set business name for WhatsApp
- **Status** - Set initial account status

#### API Configuration
- **API Credentials** - Set WhatsApp Business API credentials
- **Access Token** - Set API access token
- **Webhook URL** - Set webhook URL for message status
- **API Version** - Set API version
- **Rate Limits** - Configure rate limiting

#### Phone Number Verification
- **Phone Verification** - Verify phone number with WhatsApp
- **Verification Code** - Enter verification code
- **Business Verification** - Complete business verification
- **Profile Setup** - Set up business profile
- **Status Check** - Check verification status

### Message Template Management

#### Template Creation
- **Template Name** - Set template name
- **Template Category** - Select template category
- **Template Language** - Set template language
- **Template Content** - Create template content
- **Template Variables** - Define template variables

#### Template Approval
- **Template Submission** - Submit template for approval
- **Approval Status** - Check approval status
- **Template Rejection** - Handle template rejections
- **Template Updates** - Update approved templates
- **Template Deletion** - Delete unused templates

#### Template Usage
- **Template Selection** - Select template for messages
- **Variable Substitution** - Substitute template variables
- **Message Personalization** - Personalize messages
- **Template Analytics** - Track template usage
- **Template Optimization** - Optimize template performance

### Message Management

#### Message Sending
- **Recipient Selection** - Select message recipients
- **Template Selection** - Select message template
- **Variable Substitution** - Substitute template variables
- **Message Scheduling** - Schedule message delivery
- **Message Priority** - Set message priority

#### Message Tracking
- **Delivery Status** - Track message delivery
- **Read Status** - Track message read status
- **Response Handling** - Handle user responses
- **Message Analytics** - Analyze message performance
- **Error Handling** - Handle delivery errors

## WhatsApp Messaging Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Message Delivery Timeout: 60 Seconds**
- **Per Message**: Each message delivery has a **60-second timeout**
- **Timeout Behavior**: If delivery takes too long → **FAILED**
- **Retry Logic**: Failed deliveries are retried up to 2 times
- **Total Delivery Timeout**: 3 minutes for complete delivery (including retries)

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Message Sent**: Message successfully sent to WhatsApp
- **Delivery Confirmed**: WhatsApp confirms message delivery
- **User Received**: User receives message on device
- **Template Valid**: Message template is approved and valid

##### ❌ **Failure Cases**
- **API Error**: WhatsApp Business API error
- **Template Rejected**: Message template not approved
- **Phone Invalid**: Invalid or unverified phone number
- **Rate Limit**: Message rate limit exceeded
- **Delivery Timeout**: No response within 60 seconds

### 📊 **WhatsApp Message Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   System Event  │    │   Message        │    │  WhatsApp       │
│     Occurs      │───▶│   Generated      │───▶│  Business API   │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Message Status │◀───│  Monitor Delivery│◀───│  Send Message   │
│    DELIVERED    │    │  (60sec timeout) │    │  to User        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Delivery Log   │◀───│  Update Status   │◀───│  User Receives  │
│   Updated       │    │  & Log Message   │    │  Message        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Message Process**

#### **Step 1: Message Generation**
```
System Event Occurs:
├── Event Data: Generated
├── Template Selection: Select appropriate template
├── Variable Substitution: Substitute template variables
└── Message Creation: Create WhatsApp message
```

#### **Step 2: Message Delivery**
```
Message Delivery:
├── Start 60-second Timer
├── Send to WhatsApp API
├── Wait for API Response
├── Process Response
└── Update Message Status
```

#### **Step 3: Delivery Confirmation**
```
Delivery Result:
├── Success → Mark as DELIVERED
├── Error → Mark as FAILED
└── Timeout → Mark as TIMEOUT
```

## Common Workflows

### Workflow 1: Create and Configure WhatsApp Account
1. **Create Account** - Set up new WhatsApp account with name and phone
2. **Configure API** - Set up WhatsApp Business API credentials
3. **Verify Phone** - Verify phone number with WhatsApp
4. **Create Templates** - Create and submit message templates
5. **Test Integration** - Test WhatsApp messaging functionality
6. **Activate Account** - Activate account for messaging
7. **Monitor Usage** - Monitor message delivery and performance

### Workflow 2: Message Template Management
1. **Create Template** - Create new message template
2. **Submit for Approval** - Submit template to WhatsApp for approval
3. **Monitor Approval** - Monitor template approval status
4. **Handle Rejections** - Handle template rejections and updates
5. **Test Template** - Test approved template
6. **Deploy Template** - Deploy template for use
7. **Monitor Usage** - Monitor template usage and performance

### Workflow 3: Send WhatsApp Message
1. **Select Recipients** - Choose message recipients
2. **Select Template** - Choose message template
3. **Substitute Variables** - Replace template variables with data
4. **Schedule Message** - Schedule message delivery
5. **Send Message** - Send message via WhatsApp API
6. **Monitor Delivery** - Track message delivery status
7. **Handle Responses** - Handle user responses if applicable

### Workflow 4: WhatsApp Troubleshooting
1. **Identify Issue** - Determine WhatsApp problem
2. **Check Account Status** - Verify account status
3. **Check API Credentials** - Verify API credentials
4. **Check Templates** - Verify template approval status
5. **Check Phone Numbers** - Verify phone number verification
6. **Check Logs** - Review message delivery logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Alert Message**

### **Example Message: "Device Offline Alert"**
- **Template**: "device_offline_alert"
- **Recipient**: "+1234567890"
- **Variables**: Device name, timestamp, location
- **Account**: "Company WhatsApp Business"

### **Timeline & Expected Behavior**

#### **T+0:00 - Device Goes Offline**
```
System Event: Device Status Change
├── Device ID: "device_office_001"
├── Device Name: "Office Terminal 1"
├── Status: "offline"
├── Location: "Office Building A"
└── Timestamp: "2025-10-12T10:30:00Z"
```

#### **T+0:01 - Message Generation**
```
Message Generation:
├── Template: "device_offline_alert"
├── Variables: {"device_name": "Office Terminal 1", "timestamp": "10:30 AM", "location": "Office Building A"}
├── Recipient: "+1234567890"
└── Message: "🚨 Alert: Office Terminal 1 is offline since 10:30 AM at Office Building A"
```

#### **T+0:02 - WhatsApp API Call**
```
WhatsApp API Call:
├── Start 60-second Timer
├── API Endpoint: "https://graph.facebook.com/v18.0/123456789/messages"
├── Method: POST
├── Headers: {"Authorization": "Bearer access_token_123"}
└── Payload: {"messaging_product": "whatsapp", "to": "+1234567890", "type": "template", "template": {...}}
```

#### **T+0:05 - API Response**
```
API Response:
├── Status Code: 200
├── Response Time: 3 seconds
├── Message ID: "wamid.1234567890abcdef"
├── Delivery Status: SENT
└── Message Status: DELIVERED
```

#### **T+0:06 - User Receives Message**
```
User Receives Message:
├── Message: "🚨 Alert: Office Terminal 1 is offline since 10:30 AM at Office Building A"
├── Delivery Time: 4 seconds
├── Read Status: PENDING
└── Message Status: DELIVERED
```

### **Total Delivery Time: 6 seconds**
- **Message Generation**: 1 second
- **API Call**: 3 seconds
- **Response Processing**: 1 second
- **User Receipt**: 1 second
- **Within 60-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - Device Goes Offline**
```
System Event: Device Status Change
├── Device ID: "device_office_001"
├── Device Name: "Office Terminal 1"
├── Status: "offline"
└── Timestamp: "2025-10-12T10:30:00Z"
```

#### **T+0:01 - Message Generation**
```
Message Generation:
├── Template: "device_offline_alert"
├── Variables: {"device_name": "Office Terminal 1", "timestamp": "10:30 AM"}
├── Recipient: "+1234567890"
└── Message: "🚨 Alert: Office Terminal 1 is offline since 10:30 AM"
```

#### **T+0:02 - WhatsApp API Call**
```
WhatsApp API Call:
├── Start 60-second Timer
├── API Endpoint: "https://graph.facebook.com/v18.0/123456789/messages"
├── Method: POST
├── Headers: {"Authorization": "Bearer invalid_token"}
└── Payload: {"messaging_product": "whatsapp", "to": "+1234567890", "type": "template", "template": {...}}
```

#### **T+0:05 - API Error Response**
```
API Error Response:
├── Status Code: 401
├── Response Time: 3 seconds
├── Error: "Invalid access token"
├── Delivery Status: FAILED
└── Message Status: FAILED
```

#### **T+0:06 - Retry Attempt**
```
Retry Attempt:
├── Retry 1: Send message again
├── Start new 60-second Timer
├── API Call: Same request
└── Wait for response
```

#### **T+1:06 - Final Failure**
```
Final Failure:
├── No response after 60 seconds (retry 1)
├── Delivery Status: FAILED
├── Message Status: FAILED
└── Message Delivery Failed - API authentication error
```

## Troubleshooting

### Common Issues

#### Account Creation Failures
- **Check API Credentials** - Verify WhatsApp Business API credentials
- **Check Phone Number** - Verify phone number format and verification
- **Check Business Verification** - Verify business verification status
- **Check Dependencies** - Ensure all dependencies are met
- **Check Validation** - Run account validation

#### Message Delivery Failures
- **Check Template Status** - Verify template approval status
- **Check Phone Numbers** - Verify recipient phone numbers
- **Check API Limits** - Verify API rate limits
- **Check Authentication** - Verify API authentication
- **Check Logs** - Review message delivery logs

#### Template Issues
- **Check Template Approval** - Verify template approval status
- **Check Template Format** - Verify template format compliance
- **Check Template Variables** - Verify template variable usage
- **Check Template Language** - Verify template language support
- **Check Logs** - Review template submission logs

#### Performance Issues
- **Check API Response Time** - Monitor API response time
- **Check Success Rate** - Monitor message success rate
- **Check Rate Limits** - Monitor API rate limits
- **Check Queue Size** - Monitor message queue size
- **Check Logs** - Review performance logs

### Error Messages

#### "Account Not Found"
- **Cause**: WhatsApp account ID doesn't exist
- **Solution**: Verify account ID and check account list

#### "Template Not Approved"
- **Cause**: Message template is not approved by WhatsApp
- **Solution**: Check template approval status and resubmit if needed

#### "Invalid Phone Number"
- **Cause**: Recipient phone number is invalid
- **Solution**: Verify phone number format and verification

#### "API Rate Limit Exceeded"
- **Cause**: WhatsApp API rate limit exceeded
- **Solution**: Wait for rate limit reset or upgrade API plan

#### "Message Delivery Timeout"
- **Cause**: Message delivery took too long
- **Solution**: Check API performance and network connectivity

## Best Practices

### Account Management
- **Secure Credentials** - Store API credentials securely
- **Regular Verification** - Keep phone numbers verified
- **Business Profile** - Maintain complete business profile
- **Account Monitoring** - Monitor account status regularly
- **Backup Accounts** - Maintain backup accounts for redundancy

### Template Management
- **Template Compliance** - Ensure template compliance with WhatsApp policies
- **Template Testing** - Test templates before submission
- **Template Optimization** - Optimize templates for better performance
- **Template Monitoring** - Monitor template usage and performance
- **Template Updates** - Keep templates updated and relevant

### Message Management
- **Message Personalization** - Personalize messages for better engagement
- **Message Timing** - Send messages at appropriate times
- **Message Frequency** - Avoid message spam
- **Message Analytics** - Analyze message performance
- **Message Optimization** - Optimize messages for better delivery

### Security
- **API Security** - Secure API credentials and access
- **Data Privacy** - Protect user data and privacy
- **Access Control** - Control access to WhatsApp features
- **Audit Logging** - Log all WhatsApp operations
- **Threat Detection** - Monitor for security threats

## Related Features

- **[Webhooks](./webhooks.md)** - Webhook integration for message status
- **[Listeners](./listeners.md)** - Event listeners for message triggers
- **[API Keys](./api_keys.md)** - API key management for WhatsApp
- **[Monitor](./monitor.md)** - System monitoring for WhatsApp performance
- **[Messaging Debug](./messaging_debug.md)** - Debug WhatsApp messaging issues

## API Reference

### WhatsApp Account API
- **GET /api/admin/settings/whatsapp/accounts** - List all WhatsApp accounts
- **POST /api/admin/settings/whatsapp/accounts** - Create new WhatsApp account
- **GET /api/admin/settings/whatsapp/accounts/{id}** - Get WhatsApp account details
- **PUT /api/admin/settings/whatsapp/accounts/{id}** - Update WhatsApp account
- **DELETE /api/admin/settings/whatsapp/accounts/{id}** - Delete WhatsApp account

### WhatsApp Message API
- **POST /api/admin/settings/whatsapp/accounts/{id}/messages** - Send WhatsApp message
- **GET /api/admin/settings/whatsapp/accounts/{id}/messages** - Get message history
- **GET /api/admin/settings/whatsapp/accounts/{id}/messages/{messageId}** - Get message details
- **POST /api/admin/settings/whatsapp/accounts/{id}/messages/{messageId}/retry** - Retry failed message

### WhatsApp Template API
- **GET /api/admin/settings/whatsapp/accounts/{id}/templates** - Get message templates
- **POST /api/admin/settings/whatsapp/accounts/{id}/templates** - Create message template
- **PUT /api/admin/settings/whatsapp/accounts/{id}/templates/{templateId}** - Update message template
- **DELETE /api/admin/settings/whatsapp/accounts/{id}/templates/{templateId}** - Delete message template

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **WhatsApp Logs** - Review WhatsApp operation logs
- **Message Logs** - Check message-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of WhatsApp integration from account setup to message delivery and troubleshooting.
