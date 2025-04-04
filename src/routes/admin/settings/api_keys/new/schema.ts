import { z } from 'zod';

export const createApiKeySchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters'),
    description: z.string()
        .max(255, 'Description must be less than 255 characters')
        .optional(),
    active: z.boolean().default(true),
    expiresAt: z.string()
        .transform((val) => val ? new Date(val) : null)
        .optional(),
    apiKey: z.string().min(32).max(32) // 32-character API key
});

export type CreateApiKeySchema = z.infer<typeof createApiKeySchema>;
