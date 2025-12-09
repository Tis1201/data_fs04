import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

type SuperValidateInput = Parameters<typeof superValidate>[0];

// Base schema for common fields
const baseSchema = {
    id: z.string().optional(),
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    roles: z.array(z.string()).optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
};

// Status validation with case transformation
const statusSchema = z.string()
    .transform(val => val.toLowerCase()) // Convert to lowercase
    .refine(val => ['active', 'inactive', 'pending'].includes(val), {
        message: 'Invalid status'
    });

// Schema for creating new accounts (requires phone number)
export const whatsappAccountSchema = z.object({
    ...baseSchema,
    phoneNumber: z.string().min(1, 'Phone number is required'),
    status: statusSchema
});

// Schema for updating existing accounts (phone number and status are optional)
export const whatsappAccountUpdateSchema = z.object({
    ...baseSchema,
    phoneNumber: z.string().optional(),
    status: statusSchema.optional()
});

export type WhatsAppAccount = z.infer<typeof whatsappAccountSchema>;

export function createForm(event: SuperValidateInput | null | undefined, isUpdate = false) {
    // Ensure we have a valid event object to prevent errors with superValidate
    const safeEvent = (event ?? {}) as SuperValidateInput;
    const schema = isUpdate ? whatsappAccountUpdateSchema : whatsappAccountSchema;
    return superValidate(safeEvent, zod(schema));
}
