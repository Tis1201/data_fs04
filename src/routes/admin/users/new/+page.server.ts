import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createUserSchema } from './schema';
import { randomBytes, createHash } from 'crypto';
import { addDays } from 'date-fns';
import { getSetting } from '$lib/server/settings/utils';
import { validatePassword } from '$lib/server/auth/password-validation';
import { hash } from '@node-rs/argon2';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { generateSecurePassword } from '$lib/utils/generate-password';



// Create invitation token for the user
async function createInvitationToken(prisma: any, userId: string) {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    
    const invitationToken = await prisma.invitationToken.create({
        data: {
            id: randomBytes(16).toString('hex'),
            userId: userId,
            token: hashedToken,
            expiresAt: addDays(new Date(), 7), // 7 days expiry
            // usedAt is null by default (not used yet)
        }
    });
    
    return {
        ...invitationToken,
        rawToken // Include the raw token for the invitation link
    };
}

export const load: PageServerLoad = async ({ locals }) => {
  try {
    // Get the authentication state
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      throw redirect(302, '/auth/login');
    }

    // Generate a secure password for the form
    const generatedPassword = generateSecurePassword();
    
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
};

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }: { request: Request; locals: any }) => {
            const form = await superValidate(request, zod(createUserSchema));
            
            // Perform additional custom validations
            let hasValidationErrors = !form.valid;
            
            // Check if password is provided - don't allow empty passwords
            if (!form.data.password || form.data.password.trim() === '') {
                form.errors.password = ['Password is required'];
                hasValidationErrors = true;
            } else {
                // Validate password based on settings if password is provided
                const passwordValidation = await validatePassword(form.data.password);
                
                if (!passwordValidation.valid) {
                    form.errors.password = [passwordValidation.error || 'Password does not meet security requirements'];
                    hasValidationErrors = true;
                }
            }
            
            // Check if email already exists
            if (form.data.email) {
                const existingUser = await locals.prisma.user.findUnique({
                    where: { email: form.data.email }
                });
                
                if (existingUser) {
                    form.errors.email = ['A user with this email already exists'];
                    hasValidationErrors = true;
                }
            }
            
            // Return all validation errors at once
            if (hasValidationErrors) {
                return fail(400, { 
                    form,
                    message: {
                        type: 'error',
                        text: 'Validation failed',
                        details: 'Please fix the errors below and try again.'
                    }
                });
            }

            try {
                const tempPassword = form.data.password!; // Safe to assert non-null after validation
                
                // Hash the password using Argon2
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
                const result = { 
                    form,
                    success: true,
                    user: newUser, // Include the created user data for the invitation dialog
                    invitationToken: {
                        id: invitationToken.id,
                        token: invitationToken.rawToken,
                        expiresAt: invitationToken.expiresAt
                    }
                };
                
                return result;
                
            } catch (err) {
                logger.error(`Error creating user: ${err}`);
                
                let errorMessage = {
                    type: 'error' as const,
                    text: 'Unable to create user',
                    details: 'An unexpected error occurred while processing your request.'
                };
                
                // Handle specific error types
                if (err && typeof err === 'object' && 'code' in err) {
                    if (err.code === 'P2002') {
                        errorMessage.text = 'User already exists';
                        errorMessage.details = `A user with this email already exists.`;
                    } else if (err.code === 'P2003') {
                        errorMessage.text = 'Invalid reference';
                        errorMessage.details = 'One of the references in your request is invalid.';
                    }
                }
                
                // Set the error message on the form instead of returning it separately
                return fail(400, { 
                    form: {
                        ...form,
                        message: errorMessage
                    }
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
