# JWT Token Management System (`src/lib/server/jwt_issuer/`)

This module implements a comprehensive JWT-based authentication system supporting multiple token types with different security requirements and lifecycles.

## Core Components

| Component | Purpose |
|:----------|:--------|
| `factory/` | Factory JWT handling for secure device onboarding |
| `invitation/` | Invitation token management for user onboarding |
| `tokens/` | Access & refresh token management |
| `keys/` | Key management with rotation support |
| `jwks/` | JWKS endpoints for public key distribution |
| `types.ts` | Shared TypeScript types and interfaces |

---

## Token Types & Lifecycles

### 1. Factory JWT
- **Purpose**: Initial device authentication during manufacturing
- **Lifetime**: 5-10 years
- **Storage**: Embedded in device firmware
- **Security**: Highest (HSM-signed)
- **Flow**:
  ```mermaid
  sequenceDiagram
      participant Factory
      participant Device
      participant API
      
      Factory->>Device: Inject Factory JWT
      Device->>API: POST /api/auth/onboard
      API->>API: Verify Factory JWT
      API->>DB: Create Device Record
      API-->>Device: Return API Key
  ```

### 2. Invitation Tokens
- **Purpose**: Secure user onboarding
- **Lifetime**: 7-30 days
- **Storage**: Database + Email/Link
- **Flow**:
  ```mermaid
  sequenceDiagram
      participant Admin
      participant User
      participant API
      
      Admin->>API: Create invitation
      API-->>User: Send invitation link
      User->>API: Accept invitation
      API->>DB: Validate token
      API-->>User: Complete registration
  ```

### 3. Access & Refresh Tokens
- **Purpose**: API authentication
- **Lifetime**: 
  - Access: 15-60 minutes
  - Refresh: 7-30 days
- **Flow**:
  ```mermaid
  sequenceDiagram
      participant Client
      participant API
      
      Client->>API: Authenticate (API Key/Refresh Token)
      alt Using API Key
          API-->>Client: Access + Refresh Token
      else Using Refresh Token
          API->>API: Validate Refresh Token
          API-->>Client: New Access Token
      end
  ```
    API-->>Device: Return Tokens
    
    loop Token Usage
        Device->>API: Request with JWT
        API->>API: Validate JWT (stateless)
        API-->>Device: Data
    end
    
    Device->>API: Token Expired
    Device->>API: Refresh Token
    API->>Database: Validate Refresh Token
    API->>API: Issue New JWT
    API-->>Device: New JWT
```

## Token Types

### 1. Factory JWT
- **Issuer**: Factory private key (offline)
- **Lifetime**: 5-10 years
- **Storage**: Embedded in device firmware
- **Claims**:
  ```typescript
  {
    sub: 'device_123',      // Device serial number
    typ: 'factory',          // Token type
    hw: 'model-x',           // Hardware model
    fw: '1.0.0',             // Firmware version
    iat: 1621660000,         // Issued at
    exp: 1947222400,         // Long expiration (2031)
    jti: 'factory-token-123' // Unique token ID
  }
  ```

### 2. Access Tokens
- **Lifetime**: 15-60 minutes
- **Storage**: Client-side only (in memory)
- **Validation**: Stateless (signature check only)
- **Claims**:
  ```typescript
  {
    sub: 'device_123',      // Device ID
    jti: 'unique-token-id',  // Token ID for revocation
    iat: 1621660000,        // Issued at
    exp: 1621663600,        // Expiration time
    kv: 1,                  // Key version
    scp: ['device:read']    // Scopes/permissions
  }
  ```

### 2. Refresh Tokens
- **Lifetime**: 7-30 days
- **Storage**: Secure HTTP-only cookie or secure storage
- **Validation**: Stateful (checked against database)
- **Revocation**: Can be revoked at any time

### 3. API Keys
- **Lifetime**: Until explicitly revoked
- **Storage**: Hashed in database
- **Usage**: Initial authentication to get tokens
- **Rotation**: Supports key versioning
- **Generation**: Created during device onboarding with Factory JWT

---

## Key Management

### JWT Signing Keys
- Stored in `JwtSigningKey` model
- Supports key rotation with `isPrimary` flag
- Multiple active keys supported during rotation
- Private keys encrypted at rest

### Key Rotation Process

#### Factory Keys
1. Generate new key pair in secure environment
2. Distribute to manufacturing facilities
3. Update JWKS endpoint after all devices with old key are produced

#### Runtime Keys
1. Generate new key pair
2. Mark new key as `isPrimary: true`
3. Update `keyVersion` for new tokens
4. Keep old keys until all issued tokens expire
5. Clean up expired keys

### Security Measures
- Keys never logged or exposed
- Automatic key rotation (configurable interval)
- Key usage metrics and monitoring
- Revocation support for compromised keys

---

## Database Schema

### Device
- `id`: Unique device ID
- `serialNumber`: Device serial from Factory JWT
- `hardwareModel`: Device hardware model
- `firmwareVersion`: Current firmware version
- `manufacturedAt`: When device was manufactured
- `onboardedAt`: When device completed onboarding
- `lastSeenAt`: Last communication timestamp

### ApiKey
- `keyHash`: Hashed API key
- `keyVersion`: For rotation
- `lastUsedAt`: Last successful use
- `expiresAt`: Optional expiration
- `isActive`: Enable/disable key

### JwtSigningKey
- `keyId`: Unique key identifier (kid)
- `privateKey`: Encrypted private key
- `publicKey`: Public key for verification
- `isPrimary`: Active signing key
- `algorithm`: Signing algorithm (RS256)

### RefreshToken
- `tokenHash`: Hashed refresh token
- `deviceId`: Associated device
- `isRevoked`: Revocation status
- `expiresAt`: Expiration timestamp

---

## Implementation Guide

### 1. Factory JWT Implementation

#### Key Generation (Offline Process)
```typescript
// Generate RSA key pair for factory use
const { privateKey, publicKey } = await generateKeyPair('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Store in HSM and register in database
await prisma.jwtSigningKey.create({
  data: {
    keyId: 'factory-key-001',
    keyType: 'FACTORY',
    privateKey: encryptWithKMS(privateKey, 'FACTORY_KEY'),
    publicKey,
    isPrimary: true,
    expiresAt: dayjs().add(10, 'years').toDate()
  }
});
```

#### Device Onboarding
```typescript
// factory/onboard.ts
export async function onboardDevice(factoryJwt: string, ip: string) {
  // 1. Verify JWT signature using factory public key
  const payload = verify(factoryJwt, await getFactoryPublicKey(), {
    algorithms: ['RS256'],
    issuer: 'factory'
  });

  // 2. Check if token exists and is unused
  const token = await prisma.factoryToken.update({
    where: { 
      tokenId: payload.jti,
      isUsed: false,
      expiresAt: { gt: new Date() }
    },
    data: {
      isUsed: true,
      usedAt: new Date(),
      usedByIp: ip
    }
  });

  // 3. Create device record
  const device = await prisma.device.create({
    data: {
      serialNumber: payload.sub,
      hardwareModel: payload.hw,
      firmwareVersion: payload.fw,
      lastSeenAt: new Date()
    }
  });

  // 4. Generate API key
  const apiKey = await generateApiKey(device.id);
  
  return { device, apiKey };
}
```

### 2. Invitation Flow

#### Creating Invitations
```typescript
// invitation/service.ts
export async function createInvitation(email: string, inviterId: string) {
  const token = await prisma.invitationToken.create({
    data: {
      email,
      token: randomBytes(32).toString('hex'),
      expiresAt: dayjs().add(7, 'days').toDate(),
      createdBy: { connect: { id: inviterId } }
    }
  });
  
  await sendInvitationEmail(email, token.token);
  return token;
}
```

### 3. Token Refresh Flow

```typescript
// tokens/refresh.ts
export async function refreshAccessToken(refreshToken: string) {
  // 1. Verify and decode refresh token
  const payload = verifyRefreshToken(refreshToken);
  
  // 2. Check if refresh token is valid in DB
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) }
  });

  if (!token || token.isRevoked || token.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }

  // 3. Generate new access token
  return {
    accessToken: generateAccessToken({
      sub: token.userId,
      scp: ['user:read', 'user:write'] // Example scopes
    }),
    refreshToken: await rotateRefreshToken(token.id, refreshToken)
  };
}
```

## Security Best Practices

### Key Management
- **Factory Keys**: Stored in HSM, rotated annually
- **Runtime Keys**: Rotated every 30 days
- **Invitation Keys**: Rotated every 90 days

### Rate Limiting
```typescript
// Example using express-rate-limit
app.post('/api/auth/onboard', 
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 requests per window
  }),
  onboardHandler
);
```

### Monitoring & Alerting
- Track failed authentication attempts
- Alert on unusual patterns
- Log all token issuances and revocations
- Monitor key rotation status

## API Reference

### Factory Endpoints
- `POST /api/factory/onboard` - Device onboarding
- `GET /.well-known/jwks-factory.json` - Factory public keys

### User Endpoints
- `POST /api/invitations` - Create invitation
- `POST /api/auth/register` - Complete registration
- `POST /api/auth/token` - Get access token
- `POST /api/auth/refresh` - Refresh access token

## Best Practices

1. **For Devices**
   - Store API keys securely in secure storage
   - Implement automatic token refresh before expiration
   - Handle token expiration gracefully with retry logic

2. **For Web Clients**
   - Use HTTP-only, secure, same-site cookies for refresh tokens
   - Store access tokens in memory only
   - Implement silent refresh for better UX

3. **For Backend Services**
   - Always validate tokens and check scopes
   - Use the latest public keys for verification
   - Implement proper error handling and logging

## Troubleshooting

### Common Issues
1. **Invalid Token**
   - Check token expiration
   - Verify token signature with correct key
   - Ensure proper key rotation

2. **Performance Problems**
   - Cache public keys (with TTL)
   - Optimize database queries for token validation
   - Monitor token validation performance

3. **Security Incidents**
   - Revoke compromised tokens immediately
   - Rotate affected keys
   - Audit all recent authentications

### TokenUsageLog
- Audit trail of all token operations
- Tracks usage patterns and security events
- Used for monitoring and alerting

---

## Security Best Practices

### Factory JWT Security
1. **Secure Storage**
   - Store private keys in HSM
   - Limit access to authorized personnel
   - Never store in version control

2. **Device Manufacturing**
   - Inject Factory JWT during manufacturing
   - Use secure element if available
   - Log all issued tokens

3. **Onboarding Security**
   - One-time use of Factory JWT
   - Strict rate limiting
   - IP whitelisting for onboarding endpoints

### Runtime Security
1. **Short-Lived Access Tokens**
   - 15-60 minute expiration
   - No revocation needed
   - Minimizes exposure window

2. **Secure Refresh Tokens**
   - Stored in HTTP-only cookies
   - Rotated on each use
   - Revocable at any time

3. **Key Management**
   - Regular key rotation
   - Secure key storage
   - Limited key lifetime

4. **Monitoring**
   - Track token usage
   - Detect abnormal patterns
   - Automatic alerts for suspicious activity

---

## API Endpoints

### Factory Endpoints
- `GET /.well-known/jwks-factory.json` - Public factory keys
- `POST /api/factory/onboard` - Device onboarding with Factory JWT
  - Validates Factory JWT
  - Creates device record
  - Issues API key

### Runtime Endpoints
- `POST /api/auth/device` - Authenticate with API key
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/revoke` - Revoke refresh token

### Key Management (Admin)
- `GET /api/keys` - List active keys
- `POST /api/keys/rotate` - Rotate signing keys
- `DELETE /api/keys/:id` - Revoke key

### JWKS Endpoint
- `GET /.well-known/jwks.json` - Public keys for JWT validation

---

## Future Enhancements

- Hardware Security Module (HSM) integration
- Automated key rotation policies
- Fine-grained permission scopes
- Rate limiting and abuse prevention
- Support for certificate-based authentication

---

## Implementation Notes

### Token Validation
- Access tokens are validated using the public keys from JWKS
- Refresh tokens are validated against the database
- All tokens include standard claims and custom claims as needed

### Performance Considerations
- Public keys are cached in memory
- Frequent key lookups are optimized with proper indexing
- Token validation is designed to be stateless when possible

### Error Handling
- Clear error messages for common issues
- Proper HTTP status codes
- Logging of security-relevant events

### Monitoring
- Token issuance and refresh metrics
- Failed authentication attempts
- Key rotation events

---

_This system provides a secure, scalable foundation for API authentication and authorization using industry-standard JWT tokens with robust key management and rotation._
