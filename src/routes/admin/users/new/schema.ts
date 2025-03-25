import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    name: z.string().min(1, 'Name is required').optional(),
    role: z.enum(['ADMIN', 'USER'] as const, {
        required_error: 'Please select a role'
    }),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const, {
        required_error: 'Please select a status'
    }).default('ACTIVE'),
    password: z.string().min(8, 'Password must be at least 8 characters').optional()
});

export type CreateUserSchema = typeof createUserSchema;
