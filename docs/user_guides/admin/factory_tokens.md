# Factory Tokens User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Factory Tokens are JWT tokens used by devices during initial registration. These tokens allow devices to authenticate with the system before they are claimed by users, enabling the device registration and claiming workflow.

## Prerequisites

- **Admin permissions** - Full factory token management access
- **JWT understanding** - Knowledge of JWT token structure
- **Device registration** - Understanding of device registration process
- **Security knowledge** - Understanding of token security best practices

## Getting Started

### Quick Start
1. **Navigate to Factory Tokens** - Go to Admin → IOT → Factory Tokens
2. **Create New Token** - Click "Create Factory Token" button
3. **Configure Token** - Set token name, expiration, and permissions
4. **Generate Token** - Create the JWT token
5. **Distribute to Devices** - Provide token to devices for registration
6. **Monitor Usage** - Track token usage and device registrations

### Navigation
- **Menu Path**: Admin → IOT → Factory Tokens
- **URL**: `/admin/iot/factory_tokens`
- **Direct Access**: Click "Factory Tokens" in the IOT section

## Core Functionality

### Factory Token List View

#### Token Information Display
- **Token Name** - Human-readable token name
- **Token ID** - Unique system identifier
- **Status** - Active/Inactive/Expired
- **Created Date** - When token was created
- **Expiration Date** - When token expires
- **Usage Count** - Number of devices registered with this token
- **Last Used** - Last time token was used
- **Created By** - Admin who created the token

#### Token Status Indicators
- 🟢 **Active** - Token is active and can be used
- 🔴 **Inactive** - Token is disabled
- 🟡 **Expired** - Token has expired
- ⚪ **Revoked** - Token has been revoked

#### Filtering and Search
- **Search by Name** - Find tokens by name
- **Filter by Status** - Show only active/inactive/expired tokens
- **Filter by Date** - Show tokens by creation or expiration date
- **Filter by Usage** - Show tokens by usage count
- **Sort Options** - Sort by name, status, date, usage, etc.

### Factory Token Detail View

#### Token Information Tab
- **Basic Info** - Name, ID, description, status
- **Creation Info** - Created by, created date, last modified
- **Expiration Info** - Expiration date, time remaining
- **Usage Info** - Usage count, last used, usage statistics

#### Token Configuration Tab
- **Token Settings** - Token-specific settings
- **Permissions** - Token permissions and scope
- **Expiration** - Token expiration configuration
- **Security** - Token security settings
- **Metadata** - Additional token metadata

#### Usage History Tab
- **Device Registrations** - Devices registered with this token
- **Registration History** - Historical registration data
- **Usage Analytics** - Token usage analytics
- **Usage Reports** - Token usage reports

## Advanced Features

### Factory Token Creation

#### Basic Token Setup
- **Token Name** - Choose descriptive name
- **Description** - Add detailed description
- **Expiration** - Set token expiration date
- **Permissions** - Set token permissions
- **Scope** - Define token scope

#### Token Configuration
- **JWT Settings** - JWT-specific settings
- **Signing Key** - Token signing key
- **Algorithm** - JWT signing algorithm
- **Claims** - JWT claims configuration
- **Validation** - Token validation settings

#### Security Settings
- **Access Control** - Token access control
- **Rate Limiting** - Token rate limiting
- **IP Restrictions** - IP address restrictions
- **Device Restrictions** - Device type restrictions
- **Audit Logging** - Token usage logging

### Factory Token Management

#### Token Lifecycle
- **Token Creation** - Create new factory tokens
- **Token Activation** - Activate tokens for use
- **Token Renewal** - Renew expiring tokens
- **Token Revocation** - Revoke tokens
- **Token Cleanup** - Clean up expired tokens

#### Token Monitoring
- **Usage Tracking** - Track token usage
- **Performance Monitoring** - Monitor token performance
- **Security Monitoring** - Monitor token security
- **Error Tracking** - Track token errors
- **Analytics** - Token usage analytics

#### Token Security
- **Access Control** - Control token access
- **Audit Logging** - Log token operations
- **Security Validation** - Validate token security
- **Threat Detection** - Detect security threats
- **Incident Response** - Respond to security incidents

## Factory Token Registration Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Token Validation Timeout: 5 Seconds**
- **Per Request**: Each token validation has a **5-second timeout**
- **Timeout Behavior**: If validation takes too long → **FAILED**
- **Retry Logic**: Failed validations are retried up to 3 times
- **Total Registration Timeout**: 30 seconds for complete registration

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Token Valid**: Token is valid and not expired
- **Device Registered**: Device successfully registers with token
- **Registration Complete**: Device registration completes successfully

##### ❌ **Failure Cases**
- **Token Invalid**: Token is invalid or malformed
- **Token Expired**: Token has expired
- **Token Revoked**: Token has been revoked
- **Validation Timeout**: Token validation times out

### 📊 **Factory Token Registration Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Device Sends  │    │   Token Validation│    │  Token Validated│
│  Registration   │───▶│   Request        │───▶│   Successfully  │
│   with Token    │    │   (5sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Device Status  │◀───│  Create Device   │◀───│  Generate Device│
│  REGISTERED     │    │  Record          │    │  ID & API Key   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Registration   │◀───│  Send Response   │◀───│  Device Ready   │
│   Complete      │    │  to Device       │    │  for Claiming   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Registration Process**

#### **Step 1: Token Validation**
```
Device Registration Request:
├── Extract Token from Request
├── Start 5-second Timer
├── Validate Token Signature
├── Check Token Expiration
└── Verify Token Permissions
```

#### **Step 2: Device Creation**
```
Token Validation Success:
├── Generate Device ID
├── Create Device Record
├── Generate API Key
├── Set Device Status: REGISTERED
└── Log Registration Event
```

#### **Step 3: Registration Response**
```
Registration Complete:
├── Send Device ID to Device
├── Send API Key to Device
├── Update Token Usage Count
└── Registration Status: SUCCESS
```

## Common Workflows

### Workflow 1: Create and Use Factory Token
1. **Create Token** - Set up new factory token with name and expiration
2. **Configure Permissions** - Set token permissions and scope
3. **Generate Token** - Create the JWT token
4. **Distribute Token** - Provide token to devices
5. **Monitor Registration** - Track device registrations
6. **Verify Usage** - Confirm token is being used correctly
7. **Manage Token** - Renew, revoke, or update token as needed

### Workflow 2: Token Lifecycle Management
1. **Create Token** - Create new factory token
2. **Activate Token** - Activate token for use
3. **Monitor Usage** - Track token usage and performance
4. **Renew Token** - Renew token before expiration
5. **Revoke Token** - Revoke token when no longer needed
6. **Clean Up** - Remove expired or unused tokens
7. **Audit Trail** - Maintain audit trail of token operations

### Workflow 3: Device Registration with Token
1. **Device Request** - Device sends registration request with token
2. **Token Validation** - Validate token (5-second timeout)
3. **Device Creation** - Create device record if token is valid
4. **API Key Generation** - Generate API key for device
5. **Response** - Send device ID and API key to device
6. **Status Update** - Update device status to REGISTERED
7. **Logging** - Log registration event and token usage

### Workflow 4: Token Troubleshooting
1. **Identify Issue** - Determine token problem
2. **Check Token Status** - Verify token is active and not expired
3. **Check Token Format** - Verify token format and structure
4. **Check Permissions** - Verify token permissions
5. **Check Logs** - Review token validation logs
6. **Test Token** - Test token manually
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: Factory Token Registration**

### **Example Token: "Office Devices Token"**
- **Token ID**: `factory_token_office_001`
- **Expiration**: 30 days from creation
- **Target Devices**: Office IoT devices

### **Timeline & Expected Behavior**

#### **T+0:00 - Device Registration Request**
```
Device Action: Register with Factory Token
├── Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
├── Device Info: {"model": "OfficeTerminal", "version": "1.0"}
└── Start 5-second validation timer
```

#### **T+0:01 - Token Validation**
```
Server Action: Validate Factory Token
├── Check Token Signature: VALID
├── Check Token Expiration: NOT EXPIRED
├── Check Token Permissions: VALID
└── Token Status: VALID
```

#### **T+0:02 - Device Creation**
```
Server Action: Create Device Record
├── Generate Device ID: "device_office_001"
├── Generate API Key: "api_key_abc123..."
├── Set Device Status: REGISTERED
└── Log Registration Event
```

#### **T+0:03 - Registration Response**
```
Server Response: {"status": "success", "deviceId": "device_office_001", "apiKey": "api_key_abc123..."}
├── Device Status: REGISTERED
├── Token Usage Count: +1
└── Registration Complete
```

### **Total Registration Time: 3 seconds**
- **Token Validation**: 1 second
- **Device Creation**: 1 second
- **Response**: 1 second
- **Within 5-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - Device Registration Request**
```
Device Action: Register with Factory Token
├── Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
├── Device Info: {"model": "OfficeTerminal", "version": "1.0"}
└── Start 5-second validation timer
```

#### **T+0:06 - Token Validation Timeout**
```
Server Action: Token Validation Timeout
├── Check Token Signature: TIMEOUT
├── Token Status: INVALID
└── Registration Failed
```

#### **T+0:07 - Registration Response**
```
Server Response: {"status": "error", "error": "Token validation timeout"}
├── Device Status: NOT REGISTERED
├── Token Usage Count: No change
└── Registration Failed
```

## Troubleshooting

### Common Issues

#### Token Creation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Configuration** - Verify token configuration is valid
- **Check Dependencies** - Ensure all dependencies are met
- **Check Resources** - Verify required resources are available
- **Check Validation** - Run token validation

#### Token Validation Failures
- **Check Token Format** - Verify token format is correct
- **Check Token Expiration** - Ensure token is not expired
- **Check Token Signature** - Verify token signature is valid
- **Check Token Permissions** - Verify token permissions
- **Check Logs** - Review validation logs

#### Registration Failures
- **Check Device Status** - Ensure device is online
- **Check Token Status** - Verify token is active
- **Check Network** - Verify network connectivity
- **Check Server Status** - Verify server is running
- **Check Logs** - Review registration logs

#### Performance Issues
- **Check Token Complexity** - Simplify complex tokens
- **Check Validation Time** - Monitor validation time
- **Check Server Load** - Monitor server performance
- **Check Network Latency** - Monitor network performance
- **Check Logs** - Review performance logs

### Error Messages

#### "Token Not Found"
- **Cause**: Token ID doesn't exist in system
- **Solution**: Verify token ID and check token list

#### "Token Expired"
- **Cause**: Token has expired
- **Solution**: Create new token or renew existing token

#### "Token Invalid"
- **Cause**: Token is invalid or malformed
- **Solution**: Check token format and regenerate if needed

#### "Token Validation Timeout"
- **Cause**: Token validation took too long
- **Solution**: Check server performance and network connectivity

#### "Registration Failed"
- **Cause**: Device registration failed
- **Solution**: Check device status and registration logs

## Best Practices

### Token Design
- **Descriptive Names** - Use clear, descriptive token names
- **Appropriate Expiration** - Set reasonable expiration dates
- **Minimal Permissions** - Use least privilege principle
- **Secure Storage** - Store tokens securely
- **Regular Rotation** - Rotate tokens regularly

### Token Management
- **Lifecycle Management** - Manage token lifecycle properly
- **Usage Monitoring** - Monitor token usage closely
- **Security Auditing** - Audit token security regularly
- **Access Control** - Control token access strictly
- **Incident Response** - Have incident response procedures

### Security
- **Strong Signing** - Use strong signing algorithms
- **Secure Transmission** - Transmit tokens securely
- **Access Logging** - Log all token access
- **Threat Detection** - Detect security threats
- **Regular Updates** - Keep token system updated

### Performance
- **Efficient Validation** - Optimize token validation
- **Caching** - Use caching for frequently used tokens
- **Load Balancing** - Balance token validation load
- **Monitoring** - Monitor token performance
- **Optimization** - Optimize token operations

## Related Features

- **[Device Management](./devices.md)** - Manage devices registered with tokens
- **[Device Profiles](./device_profiles.md)** - Apply profiles to registered devices
- **[PIN Rules](./pin_rules.md)** - Configure PIN rules for device claiming
- **[Preclaims](./preclaims.md)** - Pre-configure device claims
- **[JWT Signing Keys](./signing_keys.md)** - Manage JWT signing keys

## API Reference

### Factory Token Management API
- **GET /api/admin/iot/factory_tokens** - List all factory tokens
- **POST /api/admin/iot/factory_tokens** - Create new factory token
- **GET /api/admin/iot/factory_tokens/{id}** - Get factory token details
- **PUT /api/admin/iot/factory_tokens/{id}** - Update factory token
- **DELETE /api/admin/iot/factory_tokens/{id}** - Delete factory token

### Factory Token Validation API
- **POST /api/admin/iot/factory_tokens/{id}/validate** - Validate factory token
- **GET /api/admin/iot/factory_tokens/{id}/usage** - Get token usage statistics
- **GET /api/admin/iot/factory_tokens/{id}/devices** - Get devices registered with token
- **POST /api/admin/iot/factory_tokens/{id}/revoke** - Revoke factory token

### Device Registration API
- **POST /api/device/register** - Register device with factory token
- **GET /api/device/register/status** - Get registration status
- **POST /api/device/register/validate** - Validate registration request

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Token Logs** - Review token validation logs
- **Device Logs** - Check device-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of factory token management from creation to device registration and troubleshooting.
