# Device Claim Processes

## 1) Existing Ad‑Hoc Claim (PIN-based)

- Device → Server
  - Device generates a short‑lived PIN and opens SSE to `/api/device/register` with header `X-Device-PIN`.
  - Server authenticates the connection and stores `pin -> deviceMeta(connectionId)`.

- User → Server
  - An authenticated user submits the PIN (via messaging/WebSocket).
  - [DeviceManager.claimDevice(pin, user, account)](cci:1://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceManager.ts:58:4-247:5) validates the PIN and account membership, then:
    - Upserts [Device](cci:2://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/stores/device-store.ts:27:0-37:1) with `status: ACTIVE`, `claimedAt`, `claimedBy`, links to `account` and `user`.
    - Issues an `apiKey`.
    - Sends a privileged “registered” message (sudo) to the device SSE connection with `apiKey`, `deviceId`, `accountId`, `userId`.
    - Removes the PIN from the PIN store.

- Device completes
  - Device receives “registered”, persists `apiKey`, and POSTs its system info to `/api/device/add`.
  - Subsequent requests use `x-api-key`.

- Notes
  - PINs should expire quickly; remove on success/timeout.
  - Keep this flow unchanged as the fallback path.

## 2) Pre‑Claim (Uploaded MACs with Expiry)

- Data model (Zenstack)
  - DeviceClaimSet: id, name, description, accountId, expiresAt?, status(ACTIVE/INACTIVE), createdBy, timestamps.
  - DeviceClaim: id, setId, accountId, macId, name, description, expiresAt?, status(PENDING|FULFILLED|EXPIRED|REVOKED), deviceId?, claimedAt?, claimedBy?, timestamps.
  - Constraints: unique(setId, macId). Effective expiry = `coalesce(DeviceClaim.expiresAt, DeviceClaimSet.expiresAt)`.

- Admin upload (SvelteKit Action)
  - CSV columns: `macId,name,description,expiresAt?`.
  - Validate with Zod, normalize MACs (uppercase, strip separators), dedupe.
  - Create/append to an ACTIVE `DeviceClaimSet` and insert PENDING rows in a transaction.
  - Security: restrict to account admins; row‑level security via Zenstack.

- Device auto‑claim (Factory token)
  - Device POSTs to `/api/device/add` with factory token header (e.g., `X-Factory-Token`) and system info including MACs.
  - Server matches any PENDING `DeviceClaim` by normalized MAC where not expired and set is ACTIVE.
  - Transactionally:
    - Mark the selected row FULFILLED (store matched macId, claimedAt/By).
    - Upsert [Device](cci:2://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/stores/device-store.ts:27:0-37:1) linked to `accountId` from the claim, set ACTIVE, issue `apiKey`.
    - Send sudo “registered” message to the device with `apiKey` and `deviceId`.
  - Device switches to `x-api-key` for subsequent calls.

- Conflict with PIN flow
  - If a device is PIN‑claimed first, any overlapping PENDING pre‑claim rows should be REVOKED (or marked FULFILLED to that device for audit) to prevent future auto‑claims.

- Update rules
  - `accountId` immutable after creation.
  - When `status = FULFILLED`, `macId/accountId/setId` immutable (allow name/description edits only).
  - No duplicate active claims: reject updates that create another PENDING/ FULFILLED for the same `macId` in ACTIVE sets of the same account.
  - Status transitions: PENDING → FULFILLED/EXPIRED/REVOKED. No re‑opening expired/revoked.

## Set‑Level Rollups (for Admin UI)

For each `DeviceClaimSet` show:
- Days to expiry:
  - If `set.expiresAt`: ceil(days until that date), min 0.
  - Else: ceil(days until latest non‑null effective row expiry), or null if none.
- Totals:
  - totalRows
  - claimed: FULFILLED
  - outstanding: PENDING and not expired (by effective expiry)
  - expired: EXPIRED, or PENDING/REVOKED with effective expiry past
  - revoked: REVOKED
- Expiring soon: PENDING rows with effective expiry within the next N days (e.g., 7).

Compute effective expiry per row as `coalesce(DeviceClaim.expiresAt, DeviceClaimSet.expiresAt)`.

## Auth Headers Summary

- PIN registration: `X-Device-PIN` (SSE `/api/device/register`)
- Factory pre‑claim: `X-Factory-Token` (POST `/api/device/add`)
- Post‑registration: `x-api-key` (all device APIs)


## Implementation Checklist

- [Data model] [schema.zmodel](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/schema.zmodel:0:0-0:0)
  - Add models: `DeviceClaimSet`, `DeviceClaim`
  - Add enums: `ClaimStatus { PENDING, FULFILLED, EXPIRED, REVOKED }`, `SetStatus { ACTIVE, INACTIVE }`
  - Constraints: unique `(setId, macId)`; indexes on `macId`, `status`, `expiresAt`
  - RLS (Zenstack): restrict read to account members; only admins/creator mutate; prevent edits to `macId/accountId/setId` when `status = FULFILLED`

- [Admin action: upload + list] `src/routes/admin/devices/preclaim/+page.server.ts`
  - Guard: [restrict](cci:1://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/security/guards.ts:42:0-75:1) and ensure user is admin of the target `accountId`
  - Parse CSV (columns: `macId,name,description,expiresAt?`)
  - Validate with Zod; normalize MACs (uppercase, strip non-hex); dedupe
  - Transaction:
    - Ensure/create ACTIVE `DeviceClaimSet` for the account
    - Bulk insert PENDING `DeviceClaim` rows; reject duplicates across ACTIVE sets for same account
  - Return rollups per set (see “Set‑Level Rollups”)

- [Admin page UI] `src/routes/admin/devices/preclaim/+page.svelte`
  - Use existing form components under `src/lib/components/ui_components_sveltekit/form`
  - Use `sveltekit-superforms` for Zod schema binding
  - Display rollups: total, claimed, outstanding, expired, revoked, expiring soon, days to expiry
  - No visual redesign; reuse existing admin layout

- [Factory guard] [src/lib/server/security/guards.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/security/guards.ts:0:0-0:0)
  - Add `restrict_device_factory()` to validate `X-Factory-Token`
  - Helper in [src/lib/server/device/deviceAuth.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceAuth.ts:0:0-0:0) to verify factory token source and scope

- [DeviceManager] [src/lib/server/device/deviceManager.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceManager.ts:0:0-0:0)
  - Add `tryPreclaimByMac(macs: string[], ctx)`:
    - Normalize MACs; find PENDING `DeviceClaim` where effective expiry not passed and set is ACTIVE
    - In a transaction: mark row FULFILLED, upsert/link [Device](cci:2://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/stores/device-store.ts:27:0-37:1) to `accountId`, issue `apiKey`, publish sudo “registered”
    - Concurrency: update with `WHERE id=? AND status='PENDING'` (optionally `version` for OCC)
  - On PIN-claim success, revoke overlapping PENDING pre-claims for any of the device’s MACs

- [Registration endpoint hook] [src/routes/api/device/add/+server.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/routes/api/device/add/+server.ts:0:0-0:0)
  - If `X-Factory-Token` present:
    - Invoke `restrict_device_factory()`
    - Extract all MACs from payload; call `DeviceManager.tryPreclaimByMac()`
    - If SSE register connection exists, deliver “registered” via sudo message; else include `apiKey/deviceId` once in the HTTP response
  - If no factory token: keep current behavior (PIN path and API-key path unchanged)

- [PIN flow hardening] (optional)
  - Add PIN expiry in [registerDevice](cci:1://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceManager.ts:27:4-56:5) store and remove on claim/timeout
  - Structured logs around invalid/expired PINs

- [Expiry handling]
  - Lazy expiry: treat rows as expired when effective expiry <= now
  - Optional background task to mark `EXPIRED` for reporting

- [Observability]
  - Logs: upload results, match, fulfill, revoke, conflicts
  - Metrics (optional): `preclaim_rows_total`, `preclaim_fulfilled_total`, `preclaim_conflicts_total`, `preclaim_expired_total`

- [Tests]
  - Unit: MAC normalization, duplicate rejection, status transitions, RLS
  - Integration:
    - Pre-claim upload → auto-claim with factory token → device receives API key
    - Conflict: PIN claim before auto-claim revokes pending row
    - Expiry: pending row past expiry does not match
