import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // Validate session and get user directly from auth
    const session = await locals.auth.validate();
    if (!session?.user) {
        throw redirect(302, '/auth/login');
    }

    // For user section, we allow any authenticated user (no admin check)
    const user = session.user;
    const { currentAccount, accountMemberships } = locals;
    
    // If user has no account access, redirect to a page explaining the issue
    if (!accountMemberships || accountMemberships.length === 0) {
        // This could redirect to a "no-accounts" page explaining how to get account access
        // For now, we'll just return the user data without account context
        return {
            user: {
                id: user.id,
                email: user.email,
                systemRole: user.systemRole
            },
            currentAccount: null,
            accountMemberships: []
        };
    }

    return {
        user: {
            id: user.id,
            email: user.email,
            systemRole: user.systemRole
        },
        // Current account data
        currentAccount: currentAccount ? {
            id: currentAccount.account.id,
            name: currentAccount.account.name,
            slug: currentAccount.account.slug,
            role: currentAccount.role
        } : null,
        
        // All account memberships
        accountMemberships: accountMemberships ? accountMemberships.map(m => ({
            id: m.id,
            role: m.role,
            account: {
                id: m.account.id,
                name: m.account.name,
                slug: m.account.slug
            }
        })) : []
    };
};
