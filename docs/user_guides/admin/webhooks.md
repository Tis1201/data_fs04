# Webhooks User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Webhooks allow you to receive real-time notifications about events in the IoT Management System. They enable external systems to be notified when specific events occur, such as device status changes, bundle deployments, or user actions, allowing for seamless integration with third-party services.

## Prerequisites

- **Admin permissions** - Full webhook management access
- **HTTP knowledge** - Understanding of HTTP requests and responses
- **Integration experience** - Experience with external system integration
- **Security awareness** - Understanding of webhook security and authentication

## Getting Started

### Quick Start
1. **Navigate to Webhooks** - Go to Admin → Integrations → Webhook
2. **Create New Webhook** - Click "Create Webhook" button
3. **Configure Webhook** - Set webhook URL, events, and authentication
4. **Test Webhook** - Test webhook configuration
5. **Activate Webhook** - Activate webhook for use
6. **Monitor Webhook** - Monitor webhook delivery and performance

### Navigation
- **Menu Path**: Admin → Integrations → Webhook
- **URL**: `/admin/settings/webhook`
- **Direct Access**: Click "Webhook" in the Integrations section

## Core Functionality

### Webhook List View

#### Webhook Information Display
- **Webhook Name** - Human-readable webhook name
- **Webhook ID** - Unique system identifier
- **URL** - Target webhook URL
- **Status** - Active/Inactive/Error
- **Events** - Number of subscribed events
- **Created Date** - When webhook was created
- **Last Triggered** - Last time webhook was triggered
- **Success Rate** - Webhook delivery success rate
- **Response Time** - Average response time

#### Webhook Status Indicators
- 🟢 **Active** - Webhook is active and delivering events
- 🔴 **Inactive** - Webhook is disabled
- 🟡 **Error** - Webhook has delivery errors
- ⚪ **Testing** - Webhook is being tested

#### Filtering and Search
- **Search by Name** - Find webhooks by name
- **Search by URL** - Find webhooks by URL
- **Filter by Status** - Show only active/inactive webhooks
- **Filter by Events** - Show webhooks by event type
- **Filter by Date** - Show webhooks by creation date
- **Sort Options** - Sort by name, status, success rate, date, etc.

### Webhook Detail View

#### Webhook Information Tab
- **Basic Info** - Name, ID, description, URL
- **Creation Info** - Created by, created date, last modified
- **Status Info** - Current status, status history
- **Performance Info** - Success rate, response time, error count

#### Webhook Configuration Tab
- **URL Settings** - Webhook URL and method
- **Event Settings** - Subscribed events and filters
- **Authentication** - Authentication settings
- **Headers** - Custom headers configuration
- **Retry Settings** - Retry and timeout configuration

#### Delivery History Tab
- **Delivery Events** - Historical delivery events
- **Success/Failure** - Delivery success and failure logs
- **Response Codes** - HTTP response codes received
- **Response Times** - Delivery response times
- **Error Details** - Detailed error information

## Advanced Features

### Webhook Creation

#### Basic Webhook Setup
- **Webhook Name** - Choose descriptive name
- **Description** - Add detailed description
- **Target URL** - Set webhook endpoint URL
- **HTTP Method** - Select HTTP method (POST, PUT, PATCH)
- **Status** - Set initial webhook status

#### Event Configuration
- **Event Selection** - Select events to subscribe to
- **Event Filters** - Set event filters and conditions
- **Event Payload** - Configure event payload format
- **Event Priority** - Set event priority levels
- **Event Validation** - Configure event validation

#### Authentication Configuration
- **API Key** - Set API key authentication
- **Bearer Token** - Set bearer token authentication
- **Basic Auth** - Set basic authentication
- **Custom Headers** - Set custom authentication headers
- **Signature Verification** - Configure signature verification

### Webhook Management

#### Event Management
- **Event Subscription** - Manage event subscriptions
- **Event Filtering** - Configure event filters
- **Event Transformation** - Transform event payloads
- **Event Validation** - Validate event data
- **Event Monitoring** - Monitor event delivery

#### Delivery Management
- **Delivery Retry** - Configure retry logic
- **Delivery Timeout** - Set delivery timeouts
- **Delivery Queuing** - Manage delivery queues
- **Delivery Monitoring** - Monitor delivery performance
- **Delivery Analytics** - Analyze delivery patterns

#### Security Management
- **Authentication** - Manage authentication methods
- **Authorization** - Control webhook access
- **Encryption** - Configure data encryption
- **Audit Logging** - Log webhook operations
- **Threat Detection** - Detect security threats

## Webhook Delivery Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Webhook Delivery Timeout: 30 Seconds**
- **Per Delivery**: Each webhook delivery has a **30-second timeout**
- **Timeout Behavior**: If delivery takes too long → **FAILED**
- **Retry Logic**: Failed deliveries are retried up to 3 times
- **Total Delivery Timeout**: 2 minutes for complete delivery (including retries)

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **HTTP 200-299**: Successful delivery with 2xx response
- **Delivery Complete**: Webhook delivered successfully
- **Response Received**: Valid response received from endpoint
- **Webhook Active**: Webhook remains active

##### ❌ **Failure Cases**
- **HTTP 400-599**: Client or server error response
- **Delivery Timeout**: No response within 30 seconds
- **Connection Error**: Network connection failure
- **Authentication Error**: Authentication failure
- **Validation Error**: Payload validation failure

### 📊 **Webhook Delivery Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   System Event  │    │   Webhook        │    │  Target Endpoint│
│     Occurs      │───▶│   Triggered      │───▶│   Receives      │
│                 │    │                  │    │   Request       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Delivery Status│◀───│  Monitor Delivery│◀───│  Process Request│
│    SUCCESS      │    │  (30sec timeout) │    │  & Send Response│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Webhook Status │◀───│  Update Status   │◀───│  Return Response│
│    ACTIVE       │    │  & Log Delivery  │    │  to System      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Delivery Process**

#### **Step 1: Event Trigger**
```
System Event Occurs:
├── Event Data: Generated
├── Webhook Lookup: Find subscribed webhooks
├── Event Filtering: Apply event filters
└── Delivery Queue: Add to delivery queue
```

#### **Step 2: Webhook Delivery**
```
Webhook Delivery:
├── Start 30-second Timer
├── Send HTTP Request
├── Wait for Response
├── Process Response
└── Update Delivery Status
```

#### **Step 3: Delivery Completion**
```
Delivery Result:
├── Success (2xx) → Mark as SUCCESS
├── Error (4xx/5xx) → Mark as FAILED
└── Timeout → Mark as TIMEOUT
```

## Common Workflows

### Workflow 1: Create and Configure Webhook
1. **Create Webhook** - Set up new webhook with name and URL
2. **Configure Events** - Select events to subscribe to
3. **Set Authentication** - Configure authentication method
4. **Test Webhook** - Test webhook configuration
5. **Activate Webhook** - Activate webhook for delivery
6. **Monitor Delivery** - Monitor webhook delivery performance
7. **Troubleshoot Issues** - Resolve any delivery issues

### Workflow 2: Event Subscription Management
1. **Select Webhook** - Choose webhook to manage
2. **View Events** - Review subscribed events
3. **Add Events** - Add new event subscriptions
4. **Remove Events** - Remove event subscriptions
5. **Configure Filters** - Set event filters
6. **Test Events** - Test event delivery
7. **Monitor Events** - Monitor event delivery

### Workflow 3: Webhook Testing and Validation
1. **Select Webhook** - Choose webhook to test
2. **Configure Test** - Set up test parameters
3. **Send Test Event** - Send test event to webhook
4. **Monitor Delivery** - Monitor test delivery
5. **Verify Response** - Verify endpoint response
6. **Check Logs** - Review delivery logs
7. **Validate Configuration** - Confirm webhook is working

### Workflow 4: Webhook Troubleshooting
1. **Identify Issue** - Determine webhook problem
2. **Check Status** - Verify webhook status
3. **Check Logs** - Review delivery logs
4. **Test Endpoint** - Test endpoint manually
5. **Check Authentication** - Verify authentication
6. **Check Network** - Verify network connectivity
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Status Webhook**

### **Example Webhook: "Device Status Notifications"**
- **Webhook URL**: `https://api.company.com/webhooks/device-status`
- **Events**: Device status changes (online/offline)
- **Authentication**: API Key
- **Target System**: Company monitoring system

### **Timeline & Expected Behavior**

#### **T+0:00 - Device Status Change**
```
System Event: Device Status Change
├── Device ID: "device_office_001"
├── Old Status: "online"
├── New Status: "offline"
└── Event Data: Generated
```

#### **T+0:01 - Webhook Triggered**
```
Webhook Triggered:
├── Webhook ID: "webhook_device_status_001"
├── Event Type: "device.status.changed"
├── Start 30-second Timer
└── Send HTTP POST Request
```

#### **T+0:02 - HTTP Request Sent**
```
HTTP Request Sent:
├── URL: "https://api.company.com/webhooks/device-status"
├── Method: POST
├── Headers: {"Authorization": "Bearer api_key_123", "Content-Type": "application/json"}
├── Payload: {"deviceId": "device_office_001", "status": "offline", "timestamp": "2025-10-12T10:30:00Z"}
└── Request Status: SENT
```

#### **T+0:05 - Response Received**
```
Response Received:
├── Status Code: 200
├── Response Time: 3 seconds
├── Response Body: {"status": "success", "message": "Event received"}
├── Delivery Status: SUCCESS
└── Webhook Status: ACTIVE
```

### **Total Delivery Time: 5 seconds**
- **Event Processing**: 1 second
- **HTTP Request**: 2 seconds
- **Response Processing**: 2 seconds
- **Within 30-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - Device Status Change**
```
System Event: Device Status Change
├── Device ID: "device_office_001"
├── Old Status: "online"
├── New Status: "offline"
└── Event Data: Generated
```

#### **T+0:01 - Webhook Triggered**
```
Webhook Triggered:
├── Webhook ID: "webhook_device_status_001"
├── Event Type: "device.status.changed"
├── Start 30-second Timer
└── Send HTTP POST Request
```

#### **T+0:31 - Delivery Timeout**
```
Delivery Timeout:
├── No response after 30 seconds
├── Delivery Status: TIMEOUT
├── Retry Attempt 1: Send request again
├── Start new 30-second Timer
└── Wait for response
```

#### **T+1:01 - Retry Timeout**
```
Retry Timeout:
├── No response after 30 seconds (retry 1)
├── Delivery Status: TIMEOUT
├── Retry Attempt 2: Send request again
├── Start new 30-second Timer
└── Wait for response
```

#### **T+1:31 - Final Timeout**
```
Final Timeout:
├── No response after 30 seconds (retry 2)
├── Delivery Status: FAILED
├── Webhook Status: ERROR
└── Delivery Failed - Endpoint not responding
```

## Troubleshooting

### Common Issues

#### Webhook Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check URL Format** - Verify webhook URL is valid
- **Check Authentication** - Verify authentication configuration
- **Check Dependencies** - Ensure all dependencies are met
- **Check Validation** - Run webhook validation

#### Delivery Failures
- **Check Endpoint Status** - Verify endpoint is accessible
- **Check Authentication** - Verify authentication credentials
- **Check Network** - Verify network connectivity
- **Check Payload** - Verify payload format
- **Check Logs** - Review delivery logs

#### Performance Issues
- **Check Response Time** - Monitor endpoint response time
- **Check Success Rate** - Monitor delivery success rate
- **Check Retry Logic** - Verify retry configuration
- **Check Queue Size** - Monitor delivery queue size
- **Check Logs** - Review performance logs

#### Security Issues
- **Check Authentication** - Verify authentication methods
- **Check Authorization** - Verify access control
- **Check Encryption** - Verify data encryption
- **Check Audit Logs** - Review security logs
- **Check Threat Detection** - Monitor for security threats

### Error Messages

#### "Webhook Not Found"
- **Cause**: Webhook ID doesn't exist in system
- **Solution**: Verify webhook ID and check webhook list

#### "Delivery Timeout"
- **Cause**: Endpoint didn't respond within 30 seconds
- **Solution**: Check endpoint performance and network connectivity

#### "Authentication Failed"
- **Cause**: Authentication credentials are invalid
- **Solution**: Verify authentication configuration

#### "Invalid Payload"
- **Cause**: Webhook payload is malformed
- **Solution**: Check payload format and validation

#### "Endpoint Error"
- **Cause**: Endpoint returned error response
- **Solution**: Check endpoint logs and configuration

## Best Practices

### Webhook Design
- **Descriptive Names** - Use clear, descriptive webhook names
- **Secure URLs** - Use HTTPS for webhook URLs
- **Proper Authentication** - Implement strong authentication
- **Event Filtering** - Use event filters to reduce noise
- **Error Handling** - Implement proper error handling

### Delivery Management
- **Retry Logic** - Implement appropriate retry logic
- **Timeout Configuration** - Set reasonable timeouts
- **Queue Management** - Manage delivery queues efficiently
- **Monitoring** - Monitor delivery performance
- **Analytics** - Analyze delivery patterns

### Security
- **Authentication** - Use strong authentication methods
- **Authorization** - Control webhook access strictly
- **Encryption** - Encrypt sensitive data
- **Audit Logging** - Log all webhook operations
- **Threat Detection** - Monitor for security threats

### Performance
- **Response Time** - Optimize endpoint response time
- **Success Rate** - Maintain high delivery success rate
- **Retry Strategy** - Implement efficient retry strategy
- **Queue Optimization** - Optimize delivery queues
- **Monitoring** - Monitor webhook performance

## Related Features

- **[WhatsApp](./whatsapp.md)** - WhatsApp integration for notifications
- **[Listeners](./listeners.md)** - Event listeners for webhook triggers
- **[API Keys](./api_keys.md)** - API key management for webhook authentication
- **[Monitor](./monitor.md)** - System monitoring for webhook performance
- **[SSE Debug](./sse_debug.md)** - Debug webhook delivery issues

## API Reference

### Webhook Management API
- **GET /api/admin/settings/webhooks** - List all webhooks
- **POST /api/admin/settings/webhooks** - Create new webhook
- **GET /api/admin/settings/webhooks/{id}** - Get webhook details
- **PUT /api/admin/settings/webhooks/{id}** - Update webhook
- **DELETE /api/admin/settings/webhooks/{id}** - Delete webhook

### Webhook Delivery API
- **POST /api/admin/settings/webhooks/{id}/test** - Test webhook
- **GET /api/admin/settings/webhooks/{id}/deliveries** - Get delivery history
- **GET /api/admin/settings/webhooks/{id}/stats** - Get webhook statistics
- **POST /api/admin/settings/webhooks/{id}/retry** - Retry failed delivery

### Webhook Events API
- **GET /api/admin/settings/webhooks/events** - List available events
- **POST /api/admin/settings/webhooks/{id}/events** - Subscribe to events
- **DELETE /api/admin/settings/webhooks/{id}/events/{eventId}** - Unsubscribe from event
- **GET /api/admin/settings/webhooks/{id}/events** - Get subscribed events

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Webhook Logs** - Review webhook delivery logs
- **Delivery Logs** - Check delivery-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of webhook management from creation to delivery monitoring and troubleshooting.
