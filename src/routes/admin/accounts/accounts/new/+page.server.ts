import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrictModule, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { accountEditSchema } from '../schema';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { createAccountSystemRule } from '$lib/server/pin-rules/createAccountSystemRule';

export const load = restrictModule(
    async ({ locals }: { locals: any }) => {
        // Initialize the account creation form with the schema and defaults
        const form = await superValidate(zod(accountEditSchema), {
            defaults: {
                name: '',
                slug: '',
                description: '',
                status: 'ACTIVE' as const
            }
        });

        return {
            form
        };
    },
    'ACCOUNTS',
    { action: 'CREATE' }
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for creating a new account using Superforms
    createAccount: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
        // Validate the form data against the schema
        const form = await superValidate(request, zod(accountEditSchema));

        // If validation fails, return the form with errors
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            // Check if an account with the same slug already exists
            const existingAccount = await locals.prisma.account.findUnique({
                where: { slug: form.data.slug }
            });

            if (existingAccount) {
                return message(form, {
                    type: 'error',
                    text: 'Account with this slug already exists',
                    details: 'Please choose a different slug',
                    code: 'SLUG_EXISTS',
                    timestamp: new Date().toISOString()
                }, { status: 400 });
            }

            // Create the new account
            const account = await locals.prisma.account.create({
                data: {
                    name: form.data.name,
                    slug: form.data.slug,
                    description: form.data.description || null,
                    status: form.data.status
                }
            });

            // Create per-account system rule (always active, cannot delete)
            await createAccountSystemRule(locals.prisma, account.id, locals.user?.id ?? '');

            // Log the account creation
            logger.info(`Account created: ${account.id} (${account.name})`);
            
            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'Account',
                recordId: account.id,
                oldData: null,
                newData: account,
                userId: locals.user?.id ?? '',
                ipAddress: (locals as any).ipAddress ?? 'unknown',
                prisma: locals.prisma
            })

            // Return success with the created account
            return { 
                form,
                success: true, 
                account
            };
        } catch (err: any) {
            logger.error('Error creating account:', err);
            
            return message(form, {
                type: 'error',
                text: 'Failed to create account',
                details: err instanceof Error ? err.message : 'Unknown error',
                code: 'CREATE_FAILED',
                timestamp: new Date().toISOString()
            }, { status: 500 });
        }
    },
        'ACCOUNTS',
        { action: 'CREATE' }
    )
};
