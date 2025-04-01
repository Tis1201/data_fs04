import { z } from 'zod';

/**
 * Schema for creating a new WhatsApp account
 */
export const createWhatsAppAccountSchema = z.object({
    // Client ID from WhatsApp authentication
    client_id: z.string({
        required_error: 'Client ID is required',
    }),
    
    // Phone number from WhatsApp
    phoneNumber: z.string({
        required_error: 'Phone number is required',
    }).optional(),
    
    // Display name from WhatsApp
    name: z.string().optional(),
    
    // User-provided description
    description: z.string({
        required_error: 'Description is required',
    }).min(3, {
        message: 'Description must be at least 3 characters',
    }).max(255, {
        message: 'Description must be less than 255 characters',
    }),
});

// Type for the form data
export type CreateWhatsAppAccountSchema = typeof createWhatsAppAccountSchema;

// Type for the form values
export type CreateWhatsAppAccountValues = z.infer<typeof createWhatsAppAccountSchema>;
