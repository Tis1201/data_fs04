import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createInvitation, sendInvitationEmail } from '$lib/server/invitation/service';

// Schema for creating invitations
const inviteUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['USER', 'ADMIN'], {
    required_error: 'Please select a user role'
  }).default('USER'),
  sendEmail: z.preprocess(
    (val) => {
      // Handle string-to-boolean conversion from HTML form
      if (typeof val === 'string') {
        return val === 'true' || val === 'on';
      }
      return Boolean(val);
    },
    z.boolean().default(true)
  )
});

export const load = restrict(
  async ({ locals }: { locals: any }) => {
    try {
      // Initialize the form with defaults
      const form = await superValidate(zod(inviteUserSchema), {
        id: 'invite-user-form',
        defaults: {
          email: '',
          name: '',
          role: 'USER',
          sendEmail: true
        }
      });
      
      // Get recent invitations for display
      const recentInvitations = await locals.prisma.invitationToken.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              systemRole: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      return { 
        form,
        recentInvitations
      };
    } catch (err) {
      logger.error(`Error loading invitation form: ${err}`);
      throw error(500, 'Failed to load invitation form');
    }
  },
  [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
  invite: restrict(
    async ({ request, locals }: { request: Request; locals: any }) => {
      const form = await superValidate(request, zod(inviteUserSchema));
      
      // Perform additional custom validations
      let hasValidationErrors = !form.valid;
      
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
        return fail(400, { form });
      }

      try {
        const auth = await locals.auth.validate();
        const inviterUser = auth?.user;
        
        if (!inviterUser) {
          throw new Error('Authentication required');
        }

        const { email, name, role, sendEmail } = form.data;

        // Create the invitation
        const { user, invitation } = await createInvitation(
          email,
          inviterUser.id,
          locals.prisma,
          role,
          name
        );

        // Generate invitation URL for manual sharing
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
        const invitationUrl = `${baseUrl}/user/invite?token=${invitation.rawToken}`;

        // Handle email sending based on user preference
        let emailStatus: 'sent' | 'not_requested' | 'failed' = 'not_requested';
        let emailError: string | null = null;
        
        if (sendEmail) {
          try {
            await sendInvitationEmail(
              email,
              invitation.rawToken,
              name,
              inviterUser.name || inviterUser.email,
              locals.prisma
            );
            emailStatus = 'sent';
            logger.info(`Invitation email sent successfully to ${email}`);
          } catch (error) {
            emailStatus = 'failed';
            emailError = error instanceof Error ? error.message : 'Unknown email error';
            logger.warn(`Failed to send invitation email to ${email}: ${emailError}`);
          }
        } else {
          logger.info(`Invitation created for ${email} - email not requested by user`);
        }

        logger.info(`User invitation created for ${email} by ${inviterUser.email} (email: ${emailStatus})`);
        
        return {
          form,
          success: true,
          data: {
            user,
            invitation: {
              id: invitation.id,
              token: invitation.rawToken,
              expiresAt: invitation.expiresAt,
              url: invitationUrl
            },
            emailStatus,
            emailError,
            // Keep backward compatibility
            emailSent: emailStatus === 'sent'
          }
        };
        
      } catch (err) {
        logger.error(`Error creating invitation: ${err}`);
        
        let errorMessage = 'Unable to create invitation';
        
        if (err instanceof Error) {
          if (err.message.includes('already exists')) {
            errorMessage = 'A user with this email already exists';
          } else if (err.message.includes('email provider')) {
            errorMessage = 'Email service not configured. Please contact your administrator.';
          }
        }
        
        return fail(400, { 
          form,
          error: errorMessage
        });
      }
    },
    [SystemRole.ADMIN]
  )
}; 
