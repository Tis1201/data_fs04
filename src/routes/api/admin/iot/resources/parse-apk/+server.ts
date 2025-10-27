import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import AppInfoParser from 'app-info-parser';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

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

        // Parse the APK
        const parser = new AppInfoParser(tempFilePath);
        const info = await parser.parse();

        // Extract the data we need
        // Note: label can be an array or string, we need to handle both
        let appName = info.application?.label ?? null;
        if (Array.isArray(appName) && appName.length > 0) {
            appName = appName[0];
        }

        const out = {
            packageName: info.package ?? null,
            versionName: info.versionName ?? null,
            versionCode: typeof info.versionCode === 'string' 
                ? Number(info.versionCode) 
                : (info.versionCode ?? null),
            appName: appName
        };

        return json({ success: true, data: out });
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
