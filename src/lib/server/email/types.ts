import type { EmailServiceProvider } from '@prisma/client';

/**
 * Interface for email sending options
 */
export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: EmailAttachment[];
}

/**
 * Interface for email attachments
 */
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

/**
 * Interface for email sending result
 */
export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: Error | string;
}

/**
 * Interface for email service providers
 */
export interface IEmailProvider {
    sendEmail(options: EmailOptions): Promise<EmailResult>;
}

/**
 * Factory function to create an email provider based on the provider type
 */
export type EmailProviderFactory = (provider: EmailServiceProvider) => IEmailProvider;
