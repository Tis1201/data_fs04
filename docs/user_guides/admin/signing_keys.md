# Signing Keys User Guide

**Last Updated**: 2025-10-12  
**Audience**: Admin  
**Complexity**: Advanced

## Overview

Signing Keys are cryptographic keys used to sign and verify JWT tokens, API requests, and other secure communications in the IoT Management System. They ensure data integrity, authentication, and non-repudiation for secure system operations.

## Prerequisites

- **Admin permissions** - Full signing key management access
- **Cryptography knowledge** - Understanding of cryptographic concepts
- **JWT understanding** - Knowledge of JWT token structure and signing
- **Security expertise** - Understanding of key management and security

## Getting Started

### Quick Start
1. **Navigate to Signing Keys** - Go to Admin → Security → Signing Keys
2. **Create New Key** - Click "Create Signing Key" button
3. **Configure Key** - Set key name, algorithm, and properties
4. **Generate Key Pair** - Generate public/private key pair
5. **Set Key Status** - Set key status (active/inactive)
6. **Test Key** - Test key signing and verification

### Navigation
- **Menu Path**: Admin → Security → Signing Keys
- **URL**: `/admin/settings/signing_keys`
- **Direct Access**: Click "Signing Keys" in the Security section

## Core Functionality

### Signing Key List View

#### Key Information Display
- **Key Name** - Human-readable key name
- **Key ID** - Unique system identifier
- **Algorithm** - Signing algorithm (RS256, ES256, HS256)
- **Key Type** - Key type (RSA, ECDSA, HMAC)
- **Status** - Active/Inactive/Expired
- **Created Date** - When key was created
- **Expiration Date** - When key expires
- **Usage Count** - Number of times key has been used
- **Last Used** - Last time key was used

#### Key Status Indicators
- 🟢 **Active** - Key is active and can be used
- 🔴 **Inactive** - Key is disabled
- 🟡 **Expired** - Key has expired
- ⚪ **Revoked** - Key has been revoked

#### Filtering and Search
- **Search by Name** - Find keys by name
- **Filter by Algorithm** - Show keys by algorithm
- **Filter by Status** - Show only active/inactive keys
- **Filter by Type** - Show keys by type
- **Filter by Date** - Show keys by creation date
- **Sort Options** - Sort by name, algorithm, status, date, usage, etc.

### Signing Key Detail View

#### Key Information Tab
- **Basic Info** - Name, ID, algorithm, type
- **Creation Info** - Created by, created date, last modified
- **Expiration Info** - Expiration date, time remaining
- **Usage Info** - Usage count, last used, usage statistics

#### Key Configuration Tab
- **Key Settings** - Key-specific settings
- **Algorithm Settings** - Algorithm configuration
- **Security Settings** - Key security settings
- **Access Control** - Key access permissions
- **Metadata** - Additional key metadata

#### Usage History Tab
- **Usage Events** - Historical usage events
- **Usage Statistics** - Usage analytics and trends
- **Usage Reports** - Key usage reports
- **Performance Metrics** - Key performance metrics

## Advanced Features

### Signing Key Creation

#### Basic Key Setup
- **Key Name** - Choose descriptive name
- **Description** - Add detailed description
- **Algorithm** - Select signing algorithm
- **Key Size** - Set key size (for RSA/ECDSA)
- **Expiration** - Set key expiration date

#### Key Generation
- **Key Pair Generation** - Generate public/private key pair
- **Key Format** - Set key format (PEM, DER, JWK)
- **Key Storage** - Configure key storage
- **Key Protection** - Set key protection
- **Key Validation** - Validate generated keys

#### Key Configuration
- **Algorithm Parameters** - Configure algorithm parameters
- **Key Usage** - Set key usage (sign, verify, encrypt)
- **Key Constraints** - Set key constraints
- **Key Metadata** - Add key metadata
- **Key Validation** - Configure key validation

### Signing Key Management

#### Key Lifecycle
- **Key Creation** - Create new signing keys
- **Key Activation** - Activate keys for use
- **Key Rotation** - Rotate keys for security
- **Key Revocation** - Revoke keys
- **Key Cleanup** - Clean up expired keys

#### Key Security
- **Key Protection** - Protect keys from unauthorized access
- **Key Encryption** - Encrypt keys at rest
- **Key Access Control** - Control key access
- **Key Audit Logging** - Log key operations
- **Key Threat Detection** - Detect security threats

#### Key Performance
- **Key Usage Tracking** - Track key usage
- **Key Performance Monitoring** - Monitor key performance
- **Key Optimization** - Optimize key operations
- **Key Load Balancing** - Balance key load
- **Key Analytics** - Analyze key usage patterns

## Signing Key Operations Logic & Timeouts

### ⏱️ **Critical Timeout Information**

#### **Key Generation Timeout: 10 Seconds**
- **Per Key**: Each key generation has a **10-second timeout**
- **Timeout Behavior**: If generation takes too long → **FAILED**
- **Retry Logic**: Failed generations are retried up to 2 times
- **Total Generation Timeout**: 30 seconds for complete key generation

#### **Key Signing Timeout: 5 Seconds**
- **Per Operation**: Each signing operation has a **5-second timeout**
- **Timeout Behavior**: If signing takes too long → **FAILED**
- **Retry Logic**: Failed signing is retried up to 2 times
- **Total Signing Timeout**: 15 seconds for complete signing

#### **Success/Failure Conditions**

##### ✅ **Success Cases**
- **Key Generated**: Key pair generated successfully
- **Key Valid**: Key is valid and not expired
- **Signing Success**: Signing operation completed successfully
- **Verification Success**: Verification operation completed successfully

##### ❌ **Failure Cases**
- **Generation Timeout**: Key generation took too long
- **Key Invalid**: Key is invalid or corrupted
- **Signing Timeout**: Signing operation took too long
- **Verification Failed**: Verification operation failed

### 📊 **Signing Key Operations Flow Diagram**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Key Generation│    │   Key Validation │    │  Key Ready      │
│   Request       │───▶│   & Storage      │───▶│  for Use        │
│                 │    │  (10sec timeout) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Signing        │◀───│  Sign Data       │◀───│  Signing        │
│   SUCCESS       │    │  with Key        │    │   Request       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Verification   │◀───│  Verify Signature│◀───│  Verification   │
│   SUCCESS       │    │  with Public Key │    │   Request       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 🔄 **Detailed Key Operations Process**

#### **Step 1: Key Generation**
```
Key Generation Request:
├── Start 10-second Timer
├── Generate Key Pair
├── Validate Key Pair
├── Store Key Securely
└── Set Key Status: ACTIVE
```

#### **Step 2: Signing Operation**
```
Signing Request:
├── Start 5-second Timer
├── Load Private Key
├── Sign Data
├── Return Signature
└── Update Usage Count
```

#### **Step 3: Verification Operation**
```
Verification Request:
├── Start 5-second Timer
├── Load Public Key
├── Verify Signature
├── Return Verification Result
└── Update Usage Count
```

## Common Workflows

### Workflow 1: Create and Configure Signing Key
1. **Create Key** - Set up new signing key with name and algorithm
2. **Generate Key Pair** - Generate public/private key pair
3. **Configure Settings** - Set key settings and parameters
4. **Set Expiration** - Set key expiration date
5. **Test Key** - Test key signing and verification
6. **Activate Key** - Activate key for use
7. **Monitor Usage** - Monitor key usage and performance

### Workflow 2: Key Rotation and Management
1. **Select Key** - Choose key to rotate
2. **Create New Key** - Create new key pair
3. **Update Applications** - Update applications to use new key
4. **Test New Key** - Test new key functionality
5. **Deactivate Old Key** - Deactivate old key
6. **Monitor Transition** - Monitor key transition
7. **Clean Up** - Remove old key after transition

### Workflow 3: Key Signing and Verification
1. **Select Key** - Choose key for signing
2. **Prepare Data** - Prepare data to be signed
3. **Sign Data** - Sign data with private key
4. **Store Signature** - Store signature securely
5. **Verify Signature** - Verify signature with public key
6. **Process Result** - Process verification result
7. **Log Operation** - Log signing/verification operation

### Workflow 4: Key Troubleshooting
1. **Identify Issue** - Determine key problem
2. **Check Key Status** - Verify key status
3. **Check Key Validity** - Verify key validity
4. **Check Key Expiration** - Verify key expiration
5. **Check Key Access** - Verify key access permissions
6. **Check Logs** - Review key operation logs
7. **Fix Issues** - Resolve identified problems

## 📋 **Real-World Example: JWT Token Signing**

### **Example Key: "JWT Signing Key 2024"**
- **Algorithm**: RS256 (RSA with SHA-256)
- **Key Size**: 2048 bits
- **Usage**: JWT token signing
- **Expiration**: 1 year from creation

### **Timeline & Expected Behavior**

#### **T+0:00 - Key Generation Start**
```
Admin Action: Create "JWT Signing Key 2024"
├── Algorithm: RS256
├── Key Size: 2048 bits
├── Start 10-second Timer
└── Begin Key Generation Process
```

#### **T+0:02 - Key Pair Generated**
```
Server Action: Generate Key Pair
├── Private Key: Generated (2048 bits)
├── Public Key: Generated (2048 bits)
├── Key ID: "key_jwt_2024_001"
└── Key Status: GENERATED
```

#### **T+0:03 - Key Validation**
```
Server Action: Validate Key Pair
├── Private Key Validation: VALID
├── Public Key Validation: VALID
├── Key Pair Validation: VALID
└── Key Status: VALIDATED
```

#### **T+0:04 - Key Storage**
```
Server Action: Store Key Securely
├── Private Key: Encrypted and stored
├── Public Key: Stored securely
├── Key Metadata: Stored
└── Key Status: STORED
```

#### **T+0:05 - Key Activation**
```
Server Action: Activate Key
├── Key Status: ACTIVE
├── Key Ready: True
├── Usage Count: 0
└── Key Generation: Complete
```

### **Total Generation Time: 5 seconds**
- **Key Generation**: 2 seconds
- **Key Validation**: 1 second
- **Key Storage**: 1 second
- **Key Activation**: 1 second
- **Within 10-second timeout**

### **JWT Signing Example**

#### **T+0:00 - JWT Signing Request**
```
JWT Signing Request:
├── Payload: {"sub": "user123", "iat": 1697123456, "exp": 1697209856}
├── Key ID: "key_jwt_2024_001"
├── Start 5-second Timer
└── Begin Signing Process
```

#### **T+0:01 - JWT Signing**
```
JWT Signing:
├── Header: {"alg": "RS256", "typ": "JWT", "kid": "key_jwt_2024_001"}
├── Payload: {"sub": "user123", "iat": 1697123456, "exp": 1697209856}
├── Signature: Generated with private key
└── JWT Token: Created
```

#### **T+0:02 - JWT Verification**
```
JWT Verification:
├── Token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
├── Public Key: Loaded
├── Signature: Verified
└── Verification: SUCCESS
```

### **Total Signing Time: 2 seconds**
- **JWT Creation**: 1 second
- **JWT Verification**: 1 second
- **Within 5-second timeout**

### **Failure Scenario Example**

#### **T+0:00 - Key Generation Start**
```
Admin Action: Create "Large RSA Key"
├── Algorithm: RS256
├── Key Size: 4096 bits
├── Start 10-second Timer
└── Begin Key Generation Process
```

#### **T+0:08 - Key Generation Progress**
```
Key Generation Progress:
├── Private Key: Generating (4096 bits)
├── Public Key: Generating (4096 bits)
├── Progress: 80%
└── Key Status: GENERATING
```

#### **T+0:11 - Key Generation Timeout**
```
Key Generation Timeout:
├── No completion after 10 seconds
├── Key Status: FAILED
├── Retry Attempt 1: Restart generation
└── Start new 10-second Timer
```

#### **T+0:21 - Retry Timeout**
```
Retry Timeout:
├── No completion after 10 seconds (retry 1)
├── Key Status: FAILED
├── Key Generation: Failed
└── Manual intervention required
```

## Troubleshooting

### Common Issues

#### Key Generation Failures
- **Check Permissions** - Verify user has required permissions
- **Check Key Size** - Verify key size is supported
- **Check Algorithm** - Verify algorithm is supported
- **Check Resources** - Verify sufficient system resources
- **Check Validation** - Run key validation

#### Key Signing Failures
- **Check Key Status** - Verify key is active
- **Check Key Validity** - Verify key is valid
- **Check Key Expiration** - Verify key is not expired
- **Check Key Access** - Verify key access permissions
- **Check Logs** - Review signing logs

#### Key Verification Failures
- **Check Public Key** - Verify public key is correct
- **Check Signature** - Verify signature format
- **Check Algorithm** - Verify algorithm matches
- **Check Key ID** - Verify key ID is correct
- **Check Logs** - Review verification logs

#### Performance Issues
- **Check Key Size** - Monitor key size impact
- **Check Algorithm** - Monitor algorithm performance
- **Check Usage Load** - Monitor key usage load
- **Check System Resources** - Monitor system resources
- **Check Logs** - Review performance logs

### Error Messages

#### "Key Not Found"
- **Cause**: Key ID doesn't exist in system
- **Solution**: Verify key ID and check key list

#### "Key Generation Failed"
- **Cause**: Key generation process failed
- **Solution**: Check key parameters and retry

#### "Key Expired"
- **Cause**: Key has expired
- **Solution**: Create new key or renew existing key

#### "Signing Timeout"
- **Cause**: Signing operation took too long
- **Solution**: Check key performance and system load

#### "Verification Failed"
- **Cause**: Signature verification failed
- **Solution**: Check signature and public key

## Best Practices

### Key Design
- **Descriptive Names** - Use clear, descriptive key names
- **Appropriate Algorithms** - Use appropriate algorithms for use case
- **Proper Key Sizes** - Use appropriate key sizes
- **Clear Expiration** - Set clear expiration dates
- **Documentation** - Document key purpose and usage

### Key Management
- **Key Rotation** - Rotate keys regularly
- **Key Lifecycle** - Manage key lifecycle properly
- **Key Storage** - Store keys securely
- **Key Access Control** - Control key access strictly
- **Key Monitoring** - Monitor key usage and performance

### Security
- **Key Protection** - Protect keys from unauthorized access
- **Key Encryption** - Encrypt keys at rest
- **Key Audit Logging** - Log all key operations
- **Key Threat Detection** - Detect security threats
- **Key Incident Response** - Have incident response procedures

### Performance
- **Key Optimization** - Optimize key operations
- **Key Caching** - Cache frequently used keys
- **Key Load Balancing** - Balance key load
- **Key Monitoring** - Monitor key performance
- **Key Analytics** - Analyze key usage patterns

## Related Features

- **[API Keys](./api_keys.md)** - API key management for authentication
- **[Refresh Tokens](./refresh_tokens.md)** - Refresh token management
- **[Token Logs](./token_logs.md)** - Token operation logging
- **[Monitor](./monitor.md)** - System monitoring for key performance
- **[Messaging Debug](./messaging_debug.md)** - Debug key operation issues

## API Reference

### Signing Key Management API
- **GET /api/admin/settings/signing_keys** - List all signing keys
- **POST /api/admin/settings/signing_keys** - Create new signing key
- **GET /api/admin/settings/signing_keys/{id}** - Get signing key details
- **PUT /api/admin/settings/signing_keys/{id}** - Update signing key
- **DELETE /api/admin/settings/signing_keys/{id}** - Delete signing key

### Signing Key Operations API
- **POST /api/admin/settings/signing_keys/{id}/sign** - Sign data with key
- **POST /api/admin/settings/signing_keys/{id}/verify** - Verify signature with key
- **GET /api/admin/settings/signing_keys/{id}/public** - Get public key
- **POST /api/admin/settings/signing_keys/{id}/test** - Test signing key

### Signing Key Usage API
- **GET /api/admin/settings/signing_keys/{id}/usage** - Get key usage statistics
- **GET /api/admin/settings/signing_keys/{id}/history** - Get key usage history
- **GET /api/admin/settings/signing_keys/{id}/performance** - Get key performance metrics
- **POST /api/admin/settings/signing_keys/{id}/rotate** - Rotate signing key

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Key Logs** - Review key operation logs
- **Signing Logs** - Check signing-specific logs
- **Support Team** - Contact support for complex issues

### Contact Information
- **Support Portal** - Use the support system in the application
- **Documentation** - Check the main documentation
- **Community** - Join the user community for help

---

**Status**: ✅ Complete - This guide covers all aspects of signing key management from creation to signing operations and troubleshooting.
