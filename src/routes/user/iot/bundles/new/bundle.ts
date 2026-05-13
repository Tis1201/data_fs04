import { z } from 'zod';
import { DESCRIPTION_MAX, NAME_MAX } from '$lib/constants/description';

export const bundleSchema = z.object({
    name: z.string().min(1, 'Name is required').max(NAME_MAX, `Name must be ${NAME_MAX} characters or less`),
    description: z.string().max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or less`).optional(),
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
