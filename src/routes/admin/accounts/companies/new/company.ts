import { z } from 'zod';

// Define the schema for company creation
export const companySchema = z.object({
    name: z.string()
        .min(1, { message: 'Company name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING'])
        .default('ACTIVE'),
    address: z.string()
        .max(200, { message: 'Address must be 200 characters or less' })
        .optional()
        .nullable(),
    contactEmail: z.string()
        .email({ message: 'Invalid email address' })
        .max(100, { message: 'Email must be 100 characters or less' })
        .optional()
        .nullable(),
    contactPhone: z.string()
        .max(20, { message: 'Phone number must be 20 characters or less' })
        .optional()
        .nullable(),
    description: z.string()
        .max(500, { message: 'Description must be 500 characters or less' })
        .optional()
        .nullable(),
    accountId: z.string()
        .min(1, { message: 'Account is required' })
});
