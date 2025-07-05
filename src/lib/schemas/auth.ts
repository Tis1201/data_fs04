import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(1, 'Password is required'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email'),
});
