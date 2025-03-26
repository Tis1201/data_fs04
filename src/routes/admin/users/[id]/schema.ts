import { z } from 'zod';

// Define the available system roles
const systemRoles = ['SUPER_ADMIN', 'ADMIN', 'USER'] as const;

// Define the available user statuses
const userStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

// User edit schema with validation
export const userEditSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required').nullable().optional(),
  systemRole: z.enum(systemRoles, {
    required_error: 'Please select a system role'
  }).default('USER'),
  status: z.enum(userStatuses, {
    required_error: 'Please select a status'
  }).default('ACTIVE'),
  // Make password optional for updates
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  // Optional field for any additional roles as comma-separated string
  rolesString: z.string().optional().default('')
});

// Export type for use with superforms
export type UserEditSchema = typeof userEditSchema;

// Export constants for use in UI
export const SYSTEM_ROLES = systemRoles;
export const USER_STATUSES = userStatuses;
