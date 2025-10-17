## User Invites

This document captures the existing invitation workflow and the proposed JWT-based replacement that leverages the Link signing key.

### Old Invites (Current Implementation)

- **Token creation**: `createInvitation()` (`src/lib/server/invitation/service.ts`) inserts a placeholder `User` with `status = 'INACTIVE'`, then stores a hashed 64-char random token in `InvitationToken.token`.
- **Link format**: Invite URL is `${PUBLIC_BASE_URL}/user/invite?token=<rawToken>`. No account metadata is embedded; the backend hashes the `token` query string to look up the DB row.
- **Acceptance**: `validateInvitationToken()` re-hashes the token, verifies expiry (`expiresAt`), and ensures `usedAt` is null. On success the user sets a password via `acceptInvitation()` and the invitation is marked used.
- **Limitations**: Link is opaque, requires DB round-trip to identify account or inviter, and cannot be cryptographically verified by services without hitting the database. There’s no native binding to the signing key hierarchy.

### New Invites (Proposed Link-Key JWT Flow)

- **JWT issuance**: Use the `Link` signing key (`JwtSigningKey.keyType = 'INVITATION'`) to emit a JWT containing claims such as `account_id`, `email`, `invited_user_id`, `inviter_id`, `exp`, and a unique `jti`.
li
- **State tracking**: Persist the `jti` (or its hash) with invitation metadata so the server can enforce one-time use and revocation, mirroring the current `InvitationToken` semantics.
- **Acceptance**: After signature validation, the server trusts the embedded claims to render UI context and finalize account membership before marking the `jti` as consumed.
- **Advantages**: Payload is self-describing, tamper resistant, and aligned with the existing key hierarchy; account context travels with the token, reducing preliminary DB lookups.

### Comparison

- **Old flow pros**:
  - Simple to reason about: a single DB lookup validates the token.
  - Easy to revoke: deleting or updating `InvitationToken` immediately invalidates the link.
- **Old flow cons**:
  - Every client interaction requires a server round-trip just to learn context.
  - Link contains no account data, so UI cannot show meaningful context before validation.
  - No cryptographic proof; anyone with DB access could mutate token mappings.

- **JWT flow pros**:
  - Invitations carry signed claims that identify account and inviter without extra DB queries on the hot path.
  - Signature verification is centralized on the server after fetching Link-key public material, keeping validation logic internal.
  - Integrates with existing key management (rotation, audit) and prevents tampering.
- **JWT flow cons**:
  - Requires maintaining JWKS cache or verifying through a DB-backed key fetch.
  - Must persist `jti` to enforce one-time use, so you still hit the DB during acceptance.
  - Additional implementation complexity (JWT issuance, expiry handling, key rotation).
