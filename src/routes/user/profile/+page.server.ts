import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import { validatePassword } from '$lib/server/auth/password-validation';
import { hash, verify } from '@node-rs/argon2';

// Schema for profile editing
const profileEditSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional()
}).refine(
  (data) => {
    // If any password field is filled, require current password
    if (data.newPassword || data.confirmPassword) {
      return data.currentPassword && data.currentPassword.length > 0;
    }
    return true;
  },
  {
    message: "Current password is required to change password",
    path: ["currentPassword"]
  }
).refine(
  (data) => {
    // If new password is provided, require confirmation
    if (data.newPassword) {
      return data.confirmPassword === data.newPassword;
    }
    return true;
  },
  {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  }
);

export const load: PageServerLoad = async ({ locals }) => {
  try {
    // Get authenticated user
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      throw redirect(302, '/auth/login');
    }

    // Get user data from database
    const user = await locals.prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw error(404, 'User not found');
    }

    // Initialize the form with current user data
    const form = await superValidate(zod(profileEditSchema), {
      id: 'profile-edit-form',
      defaults: {
        email: user.email,
        name: user.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }
    });

    return { 
      form,
      user
    };
  } catch (err) {
    if (err instanceof Response) {
      throw err; // Re-throw redirects and HTTP errors
    }
    logger.error(`Error loading profile: ${err}`);
    throw error(500, 'Failed to load profile');
  }
};

export const actions: Actions = {
  update: async ({ request, locals }: { request: Request; locals: any }) => {
    const form = await superValidate(request, zod(profileEditSchema));
    
    try {
      // Get authenticated user
      const auth = await locals.auth.validate();
      if (!auth?.user) {
        throw redirect(302, '/auth/login');
      }
      
      // Perform additional custom validations
      let hasValidationErrors = !form.valid;
      
      // Check if email already exists (only if it's different from current)
      if (form.data.email && form.data.email !== auth.user.email) {
        const existingUser = await locals.prisma.user.findUnique({
          where: { email: form.data.email }
        });
        
        if (existingUser) {
          form.errors.email = ['A user with this email already exists'];
          hasValidationErrors = true;
        }
      }
      
      // Validate new password if provided
      if (form.data.newPassword) {
        const passwordValidation = await validatePassword(form.data.newPassword);
        
        if (!passwordValidation.valid) {
          form.errors.newPassword = [passwordValidation.error || 'Password does not meet security requirements'];
          hasValidationErrors = true;
        }
      }
      
      // Validate current password if password change is requested
      if (form.data.newPassword && form.data.currentPassword) {
        const currentUser = await locals.prisma.user.findUnique({
          where: { id: auth.user.id },
          select: { password: true }
        });
        
        if (!currentUser || !currentUser.password) {
          form.errors.currentPassword = ['Unable to verify current password'];
          hasValidationErrors = true;
        } else {
          const isCurrentPasswordValid = await verify(currentUser.password, form.data.currentPassword);
          
          if (!isCurrentPasswordValid) {
            form.errors.currentPassword = ['Current password is incorrect'];
            hasValidationErrors = true;
          }
        }
      }
      
      // Return all validation errors at once
      if (hasValidationErrors) {
        return fail(400, { form });
      }

      // Prepare update data
      const updateData: any = {
        email: form.data.email,
        name: form.data.name
      };

      // Add password hash if new password is provided
      if (form.data.newPassword) {
        updateData.password = await hash(form.data.newPassword);
      }

      // Update user in database
      const updatedUser = await locals.prisma.user.update({
        where: { id: auth.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          status: true,
          updatedAt: true
        }
      });

      logger.info(`User profile updated: ${updatedUser.id}`);

      // Clear password fields after successful update
      form.data.currentPassword = '';
      form.data.newPassword = '';
      form.data.confirmPassword = '';

      return message(form, {
        type: 'success',
        text: 'Profile updated successfully',
        details: 'Your profile information has been saved.'
      });

    } catch (err) {
      if (err instanceof Response) {
        throw err; // Re-throw redirects
      }
      
      logger.error(`Error updating profile: ${err}`);
      
      let errorMessage = {
        type: 'error' as const,
        text: 'Unable to update profile',
        details: 'An unexpected error occurred while updating your profile.'
      };
      
      // Handle specific error types
      if (err && typeof err === 'object' && 'code' in err) {
        if (err.code === 'P2002') {
          errorMessage.text = 'Email already exists';
          errorMessage.details = 'A user with this email already exists.';
        } else if (err.code === 'P2025') {
          errorMessage.text = 'User not found';
          errorMessage.details = 'Your user account could not be found.';
        }
      }
      
      return message(form, errorMessage, { status: 400 });
    }
  }
};
