import { z } from 'zod';

// Define the schema for resource creation
export const resourceSchema = z.object({
    name: z.string()
        .min(1, { message: 'Resource name is required' })
        .max(100, { message: 'Name must be 100 characters or less' }),
    description: z.string()
        .optional(),
    type: z.string()
        .min(1, { message: 'Resource type is required' })
        .refine(value => ['file', 'application', 'archive', 'package'].includes(value), { 
            message: 'Type must be one of: file, application, archive, package' 
        }),
    target: z.string()
        .default('user')
        .refine(value => ['user', 'device', 'account'].includes(value), {
            message: 'Target must be one of: user, device, account'
        }),
    version: z.string()
        .optional()
        .default('1.0.0'),
    format: z.string()
        .min(1, { message: 'Format is required' }),
    packageName: z.string()
        .optional(),
    path: z.string()
        .min(1, { message: 'Path or URL is required' })
        .max(500, { message: 'Path must be 500 characters or less' }),
    size: z.coerce.number()
        .int({ message: 'Size must be an integer' })
        .min(0, { message: 'Size must be a positive number' }),
    accountId: z.string()
        .optional()
        .default(''),
    // File field properly defined for Superform
    // Using custom validation to handle both browser and server environments
    file: z.custom<File | null>(
        (val) => {
            // During SSR, File is not available, so we need to handle it
            if (typeof window === 'undefined') return true;
            // In browser, check if it's a File or null
            if (val === null) return true;
            if (!(val instanceof File)) return false;
            
            // Validate file extension - only allow .zip, .cpk, .apk
            const allowedExtensions = ['.zip', '.cpk', '.apk'];
            const fileName = val.name.toLowerCase();
            const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
            
            if (!hasValidExtension) {
                return false;
            }
            
            return true;
        },
        { message: 'Only .zip, .cpk, and .apk files are allowed' }
    )
    .optional()
    .nullable()
});
