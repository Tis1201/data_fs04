import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStorageConfig } from '$lib/server/storage';

export const GET: RequestHandler = async () => {
    try {
        const config = getStorageConfig();
        
        // Only expose the mode to the frontend, not sensitive configuration
        return json({
            mode: config.mode,
            requiresPresignedUrl: config.mode === 'LOCAL_CLOUD' || config.mode === 'GCLOUD'
        });
    } catch (error) {
        return json(
            { 
                error: 'Failed to get storage configuration',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
