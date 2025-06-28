import { z } from 'zod';

export const createWhatsAppAccountSchema = z.object({
    client_id: z.string().uuid({
        message: 'A valid WhatsApp client ID is required'
    }),
    description: z.string().min(1, {
        message: 'Description is required'
    }).max(255, {
        message: 'Description must be less than 255 characters'
    }),
    name: z.string().optional(),
    phoneNumber: z.string().optional()
});

export type CreateWhatsAppAccountSchema = z.infer<typeof createWhatsAppAccountSchema>;
