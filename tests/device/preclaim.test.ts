import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';

describe('Device Preclaim Flow', () => {
    const prisma = getEnhancedPrisma({ id: 'test', systemRole: 'ADMIN' });
    let testAccountId: string;
    let testSetId: string;
    
    beforeEach(async () => {
        vi.resetAllMocks();
        
        // Create a test account
        const account = await prisma.account.create({
            data: {
                name: 'Test Account',
                slug: `test-account-${Date.now()}`
            }
        });
        testAccountId = account.id;
        
        // Create a preclaim set
        const set = await prisma.preclaimSet.create({
            data: {
                name: 'Test Set',
                accountId: testAccountId,
                createdBy: 'test-user'
            }
        });
        testSetId = set.id;
    });
    
    afterEach(async () => {
        await prisma.device.deleteMany();
        await prisma.preclaimDevice.deleteMany();
        await prisma.preclaimSet.deleteMany();
        await prisma.account.deleteMany();
    });
    
    it('should successfully claim device with valid preclaim', async () => {
        // Setup preclaim device
        const preclaimDevice = await prisma.preclaimDevice.create({
            data: {
                id: 'preclaim-123',
                macId: '00:11:22:33:44:55',
                accountId: testAccountId,
                setId: testSetId,
                status: 'PENDING',
                claimedBy: 'user-123',
                expiresAt: new Date(Date.now() + 3600 * 1000)
            }
        });
        
        // Register device with matching MAC
        const pin = '123456';
        const deviceMeta = {
            id: 'device-123',
            connectionId: 'conn-123',
            metadata: { macAddress: '00:11:22:33:44:55' }
        };
        await DeviceManager.registerDevice(pin, deviceMeta);
        
        // Mock publisher
        vi.spyOn(publisher, 'publish').mockImplementation(() => Promise.resolve());
        
        // Claim device (simulating preclaim flow)
        const device = await DeviceManager.claimDevice(pin, {
            userId: preclaimDevice.claimedBy!,
            accountId: preclaimDevice.accountId,
            preclaimId: preclaimDevice.id
        });
        
        // Verify
        expect(device).toBeDefined();
        expect(device.id).toBe(deviceMeta.id);
        expect(device.claimedBy).toBe(preclaimDevice.claimedBy);
        expect(device.accountId).toBe(preclaimDevice.accountId);
        
        // Verify preclaim was used
        const updatedPreclaim = await prisma.preclaimDevice.findUnique({
            where: { id: preclaimDevice.id }
        });
        expect(updatedPreclaim?.claimedAt).toBeDefined();
        expect(updatedPreclaim?.deviceId).toBe(deviceMeta.id);
    });
    
    it('should fail with expired preclaim', async () => {
        // Setup expired preclaim device
        const preclaimDevice = await prisma.preclaimDevice.create({
            data: {
                id: 'preclaim-expired',
                macId: '00:11:22:33:44:55',
                accountId: testAccountId,
                setId: testSetId,
                status: 'PENDING',
                claimedBy: 'user-123',
                expiresAt: new Date(Date.now() - 3600 * 1000) // expired
            }
        });
        
        // Register device
        const pin = '123456';
        const deviceMeta = {
            id: 'device-123',
            connectionId: 'conn-123',
            metadata: { macAddress: '00:11:22:33:44:55' }
        };
        await DeviceManager.registerDevice(pin, deviceMeta);
        
        // Attempt claim
        await expect(
            DeviceManager.claimDevice(pin, {
                userId: preclaimDevice.claimedBy!,
                accountId: preclaimDevice.accountId,
                preclaimId: preclaimDevice.id
            })
        ).rejects.toThrow('Preclaim expired');
    });
});
