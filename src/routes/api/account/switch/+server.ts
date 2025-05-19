import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/permissions';

export const POST = async ({ request, locals }) => {
    // Ensure user is authenticated
    requireAuth(locals);
    
    try {
        const data = await request.json();
        const { accountId } = data;
        
        if (!accountId) {
            return json({ success: false, message: 'Account ID is required' }, { status: 400 });
        }
        
        // Use the auth middleware's switchAccount method
        const success = await locals.auth.switchAccount(accountId);
        
        if (!success) {
            return json({ 
                success: false, 
                message: 'Failed to switch account. You may not have access to this account.' 
            }, { status: 403 });
        }
        
        // Return the new account information
        const auth = await locals.auth.validate();
        
        return json({ 
            success: true, 
            account: auth?.currentAccount ? {
                id: auth.currentAccount.account.id,
                name: auth.currentAccount.account.name,
                slug: auth.currentAccount.account.slug,
                role: auth.currentAccount.role
            } : null
        });
    } catch (error) {
        console.error('Error switching account:', error);
        return json({ 
            success: false, 
            message: 'An error occurred while switching accounts' 
        }, { status: 500 });
    }
};
