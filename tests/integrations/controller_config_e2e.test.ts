import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { randomBytes } from 'crypto';

/**
 * End-to-end test for the controller configuration endpoint.
 *
 * Endpoint: GET /api/device/controller
 *
 * Scenarios:
 * 1. Auto-create new controller when none exists
 * 2. Retrieve existing controller
 * 3. Verify response structure (controller, sensors, config)
 * 4. Error handling (missing type, invalid type)
 * 5. Verify multiple types (radar, etc.)
 */

describe('Controller Config E2E', () => {
    const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
    const CONTROLLER_CONFIG_URL = `${WEB_BASE_URL}/api/device/controller`;

    let deviceId: string;
    let accountId: string;
    let userId: string;
    let testApiKey: string;

    beforeAll(async () => {
        const prisma = getAdminPrisma();

        // Find an existing account and user to use for the test
        const existingAccount = await prisma.account.findFirst({
            include: {
                members: {
                    take: 1
                }
            }
        });

        if (!existingAccount || existingAccount.members.length === 0) {
            throw new Error('No account with members found. Create an account before running this test.');
        }

        accountId = existingAccount.id;
        userId = existingAccount.members[0].userId;

        // Create a test device with a unique apiKey
        testApiKey = `test-config-e2e-${randomBytes(8).toString('hex')}`;
        const testDevice = await prisma.device.create({
            data: {
                name: `Test Device for Config E2E ${Date.now()}`,
                apiKey: testApiKey,
                user: {
                    connect: { id: userId }
                },
                account: {
                    connect: { id: accountId }
                },
                status: 'ACTIVE'
            }
        });

        deviceId = testDevice.id;
    });

    afterAll(async () => {
        const prisma = getAdminPrisma();
        // Cleanup test data
        if (deviceId) {
            await prisma.controller.deleteMany({
                where: { deviceId }
            });
            await prisma.device.delete({
                where: { id: deviceId }
            });
        }
    });

    it('returns error when type parameter is missing', async () => {
        const res = await fetch(CONTROLLER_CONFIG_URL, {
            method: 'GET',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json'
            }
        });

        expect(res.status).toBe(400);
        const payload: any = await res.json();
        expect(payload.success).toBe(false);
        expect(payload.error.message).toContain('Missing required query parameter: type');
    });

    it('returns error for invalid controller type', async () => {
        const res = await fetch(`${CONTROLLER_CONFIG_URL}?type=invalid_type`, {
            method: 'GET',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json'
            }
        });

        expect(res.status).toBe(400);
        const payload: any = await res.json();
        expect(payload.success).toBe(false);
        expect(payload.error.message).toContain('Invalid controller type');
    });

    it('auto-creates a radar controller when querying for the first time', async () => {
        const res = await fetch(`${CONTROLLER_CONFIG_URL}?type=radar`, {
            method: 'GET',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json'
            }
        });

        expect(res.status).toBe(200);
        const payload: any = await res.json();
        expect(payload.success).toBe(true);
        const data = payload.data;

        // Check Controller Info
        expect(data.controller).toBeDefined();
        expect(data.controller.id).toBeDefined();
        expect(data.controller.type).toBe('radar');
        expect(data.controller.name).toContain('Auto-created Radar Controller');
        expect(data.controller.status).toBe('ACTIVE');
        expect(data.controller.serialNumber).toBeDefined();

        // Check Sensors (should be empty array initially if no sensors created implicitly yet, 
        // or dependent on implementation details if sensors are auto-created too)
        expect(Array.isArray(data.sensors)).toBe(true);

        // Check Config
        expect(data.config).toBeDefined();
        expect(data.config.sensitivity).toBeDefined(); // Assuming default config from our implementation
    });

    it('retrieves the SAME controller on subsequent requests (idempotency)', async () => {
        // First request to ensure it exists
        const res1 = await fetch(`${CONTROLLER_CONFIG_URL}?type=radar`, {
            headers: { 'X-API-Key': testApiKey }
        });
        const payload1: any = await res1.json();
        const firstControllerId = payload1.data.controller.id;

        // Second request
        const res2 = await fetch(`${CONTROLLER_CONFIG_URL}?type=radar`, {
            headers: { 'X-API-Key': testApiKey }
        });
        expect(res2.status).toBe(200);
        const payload2: any = await res2.json();
        const secondControllerId = payload2.data.controller.id;

        expect(firstControllerId).toBe(secondControllerId);
    });

    it('can retrieve/create a different controller type (e.g., camera) for the same device', async () => {
        const res = await fetch(`${CONTROLLER_CONFIG_URL}?type=camera`, {
            method: 'GET',
            headers: { 'X-API-Key': testApiKey }
        });

        expect(res.status).toBe(200);
        const payload: any = await res.json();
        expect(payload.success).toBe(true);
        expect(payload.data.controller.type).toBe('camera');

        // Should be different from radar controller
        const radarRes = await fetch(`${CONTROLLER_CONFIG_URL}?type=radar`, {
            headers: { 'X-API-Key': testApiKey }
        });
        const radarData: any = await radarRes.json();

        expect(payload.data.controller.id).not.toBe(radarData.data.controller.id);
    });
});
