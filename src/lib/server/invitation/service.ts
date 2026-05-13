import { randomBytes, createHash } from 'crypto';
import { addDays } from 'date-fns';
import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { EmailService } from '$lib/server/email/emailService';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * Generate a secure invitation token and store it in the database
 * @param prisma The Prisma client instance
 * @param userId The ID of the user to create the token for
 * @param expirationDays Number of days until the token expires
 * @returns The created invitation token record
 */
export async function createInvitationToken(
  prisma: PrismaClient, 
  userId: string, 
  expirationDays: number = 7
) {
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
    rawToken: randomToken,
    hashedToken: hashedToken
  };
}

/**
 * Create an invitation for a new user (email-based)
 * @param email Email address for the invitation
 * @param inviterId ID of the user creating the invitation
 * @param prisma Prisma client
 * @returns The created invitation token and user data
 */
export async function createInvitation(
  email: string, 
  inviterId: string, 
  prisma: PrismaClient,
  userRoles: string = 'USER',
  userName?: string
) {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    throw new Error(`User with email ${email} already exists`);
  }
  
  // Create user record with INACTIVE status
  const newUser = await prisma.user.create({
    data: {
      email,
      name: userName || '',
      systemRole: userRoles,
      status: 'INACTIVE', // User is inactive until they accept the invitation
      rolesString: userRoles.toLowerCase(),
      password: 'temp-password-will-be-set-on-invitation-acceptance'
    }
  });
  
  // Create invitation token
  const invitation = await createInvitationToken(prisma, newUser.id, 7);
  
  logger.info(`Invitation created for ${email} by user ${inviterId}`);
  
  return {
    user: newUser,
    invitation
  };
}

/**
 * Send invitation email
 * @param email Recipient email
 * @param token Raw invitation token
 * @param userName Optional user name
 * @param inviterName Name of the person sending the invitation
 * @param prisma Prisma client for getting email provider
 */
export async function sendInvitationEmail(
  email: string, 
  token: string, 
  userName?: string,
  inviterName?: string,
  prisma?: PrismaClient
) {
  if (!prisma) {
    throw new Error('Prisma client is required for sending emails');
  }
  
  // Get the default email provider
  const emailProvider = await prisma.emailServiceProvider.findFirst({
    where: {
      isDefault: true,
      isActive: true
    }
  });

  console.log("emailProvider");
  console.log(emailProvider);
  
  if (!emailProvider) {
    throw new Error('No active email provider found');
  }
  
  // Create email service instance
  const emailService = new EmailService(emailProvider);
  
  // Generate invitation URL
  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const invitationUrl = `${baseUrl}/user/invite?token=${token}`;
  
  // Create email content
  const subject = `You're invited to join our platform`;
  const recipientName = userName || email;
  const inviterText = inviterName ? `${inviterName} has invited you` : 'You have been invited';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invitation to Join</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6c757d; }
        .button { 
          display: inline-block; 
          background: #007bff; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          font-weight: bold;
          margin: 20px 0;
        }
        .button:hover { background: #0056b3; }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          padding: 15px; 
          border-radius: 6px; 
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #007bff;">You're Invited!</h1>
        </div>
        
        <div class="content">
          <p>Hello ${recipientName},</p>
          
          <p>${inviterText} to join our platform. Click the button below to accept your invitation and set up your account.</p>
          
          <div style="text-align: center;">
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
            ${invitationUrl}
          </p>
          
          <div class="warning">
            <strong>Important:</strong> This invitation link will expire in 7 days. If you don't accept it by then, you'll need to request a new invitation.
          </div>
          
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message. Please don't reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    Hello ${recipientName},
    
    ${inviterText} to join our platform. 
    
    Please visit the following link to accept your invitation and set up your account:
    ${invitationUrl}
    
    This invitation link will expire in 7 days.
    
    If you didn't expect this invitation, you can safely ignore this email.
  `;
  
  // Send the email
  const result = await emailService.sendEmail({
    to: email,
    subject,
    html,
    text
  });
  
  if (!result.success) {
    throw new Error(`Failed to send invitation email: ${result.error}`);
  }
  
  logger.info(`Invitation email sent to ${email}`);
  return result;
}

/**
 * Validate and retrieve invitation token
 * @param token Raw token from URL
 * @param prisma Prisma client
 * @returns Invitation token data with user info
 */
export async function validateInvitationToken(token: string, prisma: PrismaClient) {
  // Hash the token to compare with stored version
  const hashedToken = createHash('sha256').update(token).digest('hex');
  
  // Find the invitation token
  const invitation = await prisma.invitationToken.findUnique({
    where: { token: hashedToken },
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
    }
  });
  
  if (!invitation) {
    throw new Error('Invalid invitation token');
  }
  
  // Check if token has expired
  if (invitation.expiresAt < new Date()) {
    throw new Error('Invitation token has expired');
  }
  
  // Check if token has already been used
  if (invitation.usedAt) {
    throw new Error('Invitation token has already been used');
  }
  
  return invitation;
}

/**
 * Accept invitation and complete user setup
 * @param token Raw token from URL
 * @param password New password for the user
 * @param prisma Prisma client
 * @param userName Optional user name
 * @param ipAddress IP address of the user accepting the invitation
 * @returns Updated user data
 */
export async function acceptInvitation(
  token: string, 
  password: string, 
  prisma: PrismaClient,
  userName?: string,
  ipAddress?: string
) {
  // Validate the invitation token
  const invitation = await validateInvitationToken(token, prisma);
  
  // Get the existing invitation token data for audit log
  const existingInvitationToken = await prisma.invitationToken.findUnique({
    where: { id: invitation.id }
  });
  
  // Hash the password (you'll need to import your password hashing function)
  const { hash } = await import('@node-rs/argon2');
  const hashedPassword = await hash(password);
  
  // Update the user with the new password and activate the account
  const updatedUser = await prisma.user.update({
    where: { id: invitation.user.id },
    data: {
      password: hashedPassword,
      name: userName || invitation.user.name,
      status: 'ACTIVE'
    },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      status: true
    }
  });
  
  // Mark the invitation token as used
  const updatedInvitationToken = await prisma.invitationToken.update({
    where: { id: invitation.id },
    data: { usedAt: new Date() }
  });
  
  // Log audit for invitation token acceptance (UPDATE)
  await logAudit({
    actionType: AuditActionType.UPDATE,
    tableName: 'InvitationToken',
    recordId: invitation.id,
    oldData: existingInvitationToken,
    newData: updatedInvitationToken,
    userId: invitation.user.id,
    ipAddress: ipAddress || 'unknown',
    prisma
  });
  
  logger.info(`User ${updatedUser.email} accepted invitation and activated account`);
  
  return updatedUser;
} 
