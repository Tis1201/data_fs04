import { hash } from '@node-rs/argon2';
import { logger } from '$lib/server/logger';
import { EmailService } from '$lib/server/email';
import { generateSecurePassword } from '$lib/utils/generate-password';
import { generateWelcomeEmail } from '../templates/email/welcome';
import type { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

export interface UserCreationOptions {
  email: string;
  name: string;
  accountId: string;
  accountRole: 'MEMBER' | 'ADMIN' | 'OWNER';
  status?: 'ACTIVE' | 'INACTIVE';
  systemRole?: 'USER' | 'ADMIN';
  sendWelcomeEmail?: boolean;
  prisma: PrismaClient;
  adminPrisma: PrismaClient;
}

export interface UserCreationResult {
  success: boolean;
  message: string;
  details?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    systemRole: string;
    status: string;
  };
  tempPassword?: string;
  email?: string;
  messageId?: string;
}

export async function createUser(options: UserCreationOptions): Promise<UserCreationResult> {
  const { 
    email,
    name,
    accountId,
    accountRole,
    status = 'ACTIVE',
    systemRole = 'USER',
    sendWelcomeEmail = true,
    prisma,
    adminPrisma
  } = options;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return {
        success: false,
        message: 'User already exists',
        details: 'A user with this email already exists.'
      };
    }

    // Generate a secure password
    const tempPassword = generateSecurePassword();
    
    // Hash the password using Argon2
    const hashedPassword = await hash(tempPassword);
    logger.debug('Password hashed successfully for new user', { 
      email,
      passwordLength: tempPassword.length 
    });

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        systemRole,
        status,
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
    
    // Add the user to the account with the specified role
    await adminPrisma.accountMembership.create({
      data: {
        userId: newUser.id,
        accountId,
        role: accountRole
      }
    });
    
    logger.info(`User ${newUser.id} created and added to account ${accountId} with ${accountRole} role`);

    // Send welcome email if requested
    if (sendWelcomeEmail) {
      try {
        // Get account name for the email
        const account = await adminPrisma.account.findUnique({
          where: { id: accountId },
          select: { name: true }
        });

        // Get an active email provider
        const defaultProvider = await adminPrisma.emailServiceProvider.findFirst({
          where: { 
            isActive: true
          }
        });

        if (!defaultProvider) {
          logger.warn('No active email provider found, user created but no welcome email sent');
          return {
            success: true,
            message: 'User created successfully',
            details: `User ${newUser.name} has been created with email ${newUser.email}. No welcome email could be sent.`,
            user: newUser,
            tempPassword: tempPassword // Remove this in production
          };
        }

        // Create an instance of the EmailService with the provider
        const emailService = new EmailService(defaultProvider);
        
        // Generate welcome email content using template
        const emailContent = generateWelcomeEmail({
          userName: newUser.name || newUser.email,
          userEmail: newUser.email,
          tempPassword,
          loginUrl: env.LOGIN_URL,
          accountName: account?.name
        });
        
        // Send the welcome email
        const result = await emailService.sendEmail({
          to: newUser.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
        
        if (!result.success) {
          const errorMessage = result.error instanceof Error 
            ? result.error.message 
            : String(result.error);
          
          logger.error(`Failed to send welcome email: ${errorMessage}`);
          return {
            success: true,
            message: 'User created successfully',
            details: `User ${newUser.name} has been created, but the welcome email could not be sent: ${errorMessage}`,
            user: newUser,
            tempPassword: tempPassword // Remove this in production
          };
        }
        
        // Email sent successfully
        logger.info(`Welcome email sent successfully to ${newUser.email} using provider ${defaultProvider.name}`);
        
        // Update the email provider's usage stats
        await adminPrisma.emailServiceProvider.update({
          where: { id: defaultProvider.id },
          data: {
            lastUsedAt: new Date(),
            totalSent: { increment: 1 }
          }
        });

        // Return success response
        return {
          success: true,
          message: 'User created successfully',
          details: `User ${newUser.name} has been created with email ${newUser.email}. A welcome email has been sent.`,
          user: newUser,
          email: newUser.email,
          messageId: result.messageId || 'N/A'
        };

      } catch (emailError) {
        // Log email error but don't fail the user creation
        logger.error('Failed to send welcome email:', { error: emailError });
        
        return {
          success: true,
          message: 'User created successfully',
          details: `User ${newUser.name} has been created, but the welcome email could not be sent.`,
          user: newUser,
          tempPassword: tempPassword // Remove this in production
        };
      }
    } else {
      // No welcome email requested
      return {
        success: true,
        message: 'User created successfully',
        details: `User ${newUser.name} has been created with email ${newUser.email}.`,
        user: newUser,
        tempPassword: tempPassword // Remove this in production
      };
    }

  } catch (error) {
    logger.error('Error creating user:', { error: error });
    return {
      success: false, 
      message: 'Failed to create user',
      details: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 