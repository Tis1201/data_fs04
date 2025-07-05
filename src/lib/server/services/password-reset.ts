import { hash } from '@node-rs/argon2';
import { logger } from '$lib/server/logger';
import { EmailService } from '$lib/server/email';
import { generateSecurePassword } from '$lib/utils/generate-password';
import { generatePasswordResetEmail } from '../templates/email/password-reset';
import type { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

export interface PasswordResetOptions {
  userId: string;
  userEmail: string;
  userName?: string;
  prisma: PrismaClient;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
  details?: string;
  tempPassword?: string;
  email?: string;
  messageId?: string;
}

export async function resetUserPassword(options: PasswordResetOptions): Promise<PasswordResetResult> {
  const { 
    userId, 
    userEmail, 
    userName = 'User',
    prisma 
  } = options;

  try {
    // Generate a temporary password
    const tempPassword = generateSecurePassword();
    
    // Hash the temporary password using Argon2
    const hashedPassword = await hash(tempPassword);
    logger.debug('Password hashed successfully for reset', { 
      userId,
      passwordLength: tempPassword.length 
    });

    // Update the user's password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Send email with temporary password
    try {
      // Get an active email provider
      const defaultProvider = await prisma.emailServiceProvider.findFirst({
        where: { 
          isActive: true
        }
      });

      if (!defaultProvider) {
        logger.warn('No active email provider found, password reset completed but no email sent');
        return {
          success: true, 
          message: 'Password reset successfully',
          details: `Password has been reset for ${userName}, but no email could be sent. Please provide the temporary password manually.`,
          tempPassword: tempPassword // Remove this in production
        };
      }

      // Create an instance of the EmailService with the provider
      const emailService = new EmailService(defaultProvider);
      
      // Generate email content using template
      const emailContent = generatePasswordResetEmail({
        userName,
        userEmail,
        tempPassword,
        loginUrl: env.LOGIN_URL
      });
      
      // Send the password reset email
      const result = await emailService.sendEmail({
        to: userEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });
      
      if (!result.success) {
        const errorMessage = result.error instanceof Error 
          ? result.error.message 
          : String(result.error);
        
        logger.error(`Failed to send password reset email: ${errorMessage}`);
        return {
          success: true,
          message: 'Password reset completed but failed to send email',
          details: `Password has been reset but email could not be sent: ${errorMessage}`,
          tempPassword: tempPassword // Remove this in production
        };
      }
      
      // Email sent successfully
      logger.info(`Password reset email sent successfully to ${userEmail} using provider ${defaultProvider.name}`);
      
      // Update the email provider's usage stats
      await prisma.emailServiceProvider.update({
        where: { id: defaultProvider.id },
        data: {
          lastUsedAt: new Date(),
          totalSent: { increment: 1 }
        }
      });

      // Return success response
      return {
        success: true,
        message: 'Password reset successfully',
        details: `A temporary password has been sent to ${userEmail}. The user should check their email for login instructions.`,
        email: userEmail,
        messageId: result.messageId || 'N/A'
      };

    } catch (emailError) {
      // Log email error but don't fail the password reset
      logger.error('Failed to send password reset email:', { error: emailError });
      
      return {
        success: true,
        message: 'Password reset successfully',
        details: `Password has been reset for ${userName}, but the email could not be sent. Please provide the temporary password manually.`,
        tempPassword: tempPassword // Remove this in production
      };
    }

  } catch (error) {
    logger.error('Error resetting password:', { error: error });
    return {
      success: false, 
      message: 'Failed to reset password'
    };
  }
} 