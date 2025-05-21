import type { EmailServiceProvider } from '@prisma/client';
import type { EmailOptions, EmailResult, IEmailProvider } from './types';
import { SmtpProvider } from './smtpProvider';
import { ResendProvider } from './resendProvider';
import { logger } from '$lib/server/logger';

/**
 * EmailService class for sending emails using different email service providers
 */
export class EmailService {
    private provider: IEmailProvider;

    /**
     * Create an EmailService instance with the specified provider
     * @param emailProvider The email service provider configuration
     */
    constructor(emailProvider: EmailServiceProvider) {
        this.provider = this.createProvider(emailProvider);
    }

    /**
     * Create the appropriate email provider based on the provider type
     * @param emailProvider The email service provider configuration
     * @returns An instance of the appropriate email provider
     */
    private createProvider(emailProvider: EmailServiceProvider): IEmailProvider {
        switch (emailProvider.type) {
            case 'smtp':
                return new SmtpProvider(emailProvider);
            case 'resend':
                return new ResendProvider(emailProvider);
            default:
                logger.error(`Unsupported email provider type: ${emailProvider.type}`);
                throw new Error(`Unsupported email provider type: ${emailProvider.type}`);
        }
    }

    /**
     * Send an email using the configured provider
     * @param options Email options including recipient, subject, and content
     * @returns Promise that resolves with the email sending result
     */
    async sendEmail(options: EmailOptions): Promise<EmailResult> {
        return this.provider.sendEmail(options);
    }

    /**
     * Send a test email
     * @param to Recipient email address
     * @param subject Email subject
     * @param message Email message (HTML content)
     * @returns Promise that resolves with the email sending result
     */
    async sendTestEmail(to: string, subject: string, message: string): Promise<EmailResult> {
        return this.sendEmail({
            to,
            subject,
            html: message,
            text: message.replace(/<[^>]*>/g, '') // Simple HTML to text conversion
        });
    }
}
