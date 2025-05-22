import type { EmailServiceProvider } from '@prisma/client';
import type { EmailOptions, EmailResult, IEmailProvider } from './types';
import { logger } from '$lib/server/logger';
import { Resend } from 'resend';

/**
 * Resend Email Provider implementation
 */
export class ResendProvider implements IEmailProvider {
    private provider: EmailServiceProvider;
    private apiKey: string;

    constructor(provider: EmailServiceProvider) {
        this.provider = provider;
        this.initConfig();
    }

    /**
     * Initialize the Resend configuration
     */
    private initConfig(): void {
        try {
            // Get API key directly from the provider
            this.apiKey = this.provider.apiKey;
            
            if (!this.apiKey) {
                throw new Error('Resend API key is required');
            }
        } catch (error) {
            logger.error(`Failed to initialize Resend config: ${error.message}`, { error });
            throw new Error(`Failed to initialize Resend config: ${error.message}`);
        }
    }

    /**
     * Send an email using Resend
     */
    async sendEmail(options: EmailOptions): Promise<EmailResult> {
        try {
            // Validate the API key
            if (!this.apiKey) {
                throw new Error('Resend API key not initialized');
            }

            // Initialize the Resend client
            const resend = new Resend(this.apiKey);
            
            // Prepare the from address with name if available
            const from = this.provider.fromName
                ? `${this.provider.fromName} <${this.provider.fromEmail}>`
                : this.provider.fromEmail;
            
            // Prepare recipients
            const to = Array.isArray(options.to) ? options.to : [options.to];
            
            // Log the email sending attempt
            logger.info(`Sending email via Resend to ${to.join(', ')}`);
            
            // Send the email using Resend API
            const result = await resend.emails.send({
                from,
                to,
                subject: options.subject,
                html: options.html,
                text: options.text,
                cc: options.cc,
                bcc: options.bcc,
                reply_to: options.replyTo,
                attachments: options.attachments?.map(attachment => ({
                    filename: attachment.filename,
                    content: attachment.content
                }))
            });
            
            // Log success and return result
            logger.info(`Email sent successfully via Resend with ID: ${result.id}`);
            return {
                success: true,
                messageId: result.id
            };
        } catch (error) {
            logger.error(`Resend email error: ${error.message}`, { error });
            return {
                success: false,
                error
            };
        }
    }
}
