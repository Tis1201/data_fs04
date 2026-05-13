/**
 * POST /api/v2/resources/parse-deb
 * Parse DEB metadata. Preferred: JSON { objectPath, bucket? } (file in GCS).
 * Fallback (e.g. local mode): FormData with 'file'.
 * Callable by both admin and user roles with upload.create permission.
 */
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { parseDebFromCloud, parseDebFromFilePath } from '$lib/server/parsers/deb';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '$lib/server/logger';

const execAsync = promisify(exec);

function toOut(metadata: Awaited<ReturnType<typeof parseDebFromFilePath>>) {
    return {
        packageName: metadata.packageName,
        name: metadata.name ?? null,
        version: metadata.version,
        description: metadata.description,
        architecture: metadata.architecture ?? null,
        section: metadata.section ?? null,
        priority: metadata.priority ?? null,
        maintainer: metadata.maintainer ?? null,
        depends: metadata.depends ?? null
    };
}

export const POST = unifiedEndpoint(
    async ({ event }) => {
        const contentType = event.request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const body = await event.request.json();
            const { objectPath, bucket } = body;

            if (!objectPath || typeof objectPath !== 'string') {
                throw Object.assign(new Error('objectPath is required'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }
            if (!objectPath.toLowerCase().endsWith('.deb')) {
                throw Object.assign(new Error('objectPath must point to a .deb file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }

            try {
                const metadata = await parseDebFromCloud(objectPath, bucket);
                return successResponse(toOut(metadata));
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('[DEB Parser v2] parse-deb failed', { objectPath, bucket, error: msg });
                throw err;
            }
        }

        if (contentType.includes('multipart/form-data')) {
            const formData = await event.request.formData();
            const file = formData.get('file') as File | null;
            if (!file || !(file instanceof File)) {
                throw Object.assign(new Error('FormData must include a file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }
            if (!file.name.toLowerCase().endsWith('.deb')) {
                throw Object.assign(new Error('File must be a .deb file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }

            const tempDir = join(tmpdir(), 'deb-parser');
            await mkdir(tempDir, { recursive: true });
            const workDir = join(tempDir, `work-${Date.now()}`);
            await mkdir(workDir, { recursive: true });
            const tempFilePath = join(tempDir, `${Date.now()}-${file.name}`);

            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                await writeFile(tempFilePath, buffer);
                logger.info('[DEB Parser v2] File saved from FormData', { tempFilePath });
                const metadata = await parseDebFromFilePath(tempFilePath, workDir);
                return successResponse(toOut(metadata));
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('[DEB Parser v2] FormData parse failed', { tempFilePath, error: msg });
                throw err;
            } finally {
                try {
                    await execAsync(`rm -rf "${workDir}"`);
                } catch (err) {
                    logger.warn('[DEB Parser v2] Error deleting work dir', { err, workDir });
                }
                try {
                    await unlink(tempFilePath);
                } catch (err) {
                    logger.warn('[DEB Parser v2] Error deleting temp file', { err, tempFilePath });
                }
            }
        }

        throw Object.assign(
            new Error('Request must be application/json (objectPath) or multipart/form-data (file)'),
            { status: 400, code: ErrorCodes.INVALID_INPUT }
        );
    },
    { permission: 'upload.create' }
);
