import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'crypto';

// Generate a secure random API key
function generateApiKey(length = 32): string {
    return randomBytes(length).toString('hex');
}

export const GET: RequestHandler = async ({ locals }) => {
    const { auth } = locals;
    const session = await auth.validate();

    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const apiKeys = await locals.prisma.apiKey.findMany({
            where: {
                userId: session.user.id
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return json({ apiKeys });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
};

export const POST: RequestHandler = async ({ locals, request }) => {
    const { auth } = locals;
    const session = await auth.validate();

    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, expiresAt } = body;

        if (!name) {
            return json({ error: 'Name is required' }, { status: 400 });
        }

        const apiKey = generateApiKey();

        const newApiKey = await locals.prisma.apiKey.create({
            data: {
                key: apiKey,
                name,
                description,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                userId: session.user.id
            }
        });

        return json({
            success: true,
            apiKey: {
                ...newApiKey,
                key: apiKey // Include the plaintext key in the response
            }
        });
    } catch (error) {
        console.error('Error creating API key:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
};
