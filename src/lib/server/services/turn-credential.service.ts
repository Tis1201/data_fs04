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

            return {
                iceServers: turnServers, // Use only Cloudflare servers (includes STUN + TURN)
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
