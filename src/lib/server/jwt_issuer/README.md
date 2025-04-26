# JWT Issuer (`src/lib/server/jwt_issuer/`)

This directory manages all JWT (JSON Web Token) related logic for the platform, including secure device onboarding (Factory JWTs) and runtime authentication (Device/User JWTs).

The system supports scalable key management, secure JWT issuance, JWKS public key exposure, and clean separation between manufacturing and operational flows.

## Structure

| Folder / File | Purpose |
|:--------------|:--------|
| `factory/` | Handles Factory JWT signing, verification, key management, and JWKS generation for device manufacturing trust. |
| `runtime/` | Handles Runtime JWT signing, verification, key management, and JWKS generation for device and user authentication. |
| `jwks.ts` | (Optional) Top-level combiner for JWKS if needed across multiple systems. |
| `utils.ts` | Common helper utilities for JWT handling (e.g., base64 encoding, claim standardization). |

---

## Overview

### Factory JWTs (`factory/`)

- **Purpose**: Prove that a device was manufactured by the platform.
- **Issuer**: Factory private keys.
- **Lifetime**: Long-lived (5–10 years).
- **Usage**: Presented by devices at first boot to register/claim identity.
- **JWKS**: Public factory keys exposed via `/api/.well-known/jwks-factory.json`.

### Runtime JWTs (`runtime/`)

- **Purpose**: Authenticate devices and users during normal API operation.
- **Issuer**: Runtime private keys.
- **Lifetime**: Short-lived (1h–7d).
- **Usage**: Devices and users obtain runtime JWTs after API Key authentication or login.
- **JWKS**: Public runtime keys exposed via `/api/.well-known/jwks-operational.json`.

---

## Key Management

- **Private keys and public keys are stored securely in the database** with metadata including:
  - `kid` (Key ID)
  - `createdAt`
  - `status` (`active`, `retired`)
  - `algorithm` (e.g., RS256)

- **Key Rotation**:
  - New keys can be inserted and marked as `active`.
  - Old keys are kept as `retired` during a grace period for JWT validation.
  - JWKS endpoints publish both active and recently retired public keys.

- **Separation of Trust**:
  - Factory keys are only used for onboarding new devices.
  - Runtime keys are only used for authenticating ongoing operations.

---

## JWKS Exposure

Each system manages and exposes its own JWKS:

| Endpoint | Provided by | Purpose |
|:---|:---|:---|
| `/api/.well-known/jwks-factory.json` | `factory/jwks.ts` | Lists trusted public keys for verifying Factory JWTs. |
| `/api/.well-known/jwks-operational.json` | `runtime/jwks.ts` | Lists trusted public keys for verifying Runtime JWTs. |

(Optionally, the top-level `jwt_issuer/jwks.ts` can combine multiple JWKS if needed.)

---

## Security Best Practices

- Different keypairs for Factory JWTs and Runtime JWTs to minimize risk.
- Short expiry times for Runtime JWTs (1–7 days).
- Standard JWT claims enforced (`iss`, `aud`, `exp`, `kid`).
- Private keys are securely loaded from the database into memory at runtime.
- JWKS endpoints only expose public information necessary for signature verification.

---

## Future Extensions

- Support for **Admin JWTs** (for internal staff/admin operations).
- **Automated Key Rotation Services** (especially for Runtime keys).
- **Multi-tenant JWKS exposure** for shared platforms.
- **Federated Identity Models** (e.g., linking Factory JWTs with external Identity Providers).

---

_This directory forms the secure, scalable, and clean foundation for issuing, rotating, and managing JWTs across the entire platform lifecycle._
