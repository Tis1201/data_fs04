import { z } from 'zod';

import { DESCRIPTION_MAX, NAME_MAX } from '$lib/constants/description';

/** TC-TG-0021: Max description length to prevent UI layout break and excessively long inputs. */
export const TAG_DESCRIPTION_MAX = DESCRIPTION_MAX;

/** TC-TG-0020: Max tag name length for consistent UI display (similar to bundles limit pattern) */
export const TAG_NAME_MAX = NAME_MAX;

export const deviceTagSchema = z.object({
    name: z
        .string()
        .min(1, { message: 'Name is required' })
        .max(TAG_NAME_MAX, { message: `Tag name must be at most ${TAG_NAME_MAX} characters` }),
    description: z
        .string()
        .max(TAG_DESCRIPTION_MAX, { message: `Description must be at most ${TAG_DESCRIPTION_MAX} characters` })
        .optional(),
});

export type DeviceTagFormData = z.infer<typeof deviceTagSchema>;
