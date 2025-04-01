import { z } from 'zod';

export const createWhatsAppAccountSchema = z.object({
    description: z.string()
        .min(1, 'Description is required')
        .max(255, 'Description must be less than 255 characters'),
    client_id: z.string()
        .min(1, 'Client ID is required')
});

export type CreateWhatsAppAccountSchema = typeof createWhatsAppAccountSchema;
