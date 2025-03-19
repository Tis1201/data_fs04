import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'crypto';

// Generate a secure random API key
function generateApiKey(length = 32): string {
    return randomBytes(length).toString('hex');
}

// GET a specific API key
export const GET: RequestHandler = async ({ locals, params }) => {
    const { auth } = locals;
    const session = await auth.validate();

    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const apiKey = await locals.prisma.apiKey.findUnique({
            where: {
                id: params.id
            }
        });

        if (!apiKey) {
            return json({ error: 'API key not found' }, { status: 404 });
        }

        // Check if the user owns this API key or is an admin
        if (apiKey.userId !== session.user.id && session.user.systemRole !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        return json({ apiKey });
    } catch (error) {
        console.error('Error fetching API key:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
};

// PATCH to update an API key
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
    const { auth } = locals;
    const session = await auth.validate();

    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // First check if the API key exists and belongs to the user
        const existingKey = await locals.prisma.apiKey.findUnique({
            where: {
                id: params.id
            }
        });

        if (!existingKey) {
            return json({ error: 'API key not found' }, { status: 404 });
        }

        // Check if the user owns this API key or is an admin
        if (existingKey.userId !== session.user.id && session.user.systemRole !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, active, expiresAt, regenerate } = body;

        let updateData: any = {
            name,
            description,
            active,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        };

        // If regenerate is true, generate a new API key
        let newKeyValue = null;
        if (regenerate) {
            newKeyValue = generateApiKey();
            updateData.key = newKeyValue;
        }

        const updatedApiKey = await locals.prisma.apiKey.update({
            where: {
                id: params.id
            },
            data: updateData
        });

        return json({
            success: true,
            apiKey: {
                ...updatedApiKey,
                key: newKeyValue // Only include the new key if regenerated
            }
        });
    } catch (error) {
        console.error('Error updating API key:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
};

// DELETE an API key
export const DELETE: RequestHandler = async ({ locals, params }) => {
    const { auth } = locals;
    const session = await auth.validate();

    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // First check if the API key exists and belongs to the user
        const existingKey = await locals.prisma.apiKey.findUnique({
            where: {
                id: params.id
            }
        });

        if (!existingKey) {
            return json({ error: 'API key not found' }, { status: 404 });
        }

        // Check if the user owns this API key or is an admin
        if (existingKey.userId !== session.user.id && session.user.systemRole !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        await locals.prisma.apiKey.delete({
            where: {
                id: params.id
            }
        });

        return json({ success: true });
    } catch (error) {
        console.error('Error deleting API key:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
};
