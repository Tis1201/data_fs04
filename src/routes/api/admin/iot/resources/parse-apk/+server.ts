import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pkg from 'node-apk';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

const { Apk } = pkg;

/**
 * Extract APK signature from certificate info
 * Returns SHA-256 hash of the certificate
 */
async function extractApkSignature(apk: InstanceType<typeof Apk>): Promise<string | null> {
    try {
        const certs = await apk.getCertificateInfo();
        if (!certs || certs.length === 0) {
            console.warn('[APK Parser] No certificates found in APK');
            return null;
        }

        // Get the first certificate (usually the signing certificate)
        const cert = certs[0];
        if (!cert || !cert.bytes) {
            console.warn('[APK Parser] Certificate bytes not available');
            return null;
        }

        // Calculate SHA-256 hash of the certificate
        const hash = crypto.createHash('sha256').update(cert.bytes).digest('hex');
        return hash.toLowerCase();
    } catch (error) {
        console.warn('[APK Parser] Error extracting signature:', error);
        return null;
    }
}

export const POST: RequestHandler = async ({ request }) => {
    let tempFilePath: string | null = null;

    try {
        // Get the file from the request
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.apk')) {
            return json({ success: false, error: 'File must be an APK' }, { status: 400 });
        }

        // Create temp directory if it doesn't exist
        const tempDir = join(tmpdir(), 'apk-parser');
        try {
            await mkdir(tempDir, { recursive: true });
        } catch (err) {
            // Directory might already exist, ignore error
        }

        // Save file temporarily
        tempFilePath = join(tempDir, `${Date.now()}-${file.name}`);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(tempFilePath, buffer);

        // Parse the APK using node-apk
        const apk = new Apk(tempFilePath);
        
        try {
            // Get manifest information
            const manifest = await apk.getManifestInfo();
            
            // Extract the data we need
            const packageName = manifest.package ?? null;
            const versionName = manifest.versionName ?? null;
            const versionCode = manifest.versionCode ?? null;
            
            // Get application label (can be a resource reference or string)
            let appName: string | null = null;
            if (manifest.applicationLabel) {
                if (typeof manifest.applicationLabel === 'string') {
                    appName = manifest.applicationLabel;
                } else {
                    // If it's a resource reference, try to resolve it
                    try {
                        const resources = await apk.getResources();
                        const resolved = resources.resolve(manifest.applicationLabel);
                        if (resolved && resolved.length > 0) {
                            appName = resolved[0].value as string;
                        }
                    } catch (resourceError) {
                        console.warn('[APK Parser] Could not resolve application label resource:', resourceError);
                    }
                }
            }

            // Extract signature from certificate
            const signature = await extractApkSignature(apk);

            const out = {
                packageName: packageName,
                versionName: versionName,
                versionCode: versionCode,
                signature: signature,
                appName: appName
            };

            return json({ success: true, data: out });
        } finally {
            // Clean up Apk instance
            apk.close();
        }
    } catch (error) {
        console.error('[APK Parser] Error parsing APK:', error);
        return json({ 
            success: false, 
            error: 'Failed to parse APK file: ' + (error instanceof Error ? error.message : String(error))
        }, { status: 500 });
    } finally {
        // Clean up temp file
        if (tempFilePath) {
            try {
                await unlink(tempFilePath);
            } catch (err) {
                console.error('[APK Parser] Error deleting temp file:', err);
            }
        }
    }
};
