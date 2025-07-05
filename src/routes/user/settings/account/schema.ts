import { z } from 'zod';

// Account schema for user settings (simplified - no status field)
export const userAccountSchema = z.object({
    name: z.string()
        .min(2, { message: "Account name must be at least 2 characters" })
        .max(100, { message: "Account name must be less than 100 characters" }),
    slug: z.string()
        .min(2, { message: "Slug must be at least 2 characters" })
        .max(50, { message: "Slug must be less than 50 characters" })
        .regex(/^[a-z0-9-]+$/, { message: "Slug can only contain lowercase letters, numbers, and hyphens" }),
    description: z.string().optional()
});

// Notification preferences schema
export const notificationSchema = z.object({
    email: z.boolean().default(true),
    newsletter: z.boolean().default(false),
    security: z.boolean().default(true)
});

// Password change schema
export const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
});

// Company creation schema for user page
export const companyCreateSchema = z.object({
    name: z.string()
        .min(2, { message: "Company name must be at least 2 characters" })
        .max(100, { message: "Company name must be less than 100 characters" }),
    contactEmail: z.string()
        .email({ message: "Please enter a valid email address" })
        .min(1, { message: "Contact email is required" }),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

// Relationship schema for removing items (companies, members, groups)
export const relationshipSchema = z.object({
    itemId: z.string().min(1, 'Item ID is required')
});

// Export types for use with superforms
export type UserAccountSchema = typeof userAccountSchema;
export type NotificationSchema = typeof notificationSchema;
export type PasswordSchema = typeof passwordSchema;
export type CompanyCreateSchema = typeof companyCreateSchema;
export type RelationshipSchema = typeof relationshipSchema; 
