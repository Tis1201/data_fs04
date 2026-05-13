import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { resourceSchema } from '../new/resource';
import { createErrorResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';
import { loadResourceDetail } from '$lib/server/resources/resourceLoader';
import { createResourceActions } from '$lib/server/resources/resourceActions';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';

/**
 * Load resource detail data
 * Per structural standard: thin wrapper using shared loader
 */
export const load = restrict(
    async ({ params, locals, depends }: AuthenticatedLoadEvent) => {
        const { id } = params;
        if (!id) {
            throw new Error('Resource ID is required');
        }

        // Add depends call for cache invalidation
        depends('app:resources');

        return await loadResourceDetail(locals, id, {
            includeFormData: true,
            includeAccountOptions: true,
            includeResourceTypes: true
        });
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

/**
 * Resource actions
 * Per structural standard: thin wrapper using shared actions factory
 */
export const actions: Actions = {
    update: restrict(
        async ({ params, request, locals, auth }: AuthenticatedEvent) => {
            const { id } = params;
            if (!id) {
                return fail(400, { error: 'Resource ID is required' });
            }
            const resourceActions = createResourceActions();
            return await resourceActions.update({ params: { id }, request, locals, auth });
        },
        [SystemRole.ADMIN]
    ),
    delete: restrict(
        async ({ params, request, locals }: AuthenticatedEvent) => {
            const { id } = params;
            if (!id) {
                return fail(400, { error: 'Resource ID is required' });
            }
            const resourceActions = createResourceActions();
            return await resourceActions.delete({ params: { id }, request, locals });
        },
        [SystemRole.ADMIN]
    )
};
