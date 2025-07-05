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
    accountRole: z.enum(['MEMBER', 'ADMIN'] as const, {
        required_error: 'Please select an account role'
    }).default('MEMBER'),
    status: z.enum(['ACTIVE', 'INACTIVE'] as const, {
        required_error: 'Please select a status'
    }).default('ACTIVE'),
    password: z.string().min(1, 'Password is required')
});

export type CreateUserSchema = typeof createUserSchema; 
