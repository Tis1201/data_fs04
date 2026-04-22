/**
 * MQTT client identity — single source of truth for parsing & building EMQX clientids.
 *
 * Background: every device app authenticates as `device:<deviceId>` (one MQTT username per
 * physical device). Multiple apps on that device (RDM agent + radar bridge + …) share the
 * same username but get distinct random `clientid`s. Without typed clientids the broker
 * cannot tell us which session — agent or radar — emitted the connect/disconnect event,
 * which is why a radar restart used to flip the whole device offline.
 *
 * This module embeds the *tier* (and, for radar, the controllerId) directly in the EMQX
 * clientid so `$events/client/{connected,disconnected}` payloads carry that information
 * for free, with no extra round-trip to the EMQX HTTP API and no race window.
 *
 * Format (forward-compatible, `::` separator chosen so `_`-suffixed legacy ids still parse):
 *   agent  : device:<deviceId>::agent::<6hex>
 *   radar  : device:<deviceId>::radar:<controllerId>::<6hex>
 *   user   : user:<userId>:<accountId>::<6hex>
 *   factory: factory:<bootstrapId>::<6hex>
 *   worker : server:<role>::<6hex>          (back-end shared subscribers)
 *
 * Backwards compatibility: legacy `device:<id>_<6hex>` and `user:<id>:<acct>_<6hex>`
 * still parse correctly. Legacy device sessions are reported as `agent` because that is
 * what every fielded device today actually runs — the radar bridge is a brand-new client.
 */

import { randomBytes } from 'node:crypto';

const TIER_SEP = '::';
const RANDOM_SUFFIX_BYTES = 3;

export type MqttClientIdentity =
    | { kind: 'agent'; deviceId: string; legacy: boolean }
    | { kind: 'radar'; deviceId: string; controllerId: string; legacy: boolean }
    | { kind: 'factory'; bootstrapId: string; legacy: boolean }
    | { kind: 'user'; userId: string; accountId: string | null; legacy: boolean }
    | { kind: 'server'; role: string }
    | { kind: 'unknown' };

/** Extract the agent's deviceId from an identity if present (radar OR agent). */
export function deviceIdOfIdentity(identity: MqttClientIdentity): string | null {
    if (identity.kind === 'agent' || identity.kind === 'radar') {
        return identity.deviceId;
    }
    return null;
}

/**
 * Parse an EMQX clientid (with optional username hint) into a typed identity.
 *
 * `username` is the EMQX `username` field (= JWT `sub`). When present it is the
 * canonical device/user identifier and is preferred over the (mutable) clientid
 * suffix. We still need the clientid to extract the tier suffix (agent/radar).
 */
export function parseMqttClientId(
    clientId: string | null | undefined,
    username?: string | null
): MqttClientIdentity {
    if (typeof clientId !== 'string' || clientId.length === 0) {
        return { kind: 'unknown' };
    }

    const trimmedUsername = typeof username === 'string' ? username.trim() : '';

    if (clientId.startsWith('server:')) {
        const rest = clientId.slice('server:'.length);
        const role = stripRandomSuffix(rest);
        return { kind: 'server', role: role || 'unknown' };
    }

    if (clientId.startsWith('user:') || trimmedUsername.startsWith('user:')) {
        return parseUser(clientId, trimmedUsername);
    }

    if (clientId.startsWith('factory:') || trimmedUsername.startsWith('factory:')) {
        return parseFactory(clientId, trimmedUsername);
    }

    if (clientId.startsWith('device:') || trimmedUsername.startsWith('device:')) {
        return parseDevice(clientId, trimmedUsername);
    }

    return { kind: 'unknown' };
}

/**
 * Build a typed clientid for a new MQTT session. Pure function — no side effects.
 * Suffix uses 6 random hex chars (3 bytes) to match the legacy format width.
 */
export function buildMqttClientId(spec:
    | { kind: 'agent'; deviceId: string }
    | { kind: 'radar'; deviceId: string; controllerId: string }
    | { kind: 'factory'; bootstrapId: string }
    | { kind: 'user'; userId: string; accountId: string | null | undefined }
    | { kind: 'server'; role: string }
): string {
    const suffix = randomBytes(RANDOM_SUFFIX_BYTES).toString('hex');
    switch (spec.kind) {
        case 'agent':
            return `device:${spec.deviceId}${TIER_SEP}agent${TIER_SEP}${suffix}`;
        case 'radar':
            return `device:${spec.deviceId}${TIER_SEP}radar:${spec.controllerId}${TIER_SEP}${suffix}`;
        case 'factory':
            return `factory:${spec.bootstrapId}${TIER_SEP}${suffix}`;
        case 'user': {
            const acct = spec.accountId ? `:${spec.accountId}` : '';
            return `user:${spec.userId}${acct}${TIER_SEP}${suffix}`;
        }
        case 'server':
            return `server:${spec.role}${TIER_SEP}${suffix}`;
    }
}

// ───────────────────────── internal parsers ─────────────────────────

function parseDevice(clientId: string, username: string): MqttClientIdentity {
    const usernameDeviceId = username.startsWith('device:') ? username.slice('device:'.length) : '';
    const cidBody = clientId.startsWith('device:') ? clientId.slice('device:'.length) : '';

    // 1. New format: <deviceId>::agent::<rand> or <deviceId>::radar:<controllerId>::<rand>
    if (cidBody.includes(TIER_SEP)) {
        const parts = cidBody.split(TIER_SEP);
        // deviceId may itself contain `::` if someone is malicious; require ≥3 parts and
        // assume the last part is the random suffix and the second-to-last is the tier descriptor.
        if (parts.length >= 3) {
            const tierDescriptor = parts[parts.length - 2];
            const deviceId = parts.slice(0, parts.length - 2).join(TIER_SEP) || usernameDeviceId;
            if (!deviceId) return { kind: 'unknown' };
            if (tierDescriptor === 'agent') {
                return { kind: 'agent', deviceId, legacy: false };
            }
            if (tierDescriptor.startsWith('radar:')) {
                const controllerId = tierDescriptor.slice('radar:'.length);
                if (controllerId) {
                    return { kind: 'radar', deviceId, controllerId, legacy: false };
                }
            }
            // Unknown sub-tier under device:* — treat as agent so we keep tracking the device
            // (but flag legacy=true so we know to upgrade).
            return { kind: 'agent', deviceId, legacy: true };
        }
    }

    // 2. Legacy format: device:<id>_<6hex>. Always treat as `agent` because the radar app
    // is brand-new and only ever ships with the typed clientid.
    const legacyDeviceId = usernameDeviceId || stripRandomSuffix(cidBody);
    if (!legacyDeviceId || !/^[A-Za-z0-9]/.test(legacyDeviceId)) {
        return { kind: 'unknown' };
    }
    return { kind: 'agent', deviceId: legacyDeviceId, legacy: true };
}

function parseUser(clientId: string, username: string): MqttClientIdentity {
    // Username is canonical: user:<userId>:<accountId>
    const source = username.startsWith('user:') ? username : stripRandomSuffix(clientId);
    const body = source.startsWith('user:') ? source.slice('user:'.length) : '';
    if (!body) return { kind: 'unknown' };
    const segments = body.split(':');
    const userId = segments[0] ?? '';
    const accountId = segments[1] ?? null;
    if (!userId) return { kind: 'unknown' };
    const legacy = !clientId.includes(TIER_SEP);
    return { kind: 'user', userId, accountId, legacy };
}

function parseFactory(clientId: string, username: string): MqttClientIdentity {
    const source = username.startsWith('factory:') ? username : stripRandomSuffix(clientId);
    const body = source.startsWith('factory:') ? source.slice('factory:'.length) : '';
    if (!body) return { kind: 'unknown' };
    const legacy = !clientId.includes(TIER_SEP);
    return { kind: 'factory', bootstrapId: body, legacy };
}

/**
 * Strip a `::<rand>` (new) or `_<rand>` (legacy) suffix from an arbitrary string.
 * Returns the input unchanged if no recognisable suffix is present.
 */
function stripRandomSuffix(value: string): string {
    if (value.includes(TIER_SEP)) {
        const idx = value.lastIndexOf(TIER_SEP);
        return value.slice(0, idx);
    }
    const underscoreIdx = value.lastIndexOf('_');
    if (underscoreIdx > 0 && value.length - underscoreIdx <= 7) {
        return value.slice(0, underscoreIdx);
    }
    return value;
}
