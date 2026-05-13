/**
 * POST /api/v2/resources/parse-apk
 * Parse APK metadata. Preferred: JSON { objectPath, bucket? } (file in GCS).
 * Fallback (e.g. local mode): FormData with 'file'.
 * Callable by both admin and user roles with upload permission.
 */
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { getStorageConfig, downloadCloudFileToPath } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import pkg from 'node-apk';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

const { Apk } = pkg;

async function extractApkSignature(apk: InstanceType<typeof Apk>): Promise<string | null> {
    try {
        const certs = await apk.getCertificateInfo();
        if (!certs || certs.length === 0) return null;
        const cert = certs[0];
        if (!cert?.bytes) return null;
        return crypto.createHash('sha256').update(cert.bytes).digest('hex').toLowerCase();
    } catch {
        return null;
    }
}

async function parseApkAtPath(tempFilePath: string) {
    const apk = new Apk(tempFilePath);
    try {
        const manifest = await apk.getManifestInfo();
        const packageName = manifest.package ?? null;
        const versionName = manifest.versionName ?? null;
        const versionCode = manifest.versionCode ?? null;
        let appName: string | null = null;
        if (manifest.applicationLabel) {
            if (typeof manifest.applicationLabel === 'string') {
                appName = manifest.applicationLabel;
            } else {
                try {
                    const resources = await apk.getResources();
                    const resolved = resources.resolve(manifest.applicationLabel);
                    if (resolved?.length) appName = resolved[0].value as string;
                } catch {
                    // ignore
                }
            }
        }
        const signature = await extractApkSignature(apk);
        return { packageName, versionName, versionCode, signature, appName };
    } finally {
        apk.close();
    }
}

export const POST = unifiedEndpoint(
    async ({ event }) => {
        const contentType = event.request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const formData = await event.request.formData();
            const file = formData.get('file') as File | null;
            if (!file || !(file instanceof File)) {
                throw Object.assign(new Error('FormData must include a file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }
            if (!file.name.toLowerCase().endsWith('.apk')) {
                throw Object.assign(new Error('File must be an APK file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }

            const tempDir = join(tmpdir(), 'apk-parser');
            await mkdir(tempDir, { recursive: true });
            const tempFilePath = join(tempDir, `${Date.now()}-${file.name}`);

            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                await writeFile(tempFilePath, buffer);
                logger.info('[APK Parser v2] File saved from FormData', { tempFilePath });
                const out = await parseApkAtPath(tempFilePath);
                return successResponse(out);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('[APK Parser v2] FormData parse failed', { tempFilePath, error: msg });
                throw err;
            } finally {
                try {
                    await unlink(tempFilePath);
                } catch (err) {
                    logger.warn('[APK Parser v2] Error deleting temp file', { err, tempFilePath });
                }
            }
        }

        if (contentType.includes('application/json')) {
            const body = await event.request.json();
            const { objectPath, bucket } = body;

            if (!objectPath || typeof objectPath !== 'string') {
                throw Object.assign(new Error('objectPath is required'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }
            if (!objectPath.toLowerCase().endsWith('.apk')) {
                throw Object.assign(new Error('objectPath must point to an APK file'), { status: 400, code: ErrorCodes.INVALID_INPUT });
            }

            const config = getStorageConfig();
            
            // In R2 mode, bucket might be passed or inferred from config
            const targetBucket = bucket || (config.mode === 'R2' ? config.r2Bucket : undefined);
            
            if (!targetBucket) {
                throw Object.assign(new Error('Bucket not configured'), { status: 500, code: ErrorCodes.INTERNAL_ERROR });
            }

            const tempDir = join(tmpdir(), 'apk-parser');
            await mkdir(tempDir, { recursive: true });
            const fileName = objectPath.split('/').pop() || 'file.apk';
            const tempFilePath = join(tempDir, `${Date.now()}-${fileName}`);

            try {
                await downloadCloudFileToPath(targetBucket, objectPath, tempFilePath);
                logger.info('[APK Parser v2] File downloaded from Cloud Storage', { tempFilePath });
                const out = await parseApkAtPath(tempFilePath);
                return successResponse(out);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error('[APK Parser v2] Cloud download or parse failed', { objectPath, bucket: targetBucket, error: msg });
                throw err;
            } finally {
                try {
                    await unlink(tempFilePath);
                } catch (err) {
                    logger.warn('[APK Parser v2] Error deleting temp file', { err, tempFilePath });
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
