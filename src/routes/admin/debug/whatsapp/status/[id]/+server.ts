import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ params, locals }) => {
    // Validate user is authenticated and is an admin
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        return new Response('Unauthorized', { status: 403 });
    }

    const accountId = params.id;
    if (!accountId) {
        return json({ status: 'error', message: 'Account ID is required' }, { status: 400 });
    }

    try {
        // Get enhanced prisma client with admin privileges
        const prisma = getEnhancedPrisma({
            id: auth.user.id,
            systemRole: auth.user.systemRole
        });
        
        // Get the WhatsApp account with its status
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                phoneNumber: true,
                description: true,
                name: true,
                client_id: true,
                client_status: true
            }
        });
        
        if (!account) {
            return json({ status: 'error', message: 'Account not found' }, { status: 404 });
        }
        
        return json({
            status: 'success',
            account
        });
    } catch (error) {
        console.error('Error fetching WhatsApp account status:', error);
        return json({ status: 'error', message: 'Failed to fetch account status' }, { status: 500 });
    }
};
