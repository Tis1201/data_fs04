import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { pinSharedStore } from '$lib/server/device/deviceSharedStore';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';

describe('Device Preclaim Flow', () => {
    const prisma = getEnhancedPrisma({ id: 'test', systemRole: 'ADMIN' });
    
    beforeEach(async () => {
        vi.resetAllMocks();
        await pinSharedStore.clear();
    });
    
    afterEach(async () => {
        await prisma.device.deleteMany();
        await prisma.preclaim.deleteMany();
    });
    
    it('should successfully claim device with valid preclaim', async () => {
        // Setup preclaim
        const preclaim = await prisma.preclaim.create({
            data: {
                id: 'preclaim-123',
                macAddress: '00:11:22:33:44:55',
                claimedBy: 'user-123',
                accountId: 'account-123',
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
            userId: preclaim.claimedBy,
            accountId: preclaim.accountId,
            preclaimId: preclaim.id
        });
        
        // Verify
        expect(device).toBeDefined();
        expect(device.id).toBe(deviceMeta.id);
        expect(device.preclaimId).toBe(preclaim.id);
        expect(device.claimedBy).toBe(preclaim.claimedBy);
        expect(device.accountId).toBe(preclaim.accountId);
        
        // Verify preclaim was used
        const updatedPreclaim = await prisma.preclaim.findUnique({
            where: { id: preclaim.id }
        });
        expect(updatedPreclaim?.claimedAt).toBeDefined();
        expect(updatedPreclaim?.deviceId).toBe(deviceMeta.id);
    });
    
    it('should fail with expired preclaim', async () => {
        // Setup expired preclaim
        const preclaim = await prisma.preclaim.create({
            data: {
                id: 'preclaim-expired',
                macAddress: '00:11:22:33:44:55',
                claimedBy: 'user-123',
                accountId: 'account-123',
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
                userId: preclaim.claimedBy,
                accountId: preclaim.accountId,
                preclaimId: preclaim.id
            })
        ).rejects.toThrow('Preclaim expired');
    });
});
