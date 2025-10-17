# Licensing Overview

- **Token-signed JWT**: Every license stored in `schema.zmodel:1249-1288` is a JWT signed with the **Token** signing key (`JwtSigningKey.keyType = 'TOKEN'`). Factory keys remain dedicated to device provisioning and must never sign runtime licenses.
- **Immutable key linkage**: `License.keyId` captures the `kid` embedded in the JWT header. At issuance time we persist the corresponding `JwtSigningKey.id`, enabling auditors and services to trace which asymmetric key was used. Where possible, expose the admin URL for that key so operators can inspect rotation history (see `Admin → JWT → Signing Keys`).
- **Model-level relation**: Persist `License.signingKeyId` as a foreign key to `JwtSigningKey.id` so the database enforces the linkage. This makes it trivial to traverse from a license record to the exact key entry used for signing.
- **Device binding**: The JWT payload must include `device_id`, `account_id`, `license_id`, `issued_at`, `expires_at`, and entitlements. Tying the token to the device prevents replay on other hardware.
- **Verification-first delivery**: Clients never receive the private key. They obtain the stored license blob via an authenticated API, validate the signature with the published JWKS/public key, and confirm the `device_id` claim before trusting any entitlements.
- **JWKS distribution**: Devices download the active public keys from the well-known endpoint at `src/routes/.well-known/jwks.json` before validating any license.

## Key Hierarchy

- **Factory Key** (`keyType = 'FACTORY'`): Signs onboarding credentials such as factory tokens; not used for licenses.
- **Token Key** (`keyType = 'TOKEN'`): Signs license JWTs and other runtime authentication artifacts. This key pair is rotated regularly; inactive keys remain available for historical verification until all issued licenses expire.
- **Link Key** (`keyType = 'INVITATION'`): Handles invitation/reset flows and is unrelated to licensing.

### Storage Details

- `License.jwt`: Persisted JWT string issued to a device.
- `License.keyId`: Mirrors the JWT header `kid` to resolve the signing key.
- `JwtSigningKey.publicKey`: Used by services for verification (exported as PEM/JWKS).
- `JwtSigningKey.privateKey`: Held exclusively by the signing service; never exposed or used for verification.

## License Issuance Flow

1. **Resolve token key**: Select the active `JwtSigningKey` where `keyType = 'TOKEN'` and `isPrimary = true`.
2. **Build claims**:
   - `sub`: `device_id`
   - `account_id`: Owning account
   - `license_id`: Identifier for audit linkage
   - `entitlements`: Array of enabled capabilities/features
   - `iat` / `exp`: Issuance and expiry timestamps
3. **Sign JWT**: Use the token key’s private key (typically RS256) to sign the payload and emit a `kid` matching `JwtSigningKey.keyId`.
4. **Persist**: Store the JWT, `kid`, algorithm, and references to account/device in the `License` record.

## Verification Flow

1. **Fetch license**: Authenticated caller requests `GET /api/devices/{id}/license`.
   - Guard with `restrict` so only admins or account members with rights can access.
   - Handler loads the `License` via `locals.prisma.license.findFirst({ where: { deviceId: params.id, status: 'ACTIVE' } })`.
2. **Obtain signing key**: Use `kid` to locate the `JwtSigningKey` row (`keyType = 'TOKEN'`). Publish the associated public key via JWKS or PEM.
3. **Verify signature**: Validate the JWT signature with the public key and confirm algorithm matches the stored `License.algorithm`.
4. **Validate claims**: Ensure `device_id` equals the requested device, `account_id` matches the caller’s account, and token is within validity window (`exp`, optional `nbf`). Reject licenses with mismatched claims to prevent spoofing.
5. **Refresh signing keys**: When verification fails due to unknown `kid`, fetch the latest JWKS from `.well-known/jwks.json` and retry. Devices should cache with respect to HTTP cache headers to avoid unnecessary requests.
6. **Enforce entitlements**: Only after verification should downstream services apply capabilities encoded in the JWT.

## Device License API Contract

- **Endpoint**: `GET /api/devices/:deviceId/license`
- **Auth**: `restrict` guard requiring `SystemRole.ADMIN` or membership in the target account.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "deviceId": "...",
      "licenseId": "...",
      "jwt": "<base64 token>",
      "kid": "...",
      "algorithm": "RS256",
      "expiresAt": "2025-12-31T23:59:59.000Z"
    }
  }
  ```
- **Error cases**: Return 404 when no active license exists, 403 when caller lacks access, and 410 when license is revoked.

## Anti-Spoofing Checklist

- **Device-bound claim**: Reject any JWT whose `device_id` does not match the device record.
- **Key audit trail**: Maintain `License.signingKeyId` → `JwtSigningKey.id` for traceability during incident response.
- **Rotation compatibility**: Keep historical public keys available until all licenses signed with them expire or are revoked.
- **Revocation**: Update `License.status` to `REVOKED` and rotate JWT contents; clients must fetch the latest license before trusting cached entitlements.

Keeping license verification public-key based, with tight coupling to device metadata, eliminates spoofing opportunities while still allowing secure distribution over standard APIs.