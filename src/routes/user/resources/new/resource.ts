import { z } from 'zod';

// Define the schema for resource creation
export const resourceSchema = z.object({
    name: z.string()
        .min(1, { message: 'Resource name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    type: z.string()
        .min(1, { message: 'Resource type is required' })
        .refine(value => ['file', 'image', 'video', 'document'].includes(value), { 
            message: 'Type must be one of: file, image, video, document' 
        }),
    path: z.string()
        .min(1, { message: 'Path or URL is required' })
        .max(500, { message: 'Path must be 500 characters or less' }),
    size: z.coerce.number()
        .int({ message: 'Size must be an integer' })
        .min(0, { message: 'Size must be a positive number' }),
    accountId: z.string()
        .min(1, { message: 'Account is required' }),
    // File field properly defined for Superform
    file: z.instanceof(File, { message: 'Please upload a valid file' })
        .optional()
        .nullable()
});
