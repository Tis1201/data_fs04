import { z } from 'zod';

// Define the schema for email provider creation based on EmailServiceProvider model
export const emailSchema = z.object({
    name: z.string()
        .min(1, { message: 'Provider name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    type: z.enum(['smtp', 'resend'], { 
        required_error: 'Provider type is required',
        invalid_type_error: 'Provider type must be either SMTP or Resend'
    }),
    // Common fields for all provider types
    fromEmail: z.string()
        .email({ message: 'Must be a valid email address' })
        .min(1, { message: 'From email is required' }),
    fromName: z.string()
        .max(100, { message: 'From name must be 100 characters or less' })
        .optional()
        .nullable(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    
    // SMTP specific fields
    smtpHost: z.string()
        .max(255, { message: 'SMTP host must be 255 characters or less' })
        .optional()
        .nullable(),
    smtpPort: z.coerce.number()
        .int({ message: 'Port must be an integer' })
        .min(1, { message: 'Port must be at least 1' })
        .max(65535, { message: 'Port must be at most 65535' })
        .optional()
        .nullable(),
    smtpUser: z.string()
        .max(255, { message: 'Username must be 255 characters or less' })
        .optional()
        .nullable(),
    smtpPass: z.string()
        .max(255, { message: 'Password must be 255 characters or less' })
        .optional()
        .nullable(),
    smtpSecure: z.boolean().default(true),
    smtpAuth: z.boolean().default(true),
    
    // API-based providers
    apiKey: z.string()
        .max(255, { message: 'API key must be 255 characters or less' })
        .optional()
        .nullable(),
    apiSecret: z.string()
        .max(255, { message: 'API secret must be 255 characters or less' })
        .optional()
        .nullable(),
    domain: z.string()
        .max(255, { message: 'Domain must be 255 characters or less' })
        .optional()
        .nullable(),
    region: z.string()
        .max(50, { message: 'Region must be 50 characters or less' })
        .optional()
        .nullable(),
    
    // Webhook configuration
    webhookUrl: z.string()
        .url({ message: 'Must be a valid URL' })
        .optional()
        .nullable(),
    webhookKey: z.string()
        .max(255, { message: 'Webhook key must be 255 characters or less' })
        .optional()
        .nullable(),
}).refine(data => {
    // If type is smtp, smtpHost and smtpPort are required
    if (data.type === 'smtp') {
        return !!data.smtpHost && !!data.smtpPort;
    }
    return true;
}, {
    message: 'SMTP host and port are required for SMTP providers',
    path: ['smtpHost']
}).refine(data => {
    // If type is resend, apiKey is required
    if (data.type === 'resend') {
        return !!data.apiKey;
    }
    return true;
}, {
    message: 'API key is required for Resend providers',
    path: ['apiKey']
});
