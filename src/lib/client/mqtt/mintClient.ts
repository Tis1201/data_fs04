/**
 * Browser-side MQTT credential mint: fetch JWT from /api/user/mqtt/mint and parse response.
 */

const MINT_ENDPOINT = '/api/user/mqtt/mint';

export function resolveBrokerUrl(explicitUrl?: string, mintedUrl?: string | null): string | null {
    if (explicitUrl) return explicitUrl;
    if (mintedUrl) return mintedUrl ?? null;
    return null;
}

export interface MintResult {
    token: string;
    brokerUrl: string | null;
    username: string | null;
    clientId: string | null;
}

export async function mintConnectionJwt(): Promise<MintResult> {
    const response = await fetch(MINT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to mint MQTT credential: ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? payload;
    const token = data?.jwt ?? payload?.jwt;
    const brokerUrl = data?.brokerUrl ?? payload?.brokerUrl ?? null;
    let clientId: string | null = data?.clientId ?? payload?.clientId ?? null;

    if (!token) {
        throw new Error('Minted MQTT credential response missing jwt');
    }

    let derivedUsername: string | null = data?.username ?? payload?.username ?? null;

    console.log('[MQTT] Minted JWT credential');
    if (brokerUrl) {
        console.log('[MQTT] Minted broker URL:', brokerUrl);
    }
    if (derivedUsername) {
        console.log('[MQTT] Minted username from response:', derivedUsername);
    }
    if (clientId) {
        console.log('[MQTT] Minted clientId from response:', clientId);
    }

    if (!derivedUsername || !clientId) {
        try {
            const [, payloadSegment] = token.split('.');
            if (payloadSegment) {
                const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
                const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
                const decodedPayload = JSON.parse(atob(padded));
                console.debug('[MQTT] JWT payload:', decodedPayload);
                if (!derivedUsername) {
                    derivedUsername =
                        decodedPayload?.email ??
                        decodedPayload?.name ??
                        decodedPayload?.username ??
                        decodedPayload?.userId ??
                        null;
                }
                if (!clientId) {
                    clientId = decodedPayload?.client_id ?? decodedPayload?.clientId ?? null;
                }
            } else {
                console.warn('[MQTT] Unable to decode JWT payload: missing segment');
            }
        } catch (err) {
            console.warn('[MQTT] Failed to decode JWT payload', err);
        }
    }

    return { token: token as string, brokerUrl, username: derivedUsername, clientId };
}
