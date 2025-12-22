import { z } from 'zod';

export const radarSensorSchema = z.object({
    name: z.string()
        .min(1, { message: 'Sensor name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    serialNumber: z.string()
        .min(1, { message: 'Serial number is required' })
        .max(100, { message: 'Serial number must be 100 characters or less' }),
    description: z.string()
        .max(500, { message: 'Description must be 500 characters or less' })
        .optional()
        .nullable(),
    location: z.string()
        .max(200, { message: 'Location must be 200 characters or less' })
        .optional()
        .nullable(),
    firmware: z.string()
        .max(50, { message: 'Firmware version must be 50 characters or less' })
        .optional()
        .nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])
        .default('INACTIVE'),
    accountId: z.string()
        .min(1, { message: 'Account is required' }),
    deviceId: z.string()
        .optional()
        .nullable()
});
