import { z } from 'zod';

export const licenseSchema = z.object({
    accountId: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v === 'undefined' || v == null ? '' : v)),
    deviceId: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v === 'undefined' || v == null ? '' : v)),
    // Accept string from <input type="datetime-local">, require non-empty, then coerce to Date
    expiresAt: z
        .string({ required_error: 'Expiry date/time is required' })
        .min(1, 'Expiry date/time is required')
        .pipe(z.coerce.date()),
    keyId: z.string().min(1, 'Key ID is required'),
    algorithm: z.enum(['RS256', 'HS256'], { required_error: 'Algorithm is required' }),
    jwt: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v === 'undefined' || v == null || v === '' ? null : v))
});

export type LicenseForm = z.infer<typeof licenseSchema>;
