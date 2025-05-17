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
    permissions: z.string()
        .default('{}')
        .refine(value => {
            try {
                JSON.parse(value);
                return true;
            } catch (e) {
                return false;
            }
        }, { message: 'Permissions must be a valid JSON string' }),
    accountId: z.string()
        .min(1, { message: 'Account is required' })
});
