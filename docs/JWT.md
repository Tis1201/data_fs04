# JWT Authentication

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
   - `deviceId`: The unique identifier of the authenticated device
   - `userId`: The ID of the user associated with the device
   - `deviceName`: The name of the device
   - `iat` (Issued At): Timestamp when the token was issued
   - `exp` (Expiration): Timestamp when the token will expire (default: 1 hour)
   - `iss` (Issuer): Set to "fs04"
   - `sub` (Subject): Set to the device ID

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