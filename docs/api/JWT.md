# JWT Authentication

## Prerequisites

Before using JWT authentication, you need to generate a token signing key in the admin panel:

1. Log in to the admin interface
2. Navigate to the JWT Signing Keys section
3. Click "Generate New Key"
4. Select the key type (e.g., RSA)
5. Set the algorithm (e.g., RS256)
6. Mark the key as primary if it's your main signing key
7. Save the key

**Note:** The system requires at least one active signing key with the `TOKEN` type to generate JWTs. If no valid key is found, token generation will fail with a 500 error.

This document outlines the JWT (JSON Web Token) authentication system used in the application, including token issuance, validation, and key management.

## Token Issuance

### Endpoint
```
GET /api/device/jwt
```

### Authentication
- Requires a valid `X-API-Key` header for device authentication
- The API key is validated by the `restrictDevice` middleware

### Token Generation
1. The system retrieves the primary signing key for access tokens from the database
2. A JWT is signed with the following claims:
   - `deviceId`: The unique identifier of the authenticated device (e.g., "94a5dbe5-6604-429e-9b84-882ce2816dd5")
   - `accountId`: The ID of the account the device belongs to (e.g., "cmc4mnmcu0003rzxvupiqycd7")
   - `userId`: The ID of the user associated with the device (e.g., "cmc4msp7r000810g1ya5u3od2")
   - `deviceName`: The name of the device (e.g., "Device-94a5dbe5")
   - `iat` (Issued At): Timestamp when the token was issued (e.g., 1753512831)
   - `exp` (Expiration): Timestamp when the token will expire (default: 1 hour from issuance)
   - `iss` (Issuer): Set to "fs04"
   - `sub` (Subject): Set to the device ID (same as deviceId)

### Example JWT Payload
```json
{
  "deviceId": "94a5dbe5-6604-429e-9b84-882ce2816dd5",
  "accountId": "cmc4mnmcu0003rzxvupiqycd7",
  "userId": "cmc4msp7r000810g1ya5u3od2",
  "deviceName": "Device-94a5dbe5",
  "iat": 1753512831,
  "exp": 1753516431,
  "iss": "fs04",
  "sub": "94a5dbe5-6604-429e-9b84-882ce2816dd5"
}
```

### Response
On success, returns a JSON object containing the JWT:
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImNtZGpxNTFyajAwMDIzNDN3M3A0NmRybnoifQ..."
}
```

## JSON Web Key Set (JWKS) Endpoint

The application exposes a JWKS endpoint for public key distribution:

```
GET /.well-known/jwks.json
```

### Response
Returns a JSON Web Key Set containing the public keys that can be used to verify JWTs:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "cmdjq51rj0002343w3p46drnz",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

### Caching
- The response includes appropriate cache headers
- Clients should respect the `Cache-Control` header to avoid unnecessary requests
- Default cache duration is 300 seconds (5 minutes)

## Key ID (KID)

- Each signing key has a unique Key ID (KID)
- The KID is included in the JWT header and the JWKS response
- The KID is used to identify which key was used to sign a JWT
- Key rotation is supported by maintaining multiple active keys with different KIDs

## Token Validation

To validate a JWT:

1. Extract the KID from the JWT header
2. Fetch the public key from the JWKS endpoint
3. Verify the token signature using the public key
4. Validate standard claims (issuer, expiration, etc.)

### Example Validation (Python)

```python
from jwt import decode, PyJWKClient

# The JWT to validate
token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImNtZGpxNTFyajAwMDIzNDN3M3A0NmRybnoifQ..."

# URL of the JWKS endpoint
jwks_url = "https://your-domain.com/.well-known/jwks.json"

# Create a JWK client and get the signing key
jwk_client = PyJWKClient(jwks_url)
signing_key = jwk_client.get_signing_key_from_jwt(token)

# Decode and verify the token
decoded = decode(
    token,
    signing_key.key,
    algorithms=["RS256"],
    issuer="fs04"  # Must match the issuer claim
)
```

## Security Considerations

- Private keys are stored securely in the database
- Only public keys are exposed via the JWKS endpoint
- Keys should be rotated regularly
- Token expiration should be kept reasonably short
- Use HTTPS for all token-related communications
- Implement proper rate limiting on the JWKS endpoint