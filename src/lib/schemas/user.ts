import { z } from 'zod';

export const userSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    role: z.enum(['ADMIN', 'USER'] as const, {
        required_error: 'Please select a role'
    }),
    password: z.string().min(8, 'Password must be at least 8 characters').optional()
});

export type UserSchema = typeof userSchema;
