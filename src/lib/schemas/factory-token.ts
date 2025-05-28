import { z } from 'zod';

export const factoryTokenSchema = z.object({
    name: z.string().optional(),
    hardwareModel: z.string().min(1, { message: 'Hardware model is required' }),
    firmwareVersion: z.string().min(1, { message: 'Firmware version is required' }),
    batchNumber: z.string().optional(),
    expiresAt: z.coerce.date(),
    notes: z.string().optional(),
    factory_signing_key_id: z.string().min(1, { message: 'Signing key is required' }),
});

export type FactoryTokenFormData = z.infer<typeof factoryTokenSchema>;
