import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';

export const whatsappAccountSchema = z.object({
    id: z.string().optional(),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    status: z.enum(['active', 'inactive', 'pending'], {
        errorMap: () => ({ message: 'Invalid status' })
    }),
    roles: z.array(z.string()).optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
});

export type WhatsAppAccount = z.infer<typeof whatsappAccountSchema>;

export function createForm(event: any) {
    return superValidate(event, whatsappAccountSchema);
}
