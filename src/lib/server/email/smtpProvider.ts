import type { EmailServiceProvider } from '@prisma/client';
import type { EmailOptions, EmailResult, IEmailProvider } from './types';
import { logger } from '$lib/server/logger';
import nodemailer from 'nodemailer';

/**
 * SMTP Email Provider implementation
 */
export class SmtpProvider implements IEmailProvider {
    private provider: EmailServiceProvider;
    private transport: any;

    constructor(provider: EmailServiceProvider) {
        this.provider = provider;
        this.initTransport();
    }

    /**
     * Initialize the SMTP transport
     */
    private initTransport(): void {
        try {
            // Use the specific SMTP fields from the provider model
            // Default values for development environment
            const host = this.provider.smtpHost || 'localhost';
            const port = this.provider.smtpPort || 1025; // Default to MailDev port for testing
            
            // For localhost testing (MailDev), we should never use SSL
            const isLocalhost = host === 'localhost' || host === '127.0.0.1';
            
            // Use the smtpSecure field from the schema, but force it to false for localhost
            // The field has a default value of true in the schema
            const secure = isLocalhost ? false : (this.provider.smtpSecure !== false);
            
            // Use the smtpAuth field from the schema, but force it to false for localhost
            // The field has a default value of true in the schema
            const useAuth = isLocalhost ? false : (this.provider.smtpAuth !== false);
            
            // Create transport options
            const transportOptions: any = {
                host,
                port,
                secure
            };
            
            // Only add auth if authentication is enabled and credentials are provided
            if (useAuth && this.provider.smtpUser && this.provider.smtpPass) {
                transportOptions.auth = {
                    user: this.provider.smtpUser,
                    pass: this.provider.smtpPass
                };
            }
            
            // Log transport configuration (without sensitive data)
            logger.info(`Initializing SMTP transport for ${this.provider.name} with host ${host}:${port}`);
            
            // Create nodemailer transport
            this.transport = nodemailer.createTransport(transportOptions);
        } catch (error) {
            logger.error(`Failed to initialize SMTP transport: ${error.message}`, { error });
            throw new Error(`Failed to initialize SMTP transport: ${error.message}`);
        }
    }

    /**
     * Send an email using SMTP
     */
    async sendEmail(options: EmailOptions): Promise<EmailResult> {
        try {
            // Validate the transport
            if (!this.transport) {
                throw new Error('SMTP transport not initialized');
            }

            // Validate required fields
            if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
                throw new Error('No recipients defined');
            }

            if (!this.provider.fromEmail) {
                throw new Error('From email address is required');
            }

            // Send email
            const result = await this.transport.sendMail({
                from: this.provider.fromName 
                    ? `${this.provider.fromName} <${this.provider.fromEmail}>` 
                    : this.provider.fromEmail,
                to: options.to,
                cc: options.cc,
                bcc: options.bcc,
                replyTo: options.replyTo,
                subject: options.subject,
                html: options.html,
                text: options.text,
                attachments: options.attachments
            });

            logger.info(`Email sent via SMTP: ${result.messageId}`);
            return {
                success: true,
                messageId: result.messageId
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`SMTP email error: ${errorMessage}`, { error });
            return {
                success: false,
                error
            };
        }
    }
}
