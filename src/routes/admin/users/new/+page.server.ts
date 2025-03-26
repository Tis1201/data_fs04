import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { createUserSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { randomBytes } from 'crypto';
import { hash } from '@node-rs/argon2';

function generateSecureTempPassword(): string {
    const bytes = randomBytes(16); // 16 bytes = 128 bits
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure we have at least one of each required character type
    password += chars.charAt(Math.floor(Math.random() * 26)); // Uppercase
    password += chars.charAt(Math.floor(Math.random() * 26) + 26); // Lowercase
    password += chars.charAt(Math.floor(Math.random() * 10) + 52); // Number
    password += chars.charAt(Math.floor(Math.random() * 8) + 62); // Special char
    
    // Fill the rest of the password
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Shuffle the password to ensure randomness
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

export const load = (async ({ locals }) => {
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Not authorized to create users');
    }
    
    // Initialize the form with the schema and defaults
    const form = await superValidate(zod(createUserSchema), {
        defaults: {
            email: '',
            name: '',
            role: 'USER',
            status: 'ACTIVE'
        }
    });
    
    return { form };
}) satisfies PageServerLoad;

export const actions = {
    /**
     * Save new user data
     */
    save: restrict(
        async ({ request, locals }) => {
            console.log('Save action triggered');
            logger.info('Save action triggered in admin/users/new');
            
            const form = await superValidate(request, zod(createUserSchema));
            logger.debug('Create user form data:', form);

            if (!form.valid) {
                console.log("Form is invalid")
                return fail(400, { form });
            }

            try {
                // Get the Zenstack-enhanced Prisma client from locals
                prisma = locals.prisma;
                
                // Create the user with Zenstack (handles permissions automatically)
                // Generate a secure temporary password if none provided
                const tempPassword = form.data.password || 
                    generateSecureTempPassword();
                
                // Hash the password using @node-rs/argon2
                const hashedPassword = await hash(tempPassword);
                logger.debug('Password hashed successfully', { passwordLength: tempPassword.length });
                
                const newUser = await prisma.user.create({
                    data: {
                        email: form.data.email,
                        name: form.data.name || "",
                        systemRole: form.data.role,
                        status: form.data.status,
                        rolesString: form.data.role.toLowerCase(),
                        password: hashedPassword // Store the hashed password
                    }
                });
                
                // Log the created user (without password)
                logger.debug('User created with hashed password', {
                    userId: newUser.id,
                    email: newUser.email,
                    role: newUser.systemRole
                });
                
                console.log(`User created successfully: ${newUser.id}`);
                
                // Return success with the form data
                return { form };
            } catch (error) {
                console.error('Error creating user:', error);
                
                // Determine the type of error and return appropriate response
                let errorMessage = {
                    type: 'error' as const,
                    text: 'Unable to create user',
                    details: 'An unexpected error occurred while processing your request.'
                };
                
                // Handle specific error types
                if (error.code === 'P2002') {
                    // Unique constraint violation
                    errorMessage.text = 'User already exists';
                    errorMessage.details = `A user with this ${error.meta?.target?.[0] || 'identifier'} already exists.`;
                } else if (error.code === 'P2003') {
                    // Foreign key constraint violation
                    errorMessage.text = 'Invalid reference';
                    errorMessage.details = 'One of the references in your request is invalid.';
                } else if (error.code === 'FORBIDDEN') {
                    // Zenstack permission error
                    errorMessage.text = 'Permission denied';
                    errorMessage.details = 'You do not have permission to perform this action.';
                }
                
                // Return a structured error response with the form data
                return fail(400, {
                    form,
                    message: {
                        ...errorMessage,
                        code: error.code || 'UNKNOWN_ERROR',
                        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        },
        ['ADMIN'] // Only allow admin role to create users
    )
};
