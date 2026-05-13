import { z } from 'zod';

// Base schema for common fields
const baseEmailSettingsSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    fromEmail: z.string().email('Valid email address is required'),
    fromName: z.string().optional(),
});

// SMTP specific schema
const smtpSchema = baseEmailSettingsSchema.extend({
    type: z.literal('smtp'),
    host: z.string().min(1, 'Host is required'),
    port: z.number().int().min(1, 'Port is required'),
    username: z.string().min(1, 'Username is required'),
    password: z.string().optional(), // Optional during update
    secure: z.boolean().default(true),
});

// API specific schema
const apiSchema = baseEmailSettingsSchema.extend({
    type: z.literal('resend'),
    apiEndpoint: z.string().url('Invalid API endpoint URL'),
    apiKey: z.string().optional(), // Optional during update
});

// No AWS SES schema needed

// Combined schema for all email settings types
export const emailSettingsSchema = z.discriminatedUnion('type', [
    smtpSchema,
    apiSchema,
]);
