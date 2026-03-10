import { z } from 'zod';
import { DESCRIPTION_MAX_SHORT } from '$lib/constants/description';

const MAX_CHARS = DESCRIPTION_MAX_SHORT;

export const bundleSchema = z.object({
    name: z.string().min(1, 'Name is required').max(MAX_CHARS, `Name must be ${MAX_CHARS} characters or less`),
    description: z.string().max(MAX_CHARS, `Description must be ${MAX_CHARS} characters or less`).optional(),
    os: z.string().default('ANDROID'),
    reboot: z.boolean().default(false),
    autoOpen: z.boolean().default(false),
    forceUpdate: z.boolean().default(false),
    version: z.string().default('1.0.0'),
    waveSize: z.coerce.number().int().min(1, 'Wave size must be at least 1').default(500),
    scheduledAt: z.string().optional().nullable(),
    scheduledTime: z.string().optional().nullable(),
    scheduledAtTimezone: z.string().default('UTC').optional().nullable(),
    scheduledAtStartIfMissed: z.boolean().default(false),
    activePeriodDays: z.coerce.number().int().min(1, 'Active period must be at least 1 day').max(30, 'Active period cannot exceed 30 days').default(1),
    accountId: z.string().optional()
});

export type BundleFormData = z.infer<typeof bundleSchema>;
