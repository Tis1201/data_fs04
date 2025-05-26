import { z } from 'zod';

export const factoryTokenSchema = z.object({
    tokenId: z.string().optional(),
    serialNumber: z.string().min(1, { message: 'Serial number is required' }),
    hardwareModel: z.string().min(1, { message: 'Hardware model is required' }),
    firmwareVersion: z.string().min(1, { message: 'Firmware version is required' }),
    batchNumber: z.string().optional(),
    expiresAt: z.coerce.date(),
    notes: z.string().optional(),
});

export type FactoryTokenFormData = z.infer<typeof factoryTokenSchema>;
