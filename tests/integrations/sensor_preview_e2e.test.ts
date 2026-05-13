import 'dotenv/config';
import { beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { handleSensorPreviewStart, handleSensorPreviewStop } from '$lib/server/mqtt/handlers/web/handle_sensor_preview';
// Import handleIncoming to test data forwarding
import { handleIncoming } from '$lib/server/mqtt/handlers/index';

// Mocks
const { mockPublish, mockSendNotification } = vi.hoisted(() => {
    return {
        mockPublish: vi.fn(),
        mockSendNotification: vi.fn()
    };
});

vi.mock('$lib/server/mqtt/core/transport', () => ({
    getMqttTransport: () => ({
        publish: mockPublish
    })
}));

vi.mock('$lib/server/mqtt/core/publish', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as any),
        sendNotificationWithTicket: mockSendNotification
    };
});

describe('Sensor Preview Logic Integration', () => {
    let deviceId: string;
    let accountId: string;
    let userId: string;
    let controllerId: string;
    let sensorId: string;
    let userSub: string;
    let sessionId: string;
    let flowId: string;

    const prisma = getAdminPrisma();

    beforeAll(async () => {
        // Setup Test Data in DB
        const existingAccount = await prisma.account.findFirst({
            include: { members: { take: 1 } }
        });
        if (!existingAccount || existingAccount.members.length === 0) {
            throw new Error('No account found');
        }
        accountId = existingAccount.id;
        userId = existingAccount.members[0].userId;
        userSub = `user:${userId}:${accountId}`;

        // Create Device
        const device = await prisma.device.create({
            data: {
                name: `Test Preview Device ${Date.now()}`,
                apiKey: `test-key-${Date.now()}`,
                user: { connect: { id: userId } },
                account: { connect: { id: accountId } },
                status: 'ACTIVE'
            }
        });
        deviceId = device.id;

        // Create Controller
        sensorId = `sensor-${Date.now()}`;
        const controller = await prisma.controller.create({
            data: {
                device: { connect: { id: deviceId } },
                account: { connect: { id: accountId } },
                creator: { connect: { id: userId } },
                type: 'radar',
                name: 'Test Radar',
                serialNumber: `RADAR-${Date.now()}`,
                sensors: {
                    create: [{
                        id: sensorId,
                        name: 'Test Sensor',
                        type: 'radar',
                        status: 'ACTIVE',
                        serialNumber: `SENS-${Date.now()}`,
                        account: { connect: { id: accountId } }
                    }]
                }
            }
        });
        controllerId = controller.id;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should start a preview session', async () => {
        const result = await handleSensorPreviewStart(
            {
                deviceId,
                controllerId,
                sensorId,
                duration: 30
            },
            {
                prisma,
                sub: userSub,
                requestId: 'req-123',
                topic: 'user/...',
                op: 'sensor.preview.start',
                params: {}
            }
        );

        expect(result.result.status).toBe('started');
        expect(result.flowId).toBeDefined();
        expect(result.result.sessionId).toBeDefined();

        sessionId = result.result.sessionId;
        flowId = result.flowId!;

        // Verify notification sent to controller
        // We used sendNotificationWithTicket or manual publish in implementation?
        // Let's check implementation - it tried sendNotificationWithTicket, then catch -> manual publish.
        // If sendNotificationWithTicket was mocked, it should have been called.

        // Wait, the implementation does:
        // try { await sendNotificationWithTicket(...) } catch { manual... }
        // Our mock shouldn't throw, so it should be called.

        expect(mockSendNotification).toHaveBeenCalled();
        const callArgs = mockSendNotification.mock.calls[0][0];
        expect(callArgs.type).toBe('preview.start');
        expect(callArgs.sub).toBe(userSub); // Initiator
        expect(callArgs.params.sessionId).toBe(sessionId);
    });

    it('should forward data frames (legacy session-based)', async () => {
        // LEGACY: In-memory session-based routing (for backwards compatibility)
        const dataTopic = `device:${deviceId}/controller/${controllerId}/data`;
        const payload = JSON.stringify({
            type: 'preview.frame',
            sessionId: sessionId,
            timestamp: Date.now(),
            data: { points: [] }
        });

        await handleIncoming(dataTopic, Buffer.from(payload), prisma);

        // Verify data forwarded to user
        expect(mockSendNotification).toHaveBeenCalled();
        const callArgs = mockSendNotification.mock.calls[0][0];
        expect(callArgs.recipient).toBe(userSub);
        expect(callArgs.type).toBe('preview.data');
        expect(callArgs.flowId).toBe(flowId);
        expect(callArgs.params.sessionId).toBe(sessionId);
    });

    it('should forward data frames (ticket-based stateless)', async () => {
        vi.clearAllMocks();

        // Import createTicket to generate a real ticket for testing
        const { createTicket } = await import('$lib/server/mqtt/core/publish');

        // Create a valid ticket with routing claims (like controller would receive)
        const ticket = await createTicket(
            prisma,
            userSub,
            userSub, // recipient is the user
            'preview.start',
            flowId,
            { sessionId, sensorId },
            '5m'
        );

        // NEW: Ticket-based stateless routing
        const dataTopic = `device:${deviceId}/controller/${controllerId}/data`;
        const payload = JSON.stringify({
            type: 'preview.frame',
            ticket: ticket,
            timestamp: Date.now(),
            data: { points: [{ x: 1, y: 2 }] }
        });

        await handleIncoming(dataTopic, Buffer.from(payload), prisma);

        // Verify data forwarded using ticket-based routing
        expect(mockSendNotification).toHaveBeenCalled();
        const callArgs = mockSendNotification.mock.calls[0][0];
        expect(callArgs.recipient).toBe(userSub);
        expect(callArgs.type).toBe('preview.data');
        expect(callArgs.flowId).toBe(flowId);
    });

    it('should stop a preview session', async () => {
        const result = await handleSensorPreviewStop(
            { sessionId },
            {
                prisma,
                sub: userSub,
                requestId: 'req-456',
                topic: 'user/...',
                op: 'sensor.preview.stop',
                params: {}
            }
        );

        expect(result.result.status).toBe('stopped');

        // Verify notification sent to controller (manual publish usually)
        // Check implementation of stop - it uses createTicket + transport.publish.
        // So mockPublish should be called.
        expect(mockPublish).toHaveBeenCalled();
        const [topic, payload] = mockPublish.mock.calls[0];
        expect(topic).toContain(`/controller/${controllerId}/notifications`);
        // The payload is a JSON string containing a JWT ticket (preview.stop is encoded in claims)
        const parsed = JSON.parse(payload);
        expect(parsed.ticket).toBeDefined();
    });

    it('should not forward data after stop', async () => {
        vi.clearAllMocks();

        const dataTopic = `device:${deviceId}/controller/${controllerId}/data`;
        const payload = JSON.stringify({
            type: 'preview.frame',
            sessionId: sessionId,
            timestamp: Date.now(),
            data: { points: [] }
        });

        await handleIncoming(dataTopic, Buffer.from(payload), prisma);

        expect(mockSendNotification).not.toHaveBeenCalled();
    });
});
