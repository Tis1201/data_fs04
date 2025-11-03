import { z } from 'zod';

// Define the schema for group creation
export const groupSchema = z.object({
    name: z.string()
        .min(1, { message: 'Group name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    description: z.string()
        .max(500, { message: 'Description must be 500 characters or less' })
        .optional()
        .nullable(),
    accountId: z.string()
        .min(1, { message: 'Account is required' }),
    permissions: z.string()
        .optional()
        .default('{}')
        .transform((val) => {
            // Handle empty string, null, undefined, or whitespace
            if (!val || val.trim() === '') {
                return {};
            }
            
            try {
                return JSON.parse(val);
            } catch (error) {
                throw new Error('Permissions must be valid JSON');
            }
        })
});
