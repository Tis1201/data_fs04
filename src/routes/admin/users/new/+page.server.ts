import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createUserSchema } from './schema';
import { hash } from '@node-rs/argon2';
import { randomBytes, createHash } from 'crypto';
import { addDays } from 'date-fns';

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

/**
 * Generate a secure invitation token and store it in the database
 * @param prisma The Prisma client instance
 * @param userId The ID of the user to create the token for
 * @param expirationDays Number of days until the token expires
 * @returns The created invitation token record
 */
async function createInvitationToken(prisma: any, userId: string, expirationDays: number = 1) {
    // Generate a secure random token
    const randomToken = randomBytes(32).toString('hex');
    
    // Hash the token for storage (we'll use the raw token in the URL)
    const hashedToken = createHash('sha256').update(randomToken).digest('hex');
    
    // Calculate expiration date
    const expiresAt = addDays(new Date(), expirationDays);
    
    // Create and store the token in the database
    const invitationToken = await prisma.invitationToken.create({
        data: {
            token: hashedToken,
            userId: userId,
            expiresAt: expiresAt
        }
    });
    
    // Return both the database record and the raw token for the URL
    return {
        id: invitationToken.id,
        expiresAt: invitationToken.expiresAt,
        rawToken: randomToken
    };
}

export const load = restrict(
    async ({ locals }) => {
        try {
            // Generate a secure password for the form
            const generatedPassword = generateSecureTempPassword();
            
            // Initialize the form with the schema and defaults
            const form = await superValidate(zod(createUserSchema), {
                id: 'user-form',
                defaults: {
                    email: '',
                    name: '',
                    role: 'USER',
                    status: 'ACTIVE',
                    password: generatedPassword // Prefill with generated password
                }
            });
            
            return { 
                form,
                generatedPassword // Include the generated password in the response
            };
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
                
                // Generate an invitation token for the new user
                const invitationToken = await createInvitationToken(locals.prisma, newUser.id);
                
                logger.info(`User created: ${newUser.id} with invitation token: ${invitationToken.id}`);
                
                // Return success with the form data and success message
                // Include the temporary password in the response if one was generated
                const successMessage = {
                    type: 'success',
                    text: 'User created successfully',
                    details: `User '${newUser.email}' has been created.`
                };
                
                // Return the user data along with the form and success message
                return {
                    form,
                    message: successMessage,
                    generatedPassword: tempPassword,
                    user: newUser, // Include the created user data for the invitation dialog
                    invitationToken: {
                        id: invitationToken.id,
                        token: invitationToken.rawToken,
                        expiresAt: invitationToken.expiresAt
                    }
                };
                
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
