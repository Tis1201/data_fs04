# Refresh Tokens User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Refresh Tokens are long-lived tokens used to obtain new access tokens without requiring user re-authentication. They provide a secure way to maintain user sessions and enable seamless API access while maintaining security through token rotation and expiration.

## Prerequisites

- **Admin permissions** - Full refresh token management access
- **JWT understanding** - Knowledge of JWT token structure

## Getting Started

### Quick Start
1. **Navigate to Refresh Tokens** - Go to Admin → JWT → Refresh Tokens
2. **View Token List** - Review existing refresh tokens
3. **Monitor Token Usage** - Monitor token usage and expiration
4. **Manage Token Lifecycle** - Manage token revocation and cleanup
5. **Filter and Search** - Use filters to find specific tokens
6. **Bulk Operations** - Revoke tokens for users or accounts

### Navigation
- **Menu Path**: Admin → JWT → Refresh Tokens
- **URL**: `/admin/jwt/refresh_tokens`
- **Direct Access**: Click "Refresh Tokens" in the JWT section

## Core Functionality

### Refresh Token List View

#### Token Information Display
- **Token ID** - Unique system identifier with badge display
- **User** - Associated user name and email
- **Account** - Associated account name
- **Device Info** - Device ID and IP address
- **Status** - Active/Revoked status with visual indicators
- **Expires** - Token expiration date (relative format)
- **Created** - Token creation date (relative format)

#### Token Status Indicators
- 🟢 **Active** - Token is active and can be used
- 🔴 **Revoked** - Token has been revoked

#### Filtering and Search
- **Search by ID/Device/IP** - Find tokens by ID, device ID, or IP address
- **Filter by Account** - Show tokens by account
- **Filter by User** - Show tokens by user
- **Filter by Status** - Show tokens by status (Active, Revoked)
- **Sort Options** - Sort by ID, expiration date, creation date
- **Pagination** - Navigate through multiple pages of tokens

### Refresh Token Actions

#### Individual Token Actions
- **Revoke Token** - Revoke individual token (if not already revoked)
- **Delete Token** - Remove token from system
- **View Details** - View token information and metadata

#### Bulk Token Actions
- **Revoke All for User** - Revoke all tokens for a specific user
- **Revoke All for Account** - Revoke all tokens for a specific account
- **Bulk Delete** - Delete multiple tokens at once

#### Token Management
- **Status Monitoring** - Monitor token status and expiration
- **Security Management** - Manage token security and access
- **Cleanup Operations** - Clean up expired or revoked tokens

## Advanced Features

### Refresh Token Management

#### Token Lifecycle
- **Token Monitoring** - Monitor token status and expiration
- **Token Revocation** - Revoke individual or bulk tokens
- **Token Cleanup** - Clean up expired or revoked tokens
- **Token Security** - Manage token security and access

#### Bulk Operations
- **User Token Management** - Revoke all tokens for a user
- **Account Token Management** - Revoke all tokens for an account
- **Bulk Revocation** - Revoke multiple tokens at once
- **Bulk Deletion** - Delete multiple tokens at once

#### Token Security
- **Status Monitoring** - Monitor token status and expiration
- **Access Control** - Control token access and permissions
- **Security Auditing** - Audit token security and usage
- **Threat Detection** - Detect security threats and anomalies

## Common Workflows

### Workflow 1: Monitor Refresh Tokens
1. **Navigate to Refresh Tokens** - Go to Admin → JWT → Refresh Tokens
2. **View Token List** - Review all refresh tokens
3. **Filter by Status** - Filter tokens by status (Active, Revoked)
4. **Check Expiration** - Check token expiration dates
5. **Monitor Usage** - Monitor token usage patterns
6. **Review Security** - Review token security events

### Workflow 2: Revoke Individual Token
1. **Find Token** - Use search or filters to locate token
2. **Click Revoke** - Click revoke action for the token
3. **Confirm Revocation** - Confirm revocation in dialog
4. **Verify Status** - Confirm token status is updated to revoked
5. **Check Impact** - Verify user will need to re-authenticate

### Workflow 3: Revoke All Tokens for User
1. **Select Token** - Choose any token for the user
2. **Click "Revoke All for User"** - Click bulk user action
3. **Confirm Action** - Confirm revocation in dialog
4. **Verify Revocation** - Confirm all user tokens are revoked
5. **Notify User** - User will need to re-authenticate on all devices

### Workflow 4: Revoke All Tokens for Account
1. **Select Token** - Choose any token for the account
2. **Click "Revoke All for Account"** - Click bulk account action
3. **Confirm Action** - Confirm revocation in dialog
4. **Verify Revocation** - Confirm all account tokens are revoked
5. **Notify Users** - All users in account will need to re-authenticate

### Workflow 5: Delete Token
1. **Select Token** - Choose token to delete
2. **Click Delete** - Click delete action
3. **Confirm Deletion** - Confirm deletion in dialog
4. **Verify Removal** - Confirm token is removed from system


## Troubleshooting

### Common Issues

#### Token Management Issues
- **Cannot Revoke Token** - Check admin permissions and token status
- **Bulk Operations Failed** - Check user/account permissions and token status
- **Delete Failed** - Check token dependencies and permissions
- **Token Not Found** - Verify token exists and is accessible

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction
- **Filter Issues** - Check filter selections and clear filters

#### Token Display Issues
- **Token Status Not Updating** - Check token status and refresh page
- **Expiration Dates** - Verify date formatting and timezone
- **User Information** - Check user account status and permissions

#### Bulk Operations Issues
- **Revoke All for User Failed** - Check user permissions and token status
- **Revoke All for Account Failed** - Check account permissions and token status
- **Bulk Delete Failed** - Check token dependencies and permissions

### Error Messages

#### "Token Not Found"
- **Cause**: Token ID doesn't exist in system
- **Solution**: Verify token ID and check token list

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Bulk Operation Failed"
- **Cause**: Bulk operation failed for some tokens
- **Solution**: Check individual token status and permissions

#### "User Not Found"
- **Cause**: User account doesn't exist or is inactive
- **Solution**: Check user account status and permissions

#### "Account Not Found"
- **Cause**: Account doesn't exist or is inactive
- **Solution**: Check account status and permissions

## Best Practices

### Token Management
- **Regular Monitoring** - Monitor token status and expiration regularly
- **Bulk Operations** - Use bulk operations for efficient token management
- **Status Tracking** - Track token status and expiration dates
- **Security Auditing** - Audit token security and usage regularly
- **Cleanup Operations** - Clean up expired or revoked tokens

### Bulk Operations
- **User Token Management** - Use "Revoke All for User" for user security
- **Account Token Management** - Use "Revoke All for Account" for account security
- **Bulk Revocation** - Use bulk operations for efficient token management
- **Bulk Deletion** - Use bulk deletion for cleanup operations

### Security
- **Token Revocation** - Revoke tokens when users leave or security issues arise
- **Status Monitoring** - Monitor token status and expiration regularly
- **Access Control** - Control token access and permissions strictly
- **Security Auditing** - Audit token security and usage regularly
- **Threat Detection** - Detect security threats and anomalies

## Technical Details

### Refresh Token Data Structure
- **ID** - Unique system identifier
- **User** - Associated user name and email
- **Account** - Associated account name
- **Device Info** - Device ID and IP address
- **Status** - Token status (Active, Revoked)
- **Expires At** - Token expiration timestamp
- **Created At** - Token creation timestamp

### Search and Filtering
- **Search Fields** - Token ID, device ID, IP address, user agent
- **Sort Options** - ID, expiration date, creation date
- **Pagination** - Configurable page size and navigation
- **Filter Options** - Account, User, Status (Active, Revoked)

### Token Actions
- **Individual Actions** - Revoke token, delete token
- **Bulk Actions** - Revoke all for user, revoke all for account
- **Status Management** - Monitor token status and expiration
- **Security Management** - Manage token security and access

## Related Features

- **[Debug Tools](../debug/)** - System debugging and monitoring tools
- **[JWT Management](../jwt/)** - JWT token management
- **[User Management](./users.md)** - User account management
- **[Account Management](./accounts.md)** - Account management

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Debug Tools** - Use debug tools for system monitoring
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Token Issues** - Check token status and permissions
- **Bulk Operations** - Verify user/account permissions
- **Search Problems** - Try different search terms or clear filters
- **Permission Issues** - Check admin permissions
- **Status Issues** - Check token status and expiration

---

**Status**: ✅ Updated - This guide now accurately reflects the current refresh token management UI and functionality.
