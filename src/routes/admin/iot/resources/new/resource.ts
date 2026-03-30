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
    version: z.string()
        .optional()
        .default('1.0.0'),
    versionCode: z.coerce.number()
        .int()
        .optional()
        .nullable(),
    signature: z.string()
        .optional()
        .nullable(),
    releaseType: z.string()
        .refine(value => ['Alpha', 'Beta', 'Production'].includes(value), {
            message: 'Release type must be one of: Alpha, Beta, Production'
        })
        .default('Production'),
    format: z.string()
        .min(1, { message: 'Format is required' }),
    packageName: z.string()
        .optional(),
    path: z.string()
        .min(1, { message: 'Path or URL is required' })
        .max(500, { message: 'Path must be 500 characters or less' }),
    size: z.coerce.number()
        .int({ message: 'Size must be an integer' })
        .min(0, { message: 'Size must be a positive number' })
        .max(500 * 1024 * 1024, { message: 'File size must not exceed 500 MB' }),
    accountId: z.string()
        .optional()
        .default('')
        .nullable()
        .transform(val => val === 'undefined' || val === undefined ? '' : val),
    /** Admin create: same options as edit-page sharing (ResourceSharePanel). */
    shareScope: z
        .enum(['NONE', 'ALL_ACCOUNTS', 'SELECTED_ACCOUNTS', 'PUBLIC_DEVELOPER'])
        .default('NONE'),
    // File field properly defined for Superform
    // Using custom validation to handle both browser and server environments
    file: z.custom<File | null>(
        (val) => {
            // During SSR, File is not available, so we need to handle it
            if (typeof window === 'undefined') return true;
            // In browser, check if it's a File or null
            if (val === null) return true;
            if (!(val instanceof File)) return false;
            
            const allowedExtensions = ['.zip', '.cpk', '.apk', '.deb', '.exe'];
            const fileName = val.name.toLowerCase();
            const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
            
            if (!hasValidExtension) {
                return false;
            }
            
            return true;
        },
        { message: 'Only .zip, .cpk, .apk, .deb, and .exe files are allowed' }
    )
    .optional()
    .nullable()
});
