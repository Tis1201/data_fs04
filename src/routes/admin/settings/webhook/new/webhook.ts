import { z } from 'zod';

// Schema for webhook endpoint validation
export const webhookSchema = z.object({
    name: z.string().min(1, "Name is required"),
    postfix: z.string().optional(), // Will be system-generated
    description: z.string().optional(),
    active: z.boolean().default(true),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    expiresAt: z.date().optional().nullable(),
});

// Schema for toggling webhook status
export const webhookStatusSchema = z.object({
    id: z.string().min(1, "Webhook ID is required"),
    status: z.enum(["ACTIVE", "INACTIVE"])
});
