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
    // Accept permissions as an object (for JSON dataType) or string (for form dataType)
    permissions: z.union([
        z.string(),
        z.record(z.any())
    ])
    .optional()
    .default({})
    .transform((val) => {
        // Normalize to object
        if (typeof val === 'string') {
            if (!val || val.trim() === '') return {};
            try {
                return JSON.parse(val);
            } catch {
                return {};
            }
        }
        return val || {};
    })
});
