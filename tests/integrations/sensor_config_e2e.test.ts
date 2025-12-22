import 'dotenv/config';
import { beforeAll, describe, expect, it, vi, beforeEach, afterAll } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { handleSensorConfigSave, handleSensorConfigPush } from '$lib/server/mqtt/handlers/web/handle_sensor_config';

// Mocks
const { mockPublish } = vi.hoisted(() => {
    return {
        mockPublish: vi.fn()
    };
});

vi.mock('$lib/server/mqtt/core/transport', () => ({
    getMqttTransport: () => ({
        publish: mockPublish
    })
}));

describe('Sensor Config Save/Push E2E', () => {
    let deviceId: string;
    let accountId: string;
    let userId: string;
    let controllerId: string;
    let sensorId: string;
    let userSub: string;

    const prisma = getAdminPrisma();

    beforeAll(async () => {
        // Setup Test Data in DB
        const existingAccount = await prisma.account.findFirst({
            include: { members: { take: 1 } }
        });
        if (!existingAccount || existingAccount.members.length === 0) {
            throw new Error('No account found for testing');
        }
        accountId = existingAccount.id;
        userId = existingAccount.members[0].userId;
        userSub = `user:${userId}:${accountId}`;

        // Create Device (online)
        const device = await prisma.device.create({
            data: {
                name: `Test Config Device ${Date.now()}`,
                apiKey: `test-config-key-${Date.now()}`,
                user: { connect: { id: userId } },
                account: { connect: { id: accountId } },
                status: 'ACTIVE',
                connected: true  // Device is online
            }
        });
        deviceId = device.id;

        // Create Controller with Sensor
        const controller = await prisma.controller.create({
            data: {
                device: { connect: { id: deviceId } },
                account: { connect: { id: accountId } },
                creator: { connect: { id: userId } },
                type: 'radar',
                name: 'Test Config Radar',
                serialNumber: `CONFIG-RADAR-${Date.now()}`,
                sensors: {
                    create: [{
                        name: 'Test Config Sensor',
                        type: 'radar',
                        status: 'ACTIVE',
                        serialNumber: `CONFIG-SENS-${Date.now()}`,
                        account: { connect: { id: accountId } },
                        config: { mode: 'initial' },
                        configVersion: 0,
                        syncStatus: 'SYNCED'
                    }]
                }
            },
            include: { sensors: true }
        });
        controllerId = controller.id;
        sensorId = controller.sensors[0].id;
    });

    afterAll(async () => {
        // Cleanup test data
        try {
            await prisma.controller.deleteMany({ where: { id: controllerId } });
            await prisma.device.deleteMany({ where: { id: deviceId } });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('sensor.config.save', () => {
        it('should save config to database and mark as PENDING', async () => {
            const newConfig = {
                mode: 'tracking',
                sensitivity: 0.8,
                range: { min: 0.3, max: 10.0 }
            };

            const result = await handleSensorConfigSave(
                { sensorId, config: newConfig },
                {
                    prisma,
                    sub: userSub,
                    requestId: 'save-req-1',
                    op: 'sensor.config.save',
                    params: {},
                    topic: 'user/test/requests'
                }
            );

            // Verify response
            expect(result.result.saved).toBe(true);
            expect(result.result.configVersion).toBe(1);
            expect(result.result.syncStatus).toBe('PENDING');

            // Verify DB was updated
            const sensor = await prisma.sensor.findUnique({ where: { id: sensorId } });
            expect(sensor?.configVersion).toBe(1);
            expect(sensor?.syncStatus).toBe('PENDING');
            expect(sensor?.config).toEqual(newConfig);
        });

        it('should increment version on each save', async () => {
            const config2 = { mode: 'counting', zones: [] };

            const result = await handleSensorConfigSave(
                { sensorId, config: config2 },
                {
                    prisma,
                    sub: userSub,
                    requestId: 'save-req-2',
                    op: 'sensor.config.save',
                    params: {},
                    topic: 'user/test/requests'
                }
            );

            expect(result.result.configVersion).toBe(2);
        });

        it('should fail for unknown sensor', async () => {
            await expect(
                handleSensorConfigSave(
                    { sensorId: 'unknown-sensor', config: {} },
                    {
                        prisma,
                        sub: userSub,
                        requestId: 'save-req-3',
                        op: 'sensor.config.save',
                        params: {},
                        topic: 'user/test/requests'
                    }
                )
            ).rejects.toThrow('Sensor not found');
        });
    });

    describe('sensor.config.push', () => {
        it('should push config to online device and mark as SYNCED', async () => {
            const result = await handleSensorConfigPush(
                { sensorId },
                {
                    prisma,
                    sub: userSub,
                    requestId: 'push-req-1',
                    op: 'sensor.config.push',
                    params: {},
                    topic: 'user/test/requests'
                }
            );

            // Verify response
            expect(result.result.synced).toBe(true);
            expect(result.result.syncStatus).toBe('SYNCED');
            expect(result.result.appliedAt).toBeDefined();

            // Verify MQTT publish was called
            expect(mockPublish).toHaveBeenCalledTimes(1);
            const [topic, payload] = mockPublish.mock.calls[0];
            expect(topic).toContain(`device:${deviceId}/controller/radar:${controllerId}/notifications`);

            // Payload should contain a ticket
            const parsed = JSON.parse(payload);
            expect(parsed.ticket).toBeDefined();

            // Verify DB was updated
            const sensor = await prisma.sensor.findUnique({ where: { id: sensorId } });
            expect(sensor?.syncStatus).toBe('SYNCED');
            expect(sensor?.lastSyncedAt).toBeDefined();
        });

        it('should fail with DEVICE_OFFLINE when device is offline', async () => {
            // Set device offline
            await prisma.device.update({
                where: { id: deviceId },
                data: { connected: false }
            });

            const result = await handleSensorConfigPush(
                { sensorId },
                {
                    prisma,
                    sub: userSub,
                    requestId: 'push-req-2',
                    op: 'sensor.config.push',
                    params: {},
                    topic: 'user/test/requests'
                }
            );

            // Verify response
            expect(result.result.synced).toBe(false);
            expect(result.result.syncStatus).toBe('FAILED');
            expect(result.result.error).toBe('Device is offline');

            // Verify DB was updated with failure
            const sensor = await prisma.sensor.findUnique({ where: { id: sensorId } });
            expect(sensor?.syncStatus).toBe('FAILED');
            expect(sensor?.lastSyncError).toBe('Device is offline');

            // MQTT should NOT have been called
            expect(mockPublish).not.toHaveBeenCalled();

            // Restore device online for other tests
            await prisma.device.update({
                where: { id: deviceId },
                data: { connected: true }
            });
        });
    });
});
