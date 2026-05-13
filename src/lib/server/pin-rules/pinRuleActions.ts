import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

/**
 * Create pin rule actions factory
 * Per structural standard: create{Resource}Actions pattern
 */
export function createPinRuleActions(options?: {
    checkOwnership?: boolean;
}): {
    deletePinRule: (args: { request: Request; locals: any; auth: any }) => Promise<any>;
} {
    return {
        /**
         * Delete pin rule action
         * Prevents deletion of default rules
         */
        deletePinRule: async ({ request, locals, auth }: { request: Request; locals: any; auth: any }) => {
            try {
                const formData = await request.formData();
                const id = formData.get('id')?.toString();

                if (!id) {
                    return fail(400, { error: 'Pin rule ID is required' });
                }

                // Get the rule to check permissions and type
                const rule = await locals.prisma.pinRule.findUnique({
                    where: { id },
                    select: { ruleType: true, createdBy: true, accountId: true }
                });

                if (!rule) {
                    return fail(404, { error: 'Pin rule not found' });
                }

                // Prevent deletion of default rules
                if (rule.ruleType === 'admin_default' || rule.ruleType === 'user_default') {
                    return fail(400, { error: 'Default rules cannot be deleted' });
                }

                // Check ownership if needed
                if (options?.checkOwnership) {
                    // For user_custom rules, user must be the creator
                    if (rule.ruleType === 'user_custom' && rule.createdBy !== auth.user.id) {
                        return fail(403, { error: 'You do not have permission to delete this rule' });
                    }
                }

                // Delete the rule
                await locals.prisma.pinRule.delete({
                    where: { id }
                });

                logger.info(`Pin rule ${id} deleted by user ${auth.user.id}`);

                return { success: true, message: 'Pin rule deleted successfully' };
            } catch (err) {
                logger.error(`Error deleting pin rule: ${JSON.stringify(err)}`);
                return fail(500, { error: 'An unexpected error occurred' });
            }
        }
    };
}

