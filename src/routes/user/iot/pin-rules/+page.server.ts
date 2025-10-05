import { redirect } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import type { PageServerLoad } from './$types';

// Define table options for Pin Rules (User)
const table_options = {
    modelName: 'pinRule',
    searchableFields: ['name', 'description', 'apps'],
    allowedFilters: ['ruleType', 'isActive'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10
};

export const load: PageServerLoad = restrict(
  async ({ url, locals, auth }: any) => {
    try {
      // Get user's account for scoping
      const membership = await locals.prisma.accountMembership.findFirst({
        where: { userId: auth.user.id },
        select: { accountId: true, role: true }
      });

      if (!membership) {
        return {
          user: auth.user,
          rules: [],
          meta: {
            pagination: {
              page: 1,
              per_page: 10,
              total_records: 0,
              total_pages: 0
            },
            sort: {
              field: 'createdAt',
              order: 'desc'
            },
            filters: {}
          }
        };
      }

      // Only show user_default for the user's account, and user_custom created by the user in their account
      const userTableOptions = {
        ...table_options,
        baseWhere: {
          OR: [
            { ruleType: 'user_default', accountId: membership.accountId },
            { ruleType: 'user_custom', accountId: membership.accountId, createdBy: auth.user.id }
          ]
        }
      };

      // Use the reusable fetchTableData function with our table options
      const result = await fetchTableData(locals, url, userTableOptions);
      
      return {
        user: auth.user,
        accountRole: membership.role,
        rules: result.records,
        meta: result.meta
      };
    } catch (error) {
      console.error('Error loading pin rules:', error);
      return {
        user: auth.user,
        rules: [],
        meta: {
          pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
          },
          sort: {
            field: 'createdAt',
            order: 'desc'
          },
          filters: {}
        }
      };
    }
  },
  ['USER'] // Restrict to regular users
);

// Server actions
export const actions = {
  deletePinRule: restrict(async ({ request, locals, auth }: any) => {
    try {
      const formData = await request.formData();
      const id = formData.get('id');

      if (!id) {
        return {
          success: false,
          message: 'Pin rule ID is required'
        };
      }

      // Get the rule to check permissions and type
      const rule = await locals.prisma.pinRule.findUnique({
        where: { id: id as string }
      });

      if (!rule) {
        return {
          success: false,
          message: 'Pin rule not found'
        };
      }

      // Prevent deletion of default rules
      if (rule.ruleType === 'admin_default' || rule.ruleType === 'user_default') {
        return {
          success: false,
          message: 'Cannot delete default rules'
        };
      }

      // Check if user has permission to delete (must be creator for user_custom)
      if (rule.ruleType === 'user_custom' && rule.createdBy !== auth.user.id) {
        return {
          success: false,
          message: 'You do not have permission to delete this rule'
        };
      }

      // Delete the rule
      await locals.prisma.pinRule.delete({
        where: { id: id as string }
      });

      return {
        success: true,
        message: 'Pin rule deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting pin rule:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete pin rule'
      };
    }
  }, ['USER'])
};
