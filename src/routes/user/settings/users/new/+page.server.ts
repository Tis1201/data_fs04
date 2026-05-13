import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { validatePassword } from '$lib/server/auth/password-validation';
import { hash } from '@node-rs/argon2';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { getAdminPrismaFromAuth } from '$lib/utils/database/admin-prisma';
import { createUserSchema } from './schema';
import { generateSecurePassword } from '$lib/utils/generate-password';
import prisma from '$lib/server/prisma';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
// TODO: Re-enable after subscription system is implemented
// import { checkUserLimit, LimitExceededError } from '$lib/server/entitlements';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  try {
    // Get the authentication state
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      throw redirect(302, '/auth/login');
    }

    // Get current account ID from cookie
    const currentAccountId = cookies.get('current_account_id');
    if (!currentAccountId) {
      throw error(400, 'No account selected');
    }

    // Check if user has ADMIN or OWNER membership role
    const currentUserMembership = await prisma.accountMembership.findFirst({
      where: {
        accountId: currentAccountId,
        userId: auth.user.id,
        role: { not: 'SYSTEM' }
      }
    });

    if (!currentUserMembership || !['ADMIN', 'OWNER'].includes(currentUserMembership.role)) {
      throw error(403, 'Access denied. Only account administrators can create new users.');
    }

    // Generate a secure password for the form
    const generatedPassword = generateSecurePassword();

    // Initialize the form with the schema and defaults
    const form = await superValidate(zod(createUserSchema), {
      id: 'create-user-form',
      defaults: {
        email: '',
        name: '',
        accountRole: 'MEMBER',
        status: 'ACTIVE',
        password: generatedPassword
      }
    });

    return {
      form,
      generatedPassword
    };
  } catch (err) {
    if (err instanceof Response) {
      throw err; // Re-throw redirects
    }
    logger.error(`Error loading new user form: ${err}`);
    throw error(500, 'Failed to load user form');
  }
};

export const actions: Actions = {
  create: async ({ request, locals, cookies }: { request: Request; locals: any; cookies: any }) => {
    const form = await superValidate(request, zod(createUserSchema));

    try {
      // Get the authentication state
      const auth = await locals.auth.validate();
      if (!auth?.user) {
        throw redirect(302, '/auth/login');
      }

      // Get current account ID from cookie
      const currentAccountId = cookies.get('current_account_id');
      if (!currentAccountId) {
        return fail(400, { form, message: 'No account selected' });
      }

      // Check if user has ADMIN or OWNER membership role
      const currentUserMembership = await prisma.accountMembership.findFirst({
        where: {
          accountId: currentAccountId,
          userId: auth.user.id,
          role: { not: 'SYSTEM' }
        }
      });

      if (!currentUserMembership || !['ADMIN', 'OWNER'].includes(currentUserMembership.role)) {
        return fail(403, {
          form,
          message: {
            type: 'error',
            text: 'Access denied',
            details: 'Only account administrators can create new users.'
          }
        });
      }

      const enhancedPrisma = getEnhancedPrisma(auth.user);

      // TODO: Re-enable user limit check after subscription system is implemented
      // try {
      //   await checkUserLimit(currentAccountId);
      // } catch (e) {
      //   if (e instanceof LimitExceededError) {
      //     return message(form, {
      //       type: 'error',
      //       text: 'User limit reached',
      //       details: `Your account has reached the maximum number of users (${e.current}/${e.max}). Upgrade your plan to add more users.`
      //     }, { status: 403 });
      //   }
      //   throw e;
      // }

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
        const existingUser = await enhancedPrisma.user.findUnique({
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

      // Hash the password using Argon2
      const hashedPassword = await hash(form.data.password!);

      // Create the user
      const newUser = await enhancedPrisma.user.create({
        data: {
          email: form.data.email,
          name: form.data.name,
          systemRole: 'USER',
          status: form.data.status,
          password: hashedPassword
        },
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          status: true,
          createdAt: true
        }
      });

      // Add the new user to the current account with selected role
      const adminPrisma = getAdminPrismaFromAuth(auth);
      const membership = await adminPrisma.accountMembership.create({
        data: {
          userId: newUser.id,
          accountId: currentAccountId,
          role: form.data.accountRole
        }
      });

      logger.info(`User ${newUser.id} added to account ${currentAccountId} with ${form.data.accountRole} role`);
      logger.info(`User created: ${newUser.id} by ${auth.user.email}`);

      await logAudit({
        actionType: AuditActionType.INSERT,
        tableName: 'User',
        recordId: newUser.id,
        oldData: null,
        newData: newUser,
        userId: auth!.user.id,
        ipAddress: locals.ipAddress,
        prisma: adminPrisma
      })

      await logAudit({
        actionType: AuditActionType.INSERT,
        tableName: 'AccountMembership',
        recordId: membership.id,
        oldData: null,
        newData: membership,
        userId: auth!.user.id,
        ipAddress: locals.ipAddress,
        prisma: adminPrisma
      })

      // Return success with the form data and success message
      return message(form, {
        type: 'success',
        text: 'User created successfully',
        details: `User ${newUser.name} has been created with email ${newUser.email}.`
      });

    } catch (err) {
      if (err instanceof Response) {
        throw err; // Re-throw redirects
      }

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
          errorMessage.details = 'A user with this email already exists.';
        } else if (err.code === 'P2003') {
          errorMessage.text = 'Invalid reference';
          errorMessage.details = 'One of the references in your request is invalid.';
        }
      }

      return message(form, errorMessage, { status: 400 });
    }
  }
}; 
