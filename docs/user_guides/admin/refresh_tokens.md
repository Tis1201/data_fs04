# Refresh Tokens User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Refresh Tokens are long-lived tokens used to obtain new access tokens without requiring user re-authentication. They provide a secure way to maintain user sessions and enable seamless API access while maintaining security through token rotation and expiration.

## Prerequisites

- **Admin permissions** - Full refresh token management access
- **JWT understanding** - Knowledge of JWT token structure
- **Authentication knowledge** - Understanding of OAuth2 and token-based authentication
- **Security awareness** - Understanding of token security and rotation

## Getting Started

### Quick Start
1. **Navigate to Refresh Tokens** - Go to Admin → Security → Refresh Tokens
2. **View Token List** - Review existing refresh tokens
3. **Monitor Token Usage** - Monitor token usage and expiration
4. **Manage Token Lifecycle** - Manage token creation, rotation, and revocation
5. **Configure Token Settings** - Set token expiration and security settings
6. **Monitor Token Security** - Monitor token security and usage patterns

### Navigation
- **Menu Path**: Admin → Security → Refresh Tokens
- **URL**: `/admin/settings/refresh_tokens`
- **Direct Access**: Click "Refresh Tokens" in the Security section

## Core Functionality

### Refresh Token List View

#### Token Information Display
- **Token ID** - Unique system identifier
- **User** - Associated user account
- **Status** - Active/Inactive/Expired/Revoked
- **Created Date** - When token was created
- **Expiration Date** - When token expires
- **Last Used** - Last time token was used
- **Usage Count** - Number of times token has been used
- **IP Address** - IP address of last usage
- **User Agent** - User agent of last usage

#### Token Status Indicators
- 🟢 **Active** - Token is active and can be used
- 🔴 **Inactive** - Token is disabled
- 🟡 **Expired** - Token has expired
- ⚪ **Revoked** - Token has been revoked

#### Filtering and Search
- **Search by User** - Find tokens by user
- **Filter by Status** - Show only active/inactive tokens
- **Filter by Date** - Show tokens by creation date
- **Filter by Usage** - Show tokens by usage count
- **Filter by IP** - Show tokens by IP address
- **Sort Options** - Sort by user, status, date, usage, etc.

### Refresh Token Detail View

#### Token Information Tab
- **Basic Info** - Token ID, user, status
- **Creation Info** - Created by, created date, last modified
- **Expiration Info** - Expiration date, time remaining
- **Usage Info** - Usage count, last used, usage statistics

#### Token Configuration Tab
- **Token Settings** - Token-specific settings
- **Expiration Settings** - Token expiration configuration
- **Security Settings** - Token security settings
- **Access Control** - Token access permissions
- **Metadata** - Additional token metadata

#### Usage History Tab
- **Usage Events** - Historical usage events
- **Usage Statistics** - Usage analytics and trends
- **Usage Reports** - Token usage reports
- **Security Events** - Security-related events

## Advanced Features

### Refresh Token Management

#### Token Lifecycle
- **Token Creation** - Create new refresh tokens
- **Token Validation** - Validate token authenticity
- **Token Rotation** - Rotate tokens for security
- **Token Revocation** - Revoke tokens
- **Token Cleanup** - Clean up expired tokens

#### Token Security
- **Token Protection** - Protect tokens from unauthorized access
- **Token Encryption** - Encrypt tokens at rest
- **Token Validation** - Validate token integrity
- **Token Monitoring** - Monitor token usage
- **Token Threat Detection** - Detect security threats

#### Token Performance
- **Token Caching** - Cache frequently used tokens
- **Token Optimization** - Optimize token operations
- **Token Load Balancing** - Balance token load
- **Token Monitoring** - Monitor token performance
- **Token Analytics** - Analyze token usage patterns

### Token Configuration

#### Expiration Settings
- **Token Expiration** - Set token expiration time
- **Token Rotation** - Configure token rotation
- **Token Renewal** - Configure token renewal
- **Token Cleanup** - Configure token cleanup
- **Token Validation** - Configure token validation

#### Security Settings
- **Token Encryption** - Configure token encryption
- **Token Validation** - Configure token validation
- **Token Monitoring** - Configure token monitoring
- **Token Access Control** - Configure access control
- **Token Audit Logging** - Configure audit logging

## Refresh Token Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Token Validation Timeout: 3 Seconds**
- **Per Request**: Each token validation has a **3-second timeout**
- **Timeout Behavior**: If validation takes too long → **FAILED**
- **Retry Logic**: Failed validations are retried up to 2 times
- **Total Token Timeout**: 9 seconds for complete token validation

#### **Token Refresh Timeout: 5 Seconds**
- **Per Request**: Each token refresh has a **5-second timeout**
- **Timeout Behavior**: If refresh takes too long → **FAILED**
- **Retry Logic**: Failed refreshes are retried up to 2 times
- **Total Refresh Timeout**: 15 seconds for complete token refresh

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Token Valid**: Refresh token is valid and not expired
- **User Active**: Associated user account is active
- **Token Not Revoked**: Token has not been revoked
- **New Access Token**: New access token generated successfully

##### ❌ **Failure Cases**
- **Token Invalid**: Refresh token is invalid or malformed
- **Token Expired**: Refresh token has expired
- **Token Revoked**: Refresh token has been revoked
- **User Inactive**: Associated user account is inactive
- **Validation Timeout**: Token validation took too long

### 📊 **Refresh Token Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Sends  │    │   Token          │    │  Token Validated│
│   Refresh Token │───▶│   Validation     │───▶│   Successfully  │
│                 │    │  (3sec timeout)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  New Access     │◀───│  Generate New    │◀───│  Check User     │
│   Token         │    │  Access Token    │    │  Status         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Token Refresh  │◀───│  Update Token    │◀───│  Rotate Refresh │
│   Complete      │    │  Usage Stats     │    │  Token (Optional)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Token Refresh Process**

#### **Step 1: Token Validation**
```
Refresh Token Request:
├── Extract Refresh Token from Request
├── Start 3-second Timer
├── Validate Token Format
├── Check Token Expiration
└── Verify Token Status
```

#### **Step 2: User Validation**
```
Token Validation Success:
├── Check User Status
├── Verify User Permissions
├── Check User Account
└── Validate User Access
```

#### **Step 3: Token Generation**
```
User Validation Success:
├── Start 5-second Timer
├── Generate New Access Token
├── Update Token Usage
└── Return New Tokens
```

## Common Workflows

### Workflow 1: Monitor Refresh Token Usage
1. **View Token List** - Review all refresh tokens
2. **Filter by Status** - Filter tokens by status
3. **Check Expiration** - Check token expiration dates
4. **Monitor Usage** - Monitor token usage patterns
5. **Review Security** - Review token security events
6. **Analyze Patterns** - Analyze usage patterns
7. **Take Action** - Take appropriate actions

### Workflow 2: Token Lifecycle Management
1. **Select Token** - Choose token to manage
2. **View Token Details** - Review token information
3. **Check Usage History** - Review usage history
4. **Monitor Expiration** - Monitor token expiration
5. **Rotate Token** - Rotate token if needed
6. **Revoke Token** - Revoke token if necessary
7. **Update Configuration** - Update token configuration

### Workflow 3: Token Security Management
1. **Select Token** - Choose token to secure
2. **Review Security Events** - Review security events
3. **Check Usage Patterns** - Check usage patterns
4. **Monitor Anomalies** - Monitor for anomalies
5. **Update Security Settings** - Update security settings
6. **Revoke Suspicious Tokens** - Revoke suspicious tokens
7. **Report Security Issues** - Report security issues

### Workflow 4: Token Troubleshooting
1. **Identify Issue** - Determine token problem
2. **Check Token Status** - Verify token status
3. **Check User Status** - Verify user status
4. **Check Expiration** - Verify token expiration
5. **Check Usage** - Verify token usage
6. **Check Logs** - Review token logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: User Session Refresh**

### **Example Token: "User Session Refresh Token"**
- **User**: "john.doe@company.com"
- **Token ID**: "rt_1234567890abcdef"
- **Expiration**: 30 days from creation
- **Usage**: Refresh access tokens for API access

### **Timeline & Expected Behavior**

#### **T+0:00 - Refresh Token Request**
```
Client Request: POST /api/auth/refresh
├── Refresh Token: "rt_1234567890abcdef"
├── Headers: {"Authorization": "Bearer rt_1234567890abcdef"}
├── Start 3-second Timer
└── Begin Token Validation
```

#### **T+0:01 - Token Validation**
```
Token Validation:
├── Token Format: VALID
├── Token Expiration: NOT EXPIRED
├── Token Status: ACTIVE
├── Token Revoked: NO
└── Token Status: VALID
```

#### **T+0:02 - User Validation**
```
User Validation:
├── User Status: ACTIVE
├── User Permissions: VALID
├── User Account: ACTIVE
└── User Status: VALID
```

#### **T+0:03 - Access Token Generation**
```
Access Token Generation:
├── Start 5-second Timer
├── Generate New Access Token
├── Token Expiration: 1 hour
├── Token Permissions: User permissions
└── Access Token: Generated
```

#### **T+0:04 - Token Response**
```
Token Response:
├── Status Code: 200
├── New Access Token: "at_new_1234567890abcdef"
├── Token Expiration: 1 hour
├── Refresh Token: Rotated (optional)
└── Response: SUCCESS
```

### **Total Refresh Time: 4 seconds**
- **Token Validation**: 1 second
- **User Validation**: 1 second
- **Access Token Generation**: 1 second
- **Response**: 1 second
- **Within 3-second validation timeout**

### **Failure Scenario Example**

#### **T+0:00 - Refresh Token Request**
```
Client Request: POST /api/auth/refresh
├── Refresh Token: "rt_expired_token"
├── Headers: {"Authorization": "Bearer rt_expired_token"}
├── Start 3-second Timer
└── Begin Token Validation
```

#### **T+0:01 - Token Validation**
```
Token Validation:
├── Token Format: VALID
├── Token Expiration: EXPIRED
├── Token Status: EXPIRED
├── Token Revoked: NO
└── Token Status: INVALID
```

#### **T+0:02 - Token Response**
```
Token Response:
├── Status Code: 401
├── Error: "Refresh token expired"
├── Response: FAILED
└── Client must re-authenticate
```

## Troubleshooting

### Common Issues

#### Token Validation Failures
- **Check Token Format** - Verify token format is correct
- **Check Token Expiration** - Ensure token is not expired
- **Check Token Status** - Verify token is active
- **Check Token Revocation** - Verify token is not revoked
- **Check Logs** - Review validation logs

#### Token Refresh Failures
- **Check User Status** - Verify user account is active
- **Check User Permissions** - Verify user permissions
- **Check Token Validity** - Verify refresh token validity
- **Check System Status** - Verify system is operational
- **Check Logs** - Review refresh logs

#### Performance Issues
- **Check Token Complexity** - Monitor token validation complexity
- **Check User Lookup** - Monitor user lookup performance
- **Check Token Generation** - Monitor token generation performance
- **Check System Load** - Monitor system performance
- **Check Logs** - Review performance logs

#### Security Issues
- **Check Token Security** - Monitor token security
- **Check Usage Patterns** - Monitor usage patterns
- **Check Anomalies** - Monitor for anomalies
- **Check Access Control** - Verify access control
- **Check Logs** - Review security logs

### Error Messages

#### "Refresh Token Not Found"
- **Cause**: Refresh token doesn't exist in system
- **Solution**: Verify token value and check token list

#### "Refresh Token Expired"
- **Cause**: Refresh token has expired
- **Solution**: User must re-authenticate

#### "Refresh Token Revoked"
- **Cause**: Refresh token has been revoked
- **Solution**: User must re-authenticate

#### "User Account Inactive"
- **Cause**: Associated user account is inactive
- **Solution**: Activate user account or contact admin

#### "Token Validation Timeout"
- **Cause**: Token validation took too long
- **Solution**: Check system performance and retry

## Best Practices

### Token Design
- **Secure Generation** - Use secure token generation
- **Appropriate Expiration** - Set appropriate expiration times
- **Token Rotation** - Implement token rotation
- **Clear Documentation** - Document token purpose and usage
- **Regular Review** - Review tokens regularly

### Token Management
- **Lifecycle Management** - Manage token lifecycle properly
- **Usage Monitoring** - Monitor token usage closely
- **Security Auditing** - Audit token security regularly
- **Access Control** - Control token access strictly
- **Incident Response** - Have incident response procedures

### Security
- **Token Protection** - Protect tokens from unauthorized access
- **Token Encryption** - Encrypt tokens at rest
- **Token Validation** - Validate token integrity
- **Token Monitoring** - Monitor token usage
- **Token Threat Detection** - Detect security threats

### Performance
- **Token Caching** - Cache frequently used tokens
- **Token Optimization** - Optimize token operations
- **Token Load Balancing** - Balance token load
- **Token Monitoring** - Monitor token performance
- **Token Analytics** - Analyze token usage patterns

## Related Features

- **[Signing Keys](./signing_keys.md)** - JWT signing key management
- **[API Keys](./api_keys.md)** - API key management
- **[Token Logs](./token_logs.md)** - Token operation logging
- **[Monitor](./monitor.md)** - System monitoring for token performance
- **[Messaging Debug](./messaging_debug.md)** - Debug token issues

## API Reference

### Refresh Token Management API
- **GET /api/admin/settings/refresh_tokens** - List all refresh tokens
- **GET /api/admin/settings/refresh_tokens/{id}** - Get refresh token details
- **PUT /api/admin/settings/refresh_tokens/{id}** - Update refresh token
- **DELETE /api/admin/settings/refresh_tokens/{id}** - Revoke refresh token

### Refresh Token Operations API
- **POST /api/admin/settings/refresh_tokens/{id}/test** - Test refresh token
- **GET /api/admin/settings/refresh_tokens/{id}/usage** - Get token usage statistics
- **GET /api/admin/settings/refresh_tokens/{id}/history** - Get token usage history
- **POST /api/admin/settings/refresh_tokens/{id}/revoke** - Revoke refresh token

### Refresh Token Security API
- **GET /api/admin/settings/refresh_tokens/{id}/security** - Get token security info
- **POST /api/admin/settings/refresh_tokens/{id}/rotate** - Rotate refresh token
- **GET /api/admin/settings/refresh_tokens/{id}/events** - Get security events
- **POST /api/admin/settings/refresh_tokens/{id}/monitor** - Enable security monitoring

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Token Logs** - Review token operation logs
- **Security Logs** - Check security-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of refresh token management from monitoring to security and troubleshooting.
