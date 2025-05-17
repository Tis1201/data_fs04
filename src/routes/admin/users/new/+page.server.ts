import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../schema';
import { logger } from '$lib/server/logger';
import { createUserSchema } from './schema';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'crypto';

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

export const load = restrict(
    async ({ locals }) => {
        try {
            // Initialize the form with the schema and defaults
            const form = await superValidate(zod(createUserSchema), {
                id: 'user-form',
                defaults: {
                    email: '',
                    name: '',
                    role: 'USER',
                    status: 'ACTIVE'
                }
            });
            
            return { form };
        } catch (err) {
            logger.error(`Error loading user form: ${err}`);
            throw error(500, 'Failed to load user form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(createUserSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Generate a secure temporary password if none provided
                const tempPassword = form.data.password || generateSecureTempPassword();
                
                // Hash the password using @node-rs/argon2
                const hashedPassword = await hash(tempPassword);
                
                // Create the user
                const newUser = await locals.prisma.user.create({
                    data: {
                        email: form.data.email,
                        name: form.data.name || "",
                        systemRole: form.data.role,
                        status: form.data.status,
                        rolesString: form.data.role.toLowerCase(),
                        password: hashedPassword
                    },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        systemRole: true,
                        status: true
                    }
                });
                
                logger.info(`User created: ${newUser.id}`);
                
                // Return success with the form data and success message
                return message(form, {
                    type: 'success',
                    text: 'User created successfully',
                    details: `User '${newUser.email}' has been created.`
                });
                
            } catch (err) {
                logger.error(`Error creating user: ${err}`);
                
                let errorMessage = {
                    type: 'error' as const,
                    text: 'Unable to create user',
                    details: 'An unexpected error occurred while processing your request.'
                };
                
                // Handle specific error types
                if (err.code === 'P2002') {
                    errorMessage.text = 'User already exists';
                    errorMessage.details = `A user with this email already exists.`;
                } else if (err.code === 'P2003') {
                    errorMessage.text = 'Invalid reference';
                    errorMessage.details = 'One of the references in your request is invalid.';
                }
                
                return fail(400, { 
                    form,
                    message: errorMessage
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
