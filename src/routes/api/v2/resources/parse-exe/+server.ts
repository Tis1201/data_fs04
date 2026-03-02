/**
 * POST /api/v2/resources/parse-exe
 * Parse Windows EXE metadata from filename conventions.
 *
 * JSON body:  { objectPath, bucket? }   — filename is extracted from objectPath
 * FormData:   file (File)               — filename is taken from file.name
 *
 * No file download is needed; metadata is derived from the filename only.
 */
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { parseExeFromGcsPath, parseExeFilename } from '$lib/server/parsers/exe';
import type { ExeMetadata } from '$lib/server/parsers/exe';
import { logger } from '$lib/server/logger';

function toOut(metadata: ExeMetadata) {
    return {
        packageName: metadata.packageName,
        version: metadata.version,
        description: metadata.description,
        architecture: metadata.architecture ?? null
    };
}

export const POST = unifiedEndpoint(
    async ({ event }) => {
        const contentType = event.request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const body = await event.request.json();
            const { objectPath } = body;

            if (!objectPath || typeof objectPath !== 'string') {
                throw Object.assign(new Error('objectPath is required'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }
            if (!objectPath.toLowerCase().endsWith('.exe')) {
                throw Object.assign(new Error('objectPath must point to an .exe file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }

            try {
                const metadata = parseExeFromGcsPath(objectPath);
                return successResponse(toOut(metadata));
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('[EXE Parser v2] parse-exe failed', { objectPath, error: msg });
                throw err;
            }
        }

        if (contentType.includes('multipart/form-data')) {
            const formData = await event.request.formData();
            const file = formData.get('file') as File | null;
            if (!file || !(file instanceof File)) {
                throw Object.assign(new Error('FormData must include a file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }
            if (!file.name.toLowerCase().endsWith('.exe')) {
                throw Object.assign(new Error('File must be an .exe file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }

            try {
                const metadata = parseExeFilename(file.name);
                return successResponse(toOut(metadata));
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('[EXE Parser v2] FormData parse failed', { fileName: file.name, error: msg });
                throw err;
            }
        }

        throw Object.assign(
            new Error('Request must be application/json (objectPath) or multipart/form-data (file)'),
            { status: 400, code: ErrorCodes.INVALID_INPUT }
        );
    },
    { permission: 'upload.create' }
);
