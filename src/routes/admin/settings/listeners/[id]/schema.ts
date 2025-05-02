import { z } from 'zod';

// Define the available listener statuses
const listenerStatuses = ['ACTIVE', 'INACTIVE'] as const;

// Listener edit schema with validation
export const listenerEditSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  status: z.enum(listenerStatuses, {
    required_error: 'Please select a status'
  }).default('ACTIVE'),
  listenToAll: z.boolean().default(false),
  postfix: z.string().optional(),
  expiresAt: z.date().nullable().optional(),
  webhookEndpointIds: z.array(z.string()).default([]),
  whatsappAccountIds: z.array(z.string()).default([])
});

// Export type for use with superforms
export type ListenerEditSchema = typeof listenerEditSchema;

// Export constants for use in UI
export const LISTENER_STATUSES = listenerStatuses;
