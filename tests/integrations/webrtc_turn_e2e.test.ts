import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * End-to-end test for WebRTC TURN credential generation via MQTT.
 *
 * Flow:
 * 1. Login as SAMPLE_ADMIN and mint user MQTT credentials.
 * 2. Find a valid device and mint device MQTT credentials.
 * 3. Connect User and Device clients.
 * 4. User sends `webrtc.connect` RPC.
 * 5. Verify User receives response with TURN credentials.
 * 6. Verify Device receives notification with TURN credentials.
 */

describe('WebRTC TURN via MQTT E2E', () => {
    const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
    const LOGIN_URL = `${WEB_BASE_URL}/auth/login?/login`;
    const USER_MINT_URL = `${WEB_BASE_URL}/api/user/mqtt/mint`;
    const DEVICE_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint`;

    const MQTT_DEFAULT_WS_PATH = '/mqtt';

    // User Credentials
    let userBrokerUrl: string;
    let userJwt: string;
    let userClientId: string;
    let userSub: string;

    // Device Credentials
    let deviceBrokerUrl: string;
    let deviceJwt: string;
    let deviceClientId: string;
    let deviceSub: string;
    let deviceId: string;

    let userClient: MqttClient | null = null;
    let deviceClient: MqttClient | null = null;

    // Promisified helper maps
    const userPendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();
    const devicePendingNotifications = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();

    function buildConnectUrl(rawUrl: string): string {
        const url = new URL(rawUrl);
        if (!url.pathname || url.pathname === '/') {
            url.pathname = MQTT_DEFAULT_WS_PATH;
        }
        return url.toString();
    }

    async function loginAndGetCookie(): Promise<string> {
        const USERNAME = process.env.SAMPLE_ADMIN_USERNAME ?? 'admin@admin.com';
        const PASSWORD = process.env.SAMPLE_ADMIN_PASSWORD ?? 'admin0823';

        const res = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ email: USERNAME, password: PASSWORD })
        });

        const setCookie = res.headers.get('set-cookie');
        if (!setCookie) throw new Error('Login failed: No cookie returned');
        const match = setCookie.match(/auth_session=([^;]+)/);
        if (!match) throw new Error('Login failed: No auth_session');
        return `auth_session=${match[1]}`;
    }

    async function mintUserMqtt(cookie: string) {
        const res = await fetch(USER_MINT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({})
        });
        const payload: any = await res.json();
        if (!payload.success) throw new Error(`User mint failed: ${JSON.stringify(payload)}`);
        return payload.data;
    }

    async function findDeviceForUser(userId: string) {
        const prisma = getAdminPrisma();

        // Pick ANY device with an API key
        let device = await prisma.device.findFirst({
            where: { apiKey: { not: null } },
            orderBy: { createdAt: 'desc' }
        });

        if (!device) {
            // Fallback: Create one if absolutely none exist
            console.log('[E2E] No devices found. Creating test device.');
            device = await prisma.device.create({
                data: {
                    name: 'E2E Test Device',
                    createdBy: userId,
                    apiKey: 'test-api-key-' + randomUUID(),
                    status: 'ACTIVE',
                    deviceType: 'mock',
                    osVersion: 'test',
                    model: 'E2E-Mock',
                    manufacturer: 'Vitest',
                    hardwareId: 'mock-hw-' + randomUUID()
                }
            });
        } else {
            // Hijack the device to ensure ownership (so isOwner check passes)
            console.log(`[E2E] Hijacking device ${device.id} for test (setting createdBy=${userId})`);
            device = await prisma.device.update({
                where: { id: device.id },
                data: { createdBy: userId }
            });
        }

        if (!device?.apiKey) throw new Error('No device with apiKey found.');
        return { id: device.id, apiKey: device.apiKey };
    }

    async function mintDeviceMqtt(apiKey: string) {
        const res = await fetch(DEVICE_MINT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify({})
        });
        const payload: any = await res.json();
        if (!payload.success) throw new Error(`Device mint failed: ${JSON.stringify(payload)}`);
        return payload.data;
    }

    function connectClient(
        brokerUrl: string,
        clientId: string,
        username: string,
        jwt: string,
        subs: string[],
        handler: (topic: string, message: Buffer) => void
    ): Promise<MqttClient> {
        return new Promise((resolve, reject) => {
            const client = mqtt.connect(buildConnectUrl(brokerUrl), {
                protocolVersion: 5, clean: true, clientId, username, password: jwt, reconnectPeriod: 0
            });

            const timeout = setTimeout(() => { client.end(); reject(new Error(`Timeout connecting ${username}`)); }, 15000);

            client.on('connect', () => {
                client.subscribe(subs, { qos: 1 }, (err) => {
                    if (err) { clearTimeout(timeout); client.end(); reject(err); return; }
                    clearTimeout(timeout);
                    resolve(client);
                });
            });

            client.on('message', handler);
            client.on('error', (err) => { clearTimeout(timeout); client.end(); reject(err); });
        });
    }

    beforeAll(async () => {
        // 1. Setup Identities
        const cookie = await loginAndGetCookie();
        const userMint = await mintUserMqtt(cookie);
        userBrokerUrl = userMint.brokerUrl;
        userJwt = userMint.jwt;
        userClientId = userMint.clientId;
        userSub = userMint.username;

        // 2. Setup Device
        const [, userId] = userSub.split(':');
        const deviceRecord = await findDeviceForUser(userId);
        deviceId = deviceRecord.id;
        const deviceMint = await mintDeviceMqtt(deviceRecord.apiKey);
        deviceBrokerUrl = deviceMint.brokerUrl;
        deviceJwt = deviceMint.jwt;
        deviceClientId = deviceMint.clientId;
        deviceSub = deviceMint.mqttUsername ?? deviceMint.username;
    }, 30000);

    afterAll(async () => {
        if (userClient) await new Promise<void>(r => userClient!.end(true, () => r()));
        if (deviceClient) await new Promise<void>(r => deviceClient!.end(true, () => r()));
    });

    it('delivers TURN credentials to both Web Client and Device', async () => {
        // Connect User
        userClient = await connectClient(
            userBrokerUrl, userClientId, userSub, userJwt,
            [`user/${userSub}/response`],
            (topic, msg) => {
                const data = JSON.parse(msg.toString());
                if (data.requestId && userPendingRequests.has(data.requestId)) {
                    const p = userPendingRequests.get(data.requestId)!;
                    clearTimeout(p.timeout);
                    userPendingRequests.delete(data.requestId);
                    if (data.error) p.reject(new Error(JSON.stringify(data.error)));
                    else p.resolve(data.result);
                }
            }
        );

        // Connect Device
        deviceClient = await connectClient(
            deviceBrokerUrl, deviceClientId, deviceSub, deviceJwt,
            [`device/${deviceSub}/notifications`],
            (topic, msg) => {
                const data = JSON.parse(msg.toString());
                if (data.ticket) {
                    const claims = jwt.decode(data.ticket) as any;
                    if (claims && devicePendingNotifications.has(claims.type)) {
                        const p = devicePendingNotifications.get(claims.type)!;
                        clearTimeout(p.timeout);
                        devicePendingNotifications.delete(claims.type);
                        p.resolve(claims);
                    }
                }
            }
        );

        console.log('[E2E] Clients connected. Sending webrtc.connect...');

        // Prepare Device Promise (Wait for notification)
        const deviceNotificationPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                devicePendingNotifications.delete('device:webrtc');
                reject(new Error('Device notification timeout'));
            }, 15000);
            devicePendingNotifications.set('device:webrtc', { resolve, reject, timeout });
        });

        // Prepare User Request
        const requestId = randomUUID();
        const userRequestPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                userPendingRequests.delete(requestId);
                reject(new Error('User RPC timeout'));
            }, 15000);
            userPendingRequests.set(requestId, { resolve, reject, timeout });
        });

        // Send Request
        userClient.publish(`user/${userSub}/requests`, JSON.stringify({
            requestId, op: 'webrtc.connect', params: { deviceId }
        }), { qos: 1 });

        // Wait for both
        const [userResult, deviceResult] = await Promise.all([userRequestPromise, deviceNotificationPromise]);

        console.log('[E2E] Received both responses');

        // Verification Helper
        const verifyCredentials = (creds: any, source: string) => {
            console.log(`[E2E] Verifying credentials for ${source}:`, JSON.stringify(creds, null, 2));
            expect(creds).toBeDefined();
            expect(creds.iceServers).toBeDefined();
            expect(creds.iceServers.length).toBeGreaterThan(0);

            const hasGoogle = creds.iceServers.some((s: any) =>
                s.urls && (Array.isArray(s.urls)
                    ? s.urls.some((u: string) => u.includes('google'))
                    : s.urls.includes('google')));

            const hasTurn = creds.iceServers.some((s: any) =>
                s.urls && (Array.isArray(s.urls)
                    ? s.urls.some((u: string) => u.includes('turn'))
                    : s.urls.includes('turn')));

            console.log(`[E2E] ${source} hasGoogle=${hasGoogle}, hasTurn=${hasTurn}`);
            expect(hasGoogle).toBe(true);
            expect(hasTurn).toBe(true); // Strictly require TURN credentials
        };

        // Verify User Response
        const uRes = userResult as any;

        // The RPC response is wrapped in a 'result' object by the handler
        const resultData = uRes.result;

        expect(resultData).toBeDefined();
        expect(resultData.deviceId).toBe(deviceId);
        verifyCredentials(resultData.turnCredentials, 'User Client');

        // Verify Device Notification
        const dRes = deviceResult as any;
        expect(dRes.params.action).toBe('webrtc:connect');
        verifyCredentials(dRes.params.turnCredentials, 'Device Client');

    }, 60000);
});
