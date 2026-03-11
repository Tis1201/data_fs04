/**
 * Cloudflare TURN Credential Service
 * 
 * Generates short-lived TURN credentials using the Cloudflare TURN API.
 * This replaces hardcoded Xirsys credentials with dynamically generated
 * short-lived tokens for improved security.
 * 
 * @see https://developers.cloudflare.com/calls/turn/
 */

// import { env } from '$env/dynamic/private';

export interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

export interface TurnCredentials {
    iceServers: IceServer[];
    expiresAt: number;
}

export interface CloudflareIceServersResponse {
    iceServers: {
        urls: string[];
        username: string;
        credential: string;
    };
}

/**
 * Reorder ICE server URLs so that Cloudflare TURN on port 443 comes first.
 * Port 443 (TURNS over TLS) works better through corporate firewalls and is
 * tried first by the device when establishing WebRTC connections.
 */
function reorderUrlsForPort443First(urls: string | string[]): string | string[] {
    const arr = Array.isArray(urls) ? [...urls] : [urls];
    if (arr.length <= 1) return urls;

    const with443 = arr.filter((u) => /:443($|\?)/.test(u));
    const without443 = arr.filter((u) => !/:443($|\?)/.test(u));
    const reordered = [...with443, ...without443];

    return Array.isArray(urls) ? reordered : (reordered[0] ?? urls);
}

export class TurnCredentialService {
    private readonly apiUrl: string;
    private readonly apiToken: string;
    private readonly ttl: number;
    private readonly isConfigured: boolean;

    constructor() {
        // Use process.env directly to avoid issues with dynamic imports and $env resolution
        const keyId = process.env.CLOUDFLARE_TURN_SERVER_APP_TOKEN_ID;
        this.apiToken = process.env.CLOUDFLARE_TURN_SERVER_APP_API_TOKEN || '';
        this.ttl = parseInt(process.env.TURN_CREDENTIAL_TTL || '86400', 10);

        this.isConfigured = !!(keyId && this.apiToken);

        if (this.isConfigured) {
            this.apiUrl = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;
        } else {
            this.apiUrl = '';
            console.warn('[TurnCredentialService] Cloudflare TURN not configured. Missing CLOUDFLARE_TURN_SERVER_APP_TOKEN_ID or CLOUDFLARE_TURN_SERVER_APP_API_TOKEN');
        }
    }

    /**
     * Check if the service is properly configured
     */
    isEnabled(): boolean {
        return this.isConfigured;
    }

    /**
     * Generate short-lived TURN credentials from Cloudflare
     */
    async generateCredentials(): Promise<TurnCredentials> {
        if (!this.isConfigured) {
            console.warn('[TurnCredentialService] TURN not configured, returning STUN-only config');
            return this.getStunOnlyConfig();
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ttl: this.ttl })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[TurnCredentialService] Cloudflare API error: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`Failed to generate TURN credentials: ${response.statusText}`);
            }

            const data = await response.json();

            console.log('[TurnCredentialService] Generated TURN credentials successfully');

            // Handle Cloudflare response which usually returns iceServers as an array
            // Cloudflare response already includes both STUN and TURN servers
            const turnServers = Array.isArray(data.iceServers)
                ? data.iceServers
                : [data.iceServers];

            // Reorder TURN URLs so port 443 (TURNS) comes first - works better through firewalls
            const reorderedServers = turnServers.map((server: { urls?: string | string[]; username?: string; credential?: string }) => {
                const urls = server.urls;
                if (!urls) return server;
                return { ...server, urls: reorderUrlsForPort443First(urls) };
            });

            return {
                iceServers: reorderedServers, // Use only Cloudflare servers (includes STUN + TURN)
                expiresAt: Date.now() + (this.ttl * 1000)
            };
        } catch (error) {
            console.error('[TurnCredentialService] Error generating credentials:', error);
            // Fallback to STUN-only config
            return this.getStunOnlyConfig();
        }
    }

    /**
     * Returns a STUN-only configuration as fallback
     */
    private getStunOnlyConfig(): TurnCredentials {
        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            expiresAt: Date.now() + (3600 * 1000) // 1 hour
        };
    }
}

// Singleton instance
let turnCredentialServiceInstance: TurnCredentialService | null = null;

export function getTurnCredentialService(): TurnCredentialService {
    if (!turnCredentialServiceInstance) {
        turnCredentialServiceInstance = new TurnCredentialService();
    }
    return turnCredentialServiceInstance;
}
