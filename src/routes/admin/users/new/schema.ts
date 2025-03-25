import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string()
        .email('Please enter a valid email address')
        .min(5, 'Email must be at least 5 characters')
        .max(255, 'Email must be less than 255 characters'),
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .regex(/^[a-zA-Z\s]*$/, 'Name can only contain letters and spaces'),
    role: z.enum(['ADMIN', 'USER'] as const, {
        required_error: 'Please select a role'
    }),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const, {
        required_error: 'Please select a status'
    }).default('ACTIVE'),
    password: z.string()
        .min(12, 'Password must be at least 12 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*]/, 'Password must contain at least one special character')
        .optional()
});

export type CreateUserSchema = typeof createUserSchema;
