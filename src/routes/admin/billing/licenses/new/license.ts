import { z } from 'zod';

export const licenseSchema = z.object({
    accountId: z.string().min(1, { message: 'Account is required' }),
    deviceId: z.string().min(1, { message: 'Device is required' }),
    // Accept datetime-local input (format: "2025-10-17T12:30")
    expiresAt: z.string({ required_error: 'Expiry date/time is required' })
        .min(1, 'Expiry date/time is required')
        .refine((val) => {
            // Validate it's a valid datetime string
            const date = new Date(val);
            return !isNaN(date.getTime());
        }, { message: 'Invalid date/time format' })
        .refine((val) => {
            // Validate it's in the future
            const date = new Date(val);
            return date > new Date();
        }, { message: 'Expiry date/time must be in the future' }),
    // Optional description field
    description: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v === 'undefined' || v == null ? '' : v)),
});

export type LicenseForm = z.infer<typeof licenseSchema>;
