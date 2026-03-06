import { z } from 'zod';

/** TC-TG-0021: Max description length to prevent UI layout break and excessively long inputs */
export const TAG_DESCRIPTION_MAX = 200;

/** TC-TG-0020: Max tag name length for consistent UI display */
export const TAG_NAME_MAX = 50;

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
