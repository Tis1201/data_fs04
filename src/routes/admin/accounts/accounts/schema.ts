import { z } from 'zod';

// Define the available account statuses
const accountStatuses = ['ACTIVE', 'INACTIVE'] as const;

// Account edit schema with validation
export const accountEditSchema = z.object({
    id: z.string().optional(),
    name: z.string()
        .min(2, { message: "Name must be at least 2 characters" })
        .max(100, { message: "Name must be less than 100 characters" }),
    slug: z.string()
        .min(2, { message: "Slug must be at least 2 characters" })
        .max(50, { message: "Slug must be less than 50 characters" })
        .regex(/^[a-z0-9-]+$/, { message: "Slug can only contain lowercase letters, numbers, and hyphens" }),
    description: z.string().optional(),
    status: z.enum(accountStatuses, {
        required_error: 'Please select a status'
    }).default("ACTIVE")
});

// Relationship schemas for adding/removing related entities
export const relationshipSchema = z.object({
    itemId: z.string().min(1, "Item ID is required")
});

// Multi-select relationship schema
export const multiRelationshipSchema = z.object({
    itemIds: z.array(z.string().min(1, "Item ID is required")).min(1, "At least one item ID is required")
});

// Company creation schema for creating new companies from account page
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

// Export type for use with superforms
export type AccountEditSchema = typeof accountEditSchema;
export type RelationshipSchema = typeof relationshipSchema;
export type MultiRelationshipSchema = typeof multiRelationshipSchema;
export type CompanyCreateSchema = typeof companyCreateSchema;

// Export constants for use in UI
export const ACCOUNT_STATUSES = accountStatuses;

// Generate status options for select components
export const ACCOUNT_STATUS_OPTIONS = accountStatuses.map(status => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase()
})); 
