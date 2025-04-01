import { z } from 'zod';

// Schema for listener endpoint validation
export const listenerSchema = z.object({
    name: z.string().min(1, "Name is required"),
    postfix: z.string().optional(), // Will be system-generated
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    expiresAt: z.date().optional().nullable(),
    listenToAll: z.boolean().default(true),
    webhookEndpointIds: z.array(z.string()).optional().default([]),
    whatsappAccountIds: z.array(z.string()).optional().default([]),
});

// Schema for toggling listener status
export const listenerStatusSchema = z.object({
    id: z.string().min(1, "Listener ID is required"),
    status: z.enum(["ACTIVE", "INACTIVE"])
});