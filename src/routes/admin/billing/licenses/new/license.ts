import { z } from 'zod';

export const licenseSchema = z.object({
    accountId: z.string().min(1, { message: 'Account is required' }),
    deviceId: z.string().min(1, { message: 'Device is required' }),
    // Accept date input and handle it properly
    expiresAt: z.preprocess(
        // Convert any input to string first to handle both Date objects and strings
        (val) => val instanceof Date ? val.toISOString() : String(val),
        z.string({ required_error: 'Expiry date/time is required' })
            .min(1, 'Expiry date/time is required')
    ),
    // Optional description field
    description: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v === 'undefined' || v == null ? '' : v)),
});

export type LicenseForm = z.infer<typeof licenseSchema>;
