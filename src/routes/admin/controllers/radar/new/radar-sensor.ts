import { z } from 'zod';
import { DESCRIPTION_MAX } from '$lib/constants/description';

/** PIN format: 6 characters (matches FactoryDevice.registrationPin from get.pin). Normalize: trim, uppercase. */
const pinSchema = z.string()
    .min(1, { message: 'Device registration code (PIN) is required' })
    .max(20, { message: 'PIN is too long' })
    .transform((s) => s.trim().toUpperCase().replace(/\s/g, ''));

export const radarSensorSchema = z.object({
    /** Device registration code (6-digit PIN from device). Claim is independent from Devices module. */
    pin: pinSchema.optional(),
    name: z.string()
        .min(1, { message: 'Sensor name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    serialNumber: z.string()
        .min(1, { message: 'Serial number is required' })
        .max(100, { message: 'Serial number must be 100 characters or less' }),
    description: z.string()
        .max(DESCRIPTION_MAX, { message: `Description must be ${DESCRIPTION_MAX} characters or less` })
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
    /** Legacy: only used when pin is not provided (e.g. admin or fallback). */
    deviceId: z.string()
        .optional()
        .nullable()
}).refine((data) => data.pin || data.deviceId, {
    message: 'Either device registration code (PIN) or device is required',
    path: ['pin']
});
