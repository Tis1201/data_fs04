import { z } from 'zod';

export const createWhatsAppAccountSchema = z.object({
    phoneNumber: z.string()
        .min(1, 'Phone number is required')
        .regex(/^\+?[0-9\s\-()]+$/, 'Please enter a valid phone number'),
    description: z.string()
        .min(1, 'Description is required')
        .max(255, 'Description must be less than 255 characters')
});

export type CreateWhatsAppAccountSchema = typeof createWhatsAppAccountSchema;
