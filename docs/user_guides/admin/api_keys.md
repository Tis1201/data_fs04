# API Keys User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

API Keys are authentication credentials used to access the IoT Management System's API endpoints. They provide secure, programmatic access to system functionality, enabling external applications and services to interact with the system programmatically.

## Prerequisites

- **Admin permissions** - Full API key management access
- **API understanding** - Knowledge of REST API concepts
- **Authentication knowledge** - Understanding of API authentication
- **Security awareness** - Understanding of API security best practices

## Getting Started

### Quick Start
1. **Navigate to API Keys** - Go to Admin → Security → API Keys
2. **Create New API Key** - Click "Create API Key" button
3. **Configure Key** - Set key name, permissions, and expiration
4. **Generate Key** - Generate the API key
5. **Set Key Status** - Set key status (active/inactive)
6. **Test Key** - Test API key functionality

### Navigation
- **Menu Path**: Admin → Security → API Keys
- **URL**: `/admin/settings/api_keys`
- **Direct Access**: Click "API Keys" in the Security section

## Core Functionality

### API Key List View

#### Key Information Display
- **Key Name** - Human-readable key name
- **Key ID** - Unique system identifier
- **Key Value** - API key value (masked for security)
- **Status** - Active/Inactive/Expired
- **Created Date** - When key was created
- **Expiration Date** - When key expires
- **Usage Count** - Number of API calls made with key
- **Last Used** - Last time key was used
- **Permissions** - Key permissions and scope

#### Key Status Indicators
- 🟢 **Active** - Key is active and can be used
- 🔴 **Inactive** - Key is disabled
- 🟡 **Expired** - Key has expired
- ⚪ **Revoked** - Key has been revoked

#### Filtering and Search
- **Search by Name** - Find keys by name
- **Filter by Status** - Show only active/inactive keys
- **Filter by Permissions** - Show keys by permissions
- **Filter by Date** - Show keys by creation date
- **Filter by Usage** - Show keys by usage count
- **Sort Options** - Sort by name, status, usage, date, etc.

### API Key Detail View

#### Key Information Tab
- **Basic Info** - Name, ID, key value, status
- **Creation Info** - Created by, created date, last modified
- **Expiration Info** - Expiration date, time remaining
- **Usage Info** - Usage count, last used, usage statistics

#### Key Configuration Tab
- **Key Settings** - Key-specific settings
- **Permission Settings** - Key permissions and scope
- **Rate Limiting** - API rate limiting settings
- **Access Control** - Key access control settings
- **Metadata** - Additional key metadata

#### Usage History Tab
- **API Calls** - Historical API call logs
- **Usage Statistics** - Usage analytics and trends
- **Performance Metrics** - API performance metrics
- **Error Logs** - API error logs

## Advanced Features

### API Key Creation

#### Basic Key Setup
- **Key Name** - Choose descriptive name
- **Description** - Add detailed description
- **Expiration** - Set key expiration date
- **Permissions** - Set key permissions
- **Status** - Set initial key status

#### Permission Configuration
- **API Endpoints** - Select allowed API endpoints
- **HTTP Methods** - Select allowed HTTP methods
- **Resource Access** - Set resource access permissions
- **Rate Limits** - Set API rate limits
- **IP Restrictions** - Set IP address restrictions

#### Security Configuration
- **Key Generation** - Generate secure API key
- **Key Storage** - Store key securely
- **Key Encryption** - Encrypt key at rest
- **Key Validation** - Validate key format
- **Key Rotation** - Configure key rotation

### API Key Management

#### Key Lifecycle
- **Key Creation** - Create new API keys
- **Key Activation** - Activate keys for use
- **Key Renewal** - Renew expiring keys
- **Key Revocation** - Revoke keys
- **Key Cleanup** - Clean up expired keys

#### Key Monitoring
- **Usage Tracking** - Track key usage
- **Performance Monitoring** - Monitor API performance
- **Security Monitoring** - Monitor key security
- **Error Tracking** - Track API errors
- **Analytics** - Analyze key usage patterns

#### Key Security
- **Access Control** - Control key access
- **Audit Logging** - Log key operations
- **Security Validation** - Validate key security
- **Threat Detection** - Detect security threats
- **Incident Response** - Respond to security incidents

## API Key Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **API Key Validation Timeout: 2 Seconds**
- **Per Request**: Each API key validation has a **2-second timeout**
- **Timeout Behavior**: If validation takes too long → **FAILED**
- **Retry Logic**: Failed validations are retried up to 2 times
- **Total API Timeout**: 10 seconds for complete API request

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Key Valid**: API key is valid and not expired
- **Permissions Valid**: Key has required permissions
- **Rate Limit OK**: Rate limit not exceeded
- **Request Authorized**: Request is authorized

##### ❌ **Failure Cases**
- **Key Invalid**: API key is invalid or malformed
- **Key Expired**: API key has expired
- **Key Revoked**: API key has been revoked
- **Permission Denied**: Key lacks required permissions
- **Rate Limit Exceeded**: API rate limit exceeded

### 📊 **API Key Validation Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Request   │    │   Key Validation │    │  Key Validated  │
│   with API Key  │───▶│   Process        │───▶│   Successfully  │
│                 │    │  (2sec timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Request        │◀───│  Check           │◀───│  Check          │
│   Authorized    │    │  Permissions     │    │  Rate Limits    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  API Response   │◀───│  Execute         │◀───│  Request        │
│   Returned      │    │  API Endpoint    │    │   Processed     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed API Key Validation Process**

#### **Step 1: Key Validation**
```
API Request Received:
├── Extract API Key from Request
├── Start 2-second Timer
├── Validate Key Format
├── Check Key Expiration
└── Verify Key Status
```

#### **Step 2: Permission Check**
```
Key Validation Success:
├── Check Key Permissions
├── Verify Endpoint Access
├── Check HTTP Method Access
└── Validate Resource Access
```

#### **Step 3: Rate Limit Check**
```
Permission Check Success:
├── Check Rate Limits
├── Verify Request Frequency
├── Update Usage Count
└── Process API Request
```

## Common Workflows

### Workflow 1: Create and Configure API Key
1. **Create Key** - Set up new API key with name and description
2. **Set Permissions** - Configure key permissions and scope
3. **Set Expiration** - Set key expiration date
4. **Configure Rate Limits** - Set API rate limits
5. **Generate Key** - Generate the API key
6. **Test Key** - Test API key functionality
7. **Activate Key** - Activate key for use

### Workflow 2: API Key Permission Management
1. **Select Key** - Choose key to manage
2. **View Permissions** - Review current permissions
3. **Update Permissions** - Add or remove permissions
4. **Set Rate Limits** - Configure rate limits
5. **Test Permissions** - Test permission changes
6. **Apply Changes** - Apply permission changes
7. **Monitor Usage** - Monitor key usage

### Workflow 3: API Key Usage and Monitoring
1. **Select Key** - Choose key to monitor
2. **View Usage** - Review key usage statistics
3. **Check Performance** - Monitor API performance
4. **Review Logs** - Review API call logs
5. **Analyze Patterns** - Analyze usage patterns
6. **Optimize Usage** - Optimize key usage
7. **Update Configuration** - Update key configuration

### Workflow 4: API Key Troubleshooting
1. **Identify Issue** - Determine API key problem
2. **Check Key Status** - Verify key status
3. **Check Permissions** - Verify key permissions
4. **Check Rate Limits** - Verify rate limits
5. **Check Expiration** - Verify key expiration
6. **Check Logs** - Review API logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Device Management API Key**

### **Example API Key: "Device Management API"**
- **Key Name**: "Device Management API"
- **Permissions**: Device read/write, bundle management
- **Rate Limit**: 1000 requests per hour
- **Expiration**: 1 year from creation

### **Timeline & Expected Behavior**

#### **T+0:00 - API Request Received**
```
API Request: GET /api/devices
├── API Key: "ak_1234567890abcdef"
├── Headers: {"Authorization": "Bearer ak_1234567890abcdef"}
├── Start 2-second Timer
└── Begin Key Validation
```

#### **T+0:01 - Key Validation**
```
Key Validation:
├── Key Format: VALID
├── Key Expiration: NOT EXPIRED
├── Key Status: ACTIVE
├── Key Permissions: VALID
└── Key Status: VALID
```

#### **T+0:02 - Permission Check**
```
Permission Check:
├── Endpoint Access: /api/devices ✓
├── HTTP Method: GET ✓
├── Resource Access: devices ✓
└── Permission Status: AUTHORIZED
```

#### **T+0:03 - Rate Limit Check**
```
Rate Limit Check:
├── Current Usage: 150/1000 requests
├── Rate Limit: 1000 requests/hour
├── Rate Status: OK
└── Usage Count: +1
```

#### **T+0:04 - API Execution**
```
API Execution:
├── Execute: GET /api/devices
├── Response: 200 OK
├── Data: Device list returned
└── API Status: SUCCESS
```

### **Total API Time: 4 seconds**
- **Key Validation**: 1 second
- **Permission Check**: 1 second
- **Rate Limit Check**: 1 second
- **API Execution**: 1 second
- **Within 2-second validation timeout**

### **Failure Scenario Example**

#### **T+0:00 - API Request Received**
```
API Request: POST /api/devices
├── API Key: "ak_invalid_key"
├── Headers: {"Authorization": "Bearer ak_invalid_key"}
├── Start 2-second Timer
└── Begin Key Validation
```

#### **T+0:01 - Key Validation**
```
Key Validation:
├── Key Format: VALID
├── Key Expiration: NOT EXPIRED
├── Key Status: INVALID
├── Key Permissions: N/A
└── Key Status: INVALID
```

#### **T+0:02 - API Response**
```
API Response:
├── Status Code: 401
├── Response: {"error": "Invalid API key"}
├── API Status: FAILED
└── Request Rejected
```

## Troubleshooting

### Common Issues

#### API Key Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify key configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run key validation

#### API Key Validation Failures
- **Check Key Format** - Verify key format is correct
- **Check Key Expiration** - Ensure key is not expired
- **Check Key Status** - Verify key is active
- **Check Key Permissions** - Verify key permissions
- **Check Logs** - Review validation logs

#### API Request Failures
- **Check Key Status** - Verify key is active
- **Check Permissions** - Verify key has required permissions
- **Check Rate Limits** - Verify rate limits not exceeded
- **Check Endpoint** - Verify endpoint is accessible
- **Check Logs** - Review API logs

#### Performance Issues
- **Check Key Complexity** - Monitor key validation complexity
- **Check Rate Limits** - Monitor rate limit usage
- **Check Server Load** - Monitor server performance
- **Check Network Latency** - Monitor network performance
- **Check Logs** - Review performance logs

### Error Messages

#### "API Key Not Found"
- **Cause**: API key doesn't exist in system
- **Solution**: Verify key value and check key list

#### "API Key Expired"
- **Cause**: API key has expired
- **Solution**: Create new key or renew existing key

#### "API Key Invalid"
- **Cause**: API key is invalid or malformed
- **Solution**: Check key format and regenerate if needed

#### "Permission Denied"
- **Cause**: Key lacks required permissions
- **Solution**: Update key permissions

#### "Rate Limit Exceeded"
- **Cause**: API rate limit exceeded
- **Solution**: Wait for rate limit reset or upgrade plan

## Best Practices

### Key Design
- **Descriptive Names** - Use clear, descriptive key names
- **Appropriate Permissions** - Use least privilege principle
- **Reasonable Expiration** - Set reasonable expiration dates
- **Secure Generation** - Use secure key generation
- **Clear Documentation** - Document key purpose and usage

### Key Management
- **Lifecycle Management** - Manage key lifecycle properly
- **Usage Monitoring** - Monitor key usage closely
- **Security Auditing** - Audit key security regularly
- **Access Control** - Control key access strictly
- **Incident Response** - Have incident response procedures

### Security
- **Secure Storage** - Store keys securely
- **Access Control** - Control key access strictly
- **Audit Logging** - Log all key operations
- **Threat Detection** - Detect security threats
- **Regular Updates** - Keep key system updated

### Performance
- **Efficient Validation** - Optimize key validation
- **Caching** - Use caching for frequently used keys
- **Load Balancing** - Balance key validation load
- **Monitoring** - Monitor key performance
- **Optimization** - Optimize key operations

## Related Features

- **[Signing Keys](./signing_keys.md)** - JWT signing key management
- **[Refresh Tokens](./refresh_tokens.md)** - Refresh token management
- **[Token Logs](./token_logs.md)** - Token operation logging
- **[Monitor](./monitor.md)** - System monitoring for API performance
- **[Messaging Debug](./messaging_debug.md)** - Debug API key issues

## API Reference

### API Key Management API
- **GET /api/admin/settings/api_keys** - List all API keys
- **POST /api/admin/settings/api_keys** - Create new API key
- **GET /api/admin/settings/api_keys/{id}** - Get API key details
- **PUT /api/admin/settings/api_keys/{id}** - Update API key
- **DELETE /api/admin/settings/api_keys/{id}** - Delete API key

### API Key Operations API
- **POST /api/admin/settings/api_keys/{id}/test** - Test API key
- **GET /api/admin/settings/api_keys/{id}/usage** - Get key usage statistics
- **GET /api/admin/settings/api_keys/{id}/logs** - Get key usage logs
- **POST /api/admin/settings/api_keys/{id}/revoke** - Revoke API key

### API Key Permissions API
- **GET /api/admin/settings/api_keys/{id}/permissions** - Get key permissions
- **PUT /api/admin/settings/api_keys/{id}/permissions** - Update key permissions
- **GET /api/admin/settings/api_keys/{id}/rate_limits** - Get key rate limits
- **PUT /api/admin/settings/api_keys/{id}/rate_limits** - Update key rate limits

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **API Key Logs** - Review API key operation logs
- **API Logs** - Check API-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of API key management from creation to usage monitoring and troubleshooting.
