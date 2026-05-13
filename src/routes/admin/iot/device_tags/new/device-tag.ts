import { z } from 'zod';
import { TAG_DESCRIPTION_MAX, TAG_NAME_MAX } from '../../../../user/iot/device_tags/new/device-tag';

export const deviceTagSchema = z.object({
    name: z
        .string()
        .min(1, { message: 'Name is required' })
        .max(TAG_NAME_MAX, { message: `Tag name must be at most ${TAG_NAME_MAX} characters` }),
    description: z
        .string()
        .max(TAG_DESCRIPTION_MAX, { message: `Description must be at most ${TAG_DESCRIPTION_MAX} characters` })
        .optional(),
    accountId: z.string().optional()
});

export type DeviceTagFormData = z.infer<typeof deviceTagSchema>;
