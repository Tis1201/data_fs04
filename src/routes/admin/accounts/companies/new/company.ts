import { z } from 'zod';
import { validatePhoneNumber, getPhoneValidationMessage } from '$lib/utils/validation/phone';

// Define the schema for company creation
export const companySchema = z.object({
    name: z.string()
        .min(2, { message: 'Company name must be at least 2 characters' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING'])
        .default('ACTIVE'),
    address: z.string()
        .max(200, { message: 'Address must be 200 characters or less' })
        .optional()
        .nullable(),
    contactEmail: z.string()
        .min(1, { message: 'Contact email is required' })
        .email({ message: 'Invalid email address' })
        .max(100, { message: 'Email must be 100 characters or less' }),
    contactPhone: z.string()
        .refine(validatePhoneNumber, { message: getPhoneValidationMessage() })
        .optional()
        .nullable(),
    description: z.string()
        .max(500, { message: 'Description must be 500 characters or less' })
        .optional()
        .nullable(),
    accountId: z.string()
        .min(1, { message: 'Account is required' })
});
