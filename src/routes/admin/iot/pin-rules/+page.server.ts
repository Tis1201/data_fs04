import { redirect, fail } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import prisma from '$lib/server/prisma';
import type { PageServerLoad, Actions } from './$types';

// Define table options for Pin Rules
const table_options = {
    modelName: 'pinRule',
    searchableFields: ['name', 'description', 'apps'],
    allowedFilters: ['ruleType', 'isActive'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Admin can only see admin-level rules
    baseWhere: {
        OR: [
            { ruleType: 'admin_default' },
            { ruleType: 'admin_custom' }
        ]
    }
};

export const load: PageServerLoad = restrict(
  async ({ url, locals, auth }: any) => {
    // Check if user has admin access
    if (auth.user.systemRole !== 'ADMIN') {
      throw redirect(302, '/dashboard');
    }

    try {
      // Use the reusable fetchTableData function with our table options
      const result = await fetchTableData(locals, url, table_options);
      
      return {
        user: auth.user,
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
  ['ADMIN'] // Restrict to admin users only
);

// Form actions (delete)
export const actions: Actions = {
  deletePinRule: restrict(async ({ request, auth }: any) => {
    if (auth.user.systemRole !== 'ADMIN') {
      return fail(403, { error: 'Forbidden' });
    }

    const form = await request.formData();
    const id = String(form.get('id') || '');
    if (!id) {
      return fail(400, { error: 'Missing id' });
    }

    const rule = await prisma.pinRule.findUnique({ where: { id }, select: { ruleType: true } });
    if (!rule) {
      return fail(404, { error: 'Rule not found' });
    }

    // Prevent deleting default rules (admin_default, user_default a.k.a account default)
    if (rule.ruleType === 'admin_default' || rule.ruleType === 'user_default') {
      return fail(400, { error: 'Default rules cannot be deleted' });
    }

    await prisma.pinRule.delete({ where: { id } });
    return { success: true };
  }, ['ADMIN'])
};
