import { z } from 'zod';

export const deviceTagSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    description: z.string().optional(),
    accountId: z.string().optional()
});

export type DeviceTagFormData = z.infer<typeof deviceTagSchema>;
