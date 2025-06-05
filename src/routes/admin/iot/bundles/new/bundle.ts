import { z } from 'zod';

export const bundleSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    os: z.string().default('ANDROID'),
    reboot: z.boolean().default(false),
    version: z.string().default('1.0.0'),
    waveSize: z.coerce.number().int().min(1, 'Wave size must be at least 1').default(500),
    scheduledAt: z.string().optional().nullable(),
    scheduledTime: z.string().optional().nullable(),
    scheduledAtTimezone: z.string().default('UTC').optional().nullable(),
    scheduledAtStartIfMissed: z.boolean().default(false),
    accountId: z.string().optional()
});

export type BundleFormData = z.infer<typeof bundleSchema>;
