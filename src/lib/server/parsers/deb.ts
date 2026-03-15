/**
 * Shared DEB file parsing logic (from GCS or temp path).
 * Used by admin parse-deb and v2 resources/parse-deb.
 */
import { writeFile, unlink, mkdir, readFile, rename } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getStorageConfig, downloadCloudFileToPath } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import { access } from 'fs/promises';
import { constants } from 'fs';

const execAsync = promisify(exec);

export interface DebMetadata {
    packageName: string;
    name?: string;
    version: string;
    description: string;
    architecture?: string;
    section?: string;
    priority?: string;
    maintainer?: string;
    depends?: string;
}

async function findXzCommand(): Promise<string> {
    try {
        const whichOutput = await execAsync('which xz');
        const xzPath = whichOutput.stdout.trim();
        if (xzPath) return xzPath;
    } catch {
        // continue
    }
    const commonPaths = ['/usr/bin/xz', '/usr/local/bin/xz', '/opt/homebrew/bin/xz', '/bin/xz', 'xz'];
    for (const p of commonPaths) {
        try {
            if (p === 'xz') {
                await execAsync(`${p} --version`);
                return p;
            }
            await access(p, constants.F_OK | constants.X_OK);
            return p;
        } catch {
            continue;
        }
    }
    return 'xz';
}

function parseControlFile(content: string): DebMetadata {
    const lines = content.split('\n');
    const metadata: Partial<DebMetadata> = {};
    let currentField = '';
    let currentValue = '';

    for (const line of lines) {
        if (/^[A-Z][a-zA-Z-]+:\s/.test(line)) {
            if (currentField) {
                const key = currentField.toLowerCase();
                if (key === 'package') metadata.packageName = currentValue.trim();
                else if (key === 'version') metadata.version = currentValue.trim();
                else if (key === 'description') metadata.description = currentValue.trim();
                else if (key === 'architecture') metadata.architecture = currentValue.trim();
                else if (key === 'section') metadata.section = currentValue.trim();
                else if (key === 'priority') metadata.priority = currentValue.trim();
                else if (key === 'maintainer') metadata.maintainer = currentValue.trim();
                else if (key === 'depends') metadata.depends = currentValue.trim();
            }
            const match = line.match(/^([A-Z][a-zA-Z-]+):\s(.*)$/);
            if (match) {
                currentField = match[1];
                currentValue = match[2];
            }
        } else if (line.startsWith(' ') && currentField) {
            currentValue += '\n' + line.trim();
        }
    }
    if (currentField) {
        const key = currentField.toLowerCase();
        if (key === 'package') metadata.packageName = currentValue.trim();
        else if (key === 'version') metadata.version = currentValue.trim();
        else if (key === 'description') metadata.description = currentValue.trim();
        else if (key === 'architecture') metadata.architecture = currentValue.trim();
        else if (key === 'section') metadata.section = currentValue.trim();
        else if (key === 'priority') metadata.priority = currentValue.trim();
        else if (key === 'maintainer') metadata.maintainer = currentValue.trim();
        else if (key === 'depends') metadata.depends = currentValue.trim();
    }
    if (!metadata.packageName || !metadata.version) {
        throw new Error('Missing required fields: Package and Version are required');
    }
    return {
        packageName: metadata.packageName,
        version: metadata.version,
        description: metadata.description || '',
        architecture: metadata.architecture,
        section: metadata.section,
        priority: metadata.priority,
        maintainer: metadata.maintainer,
        depends: metadata.depends
    };
}

/**
 * Try to extract the human-readable "name" from app.json bundled inside data.tar.* of a .deb.
 * Returns undefined if not found or on any error (non-fatal).
 */
async function readNameFromDebAppJson(
    debFilePath: string,
    archiveFiles: string[],
    workDir: string
): Promise<string | undefined> {
    try {
        const dataTarFile = archiveFiles.find((f) => f.startsWith('data.tar.'));
        if (!dataTarFile) return undefined;

        await execAsync(`ar x "${debFilePath}" "${dataTarFile}"`, { cwd: workDir });
        const dataTarPath = join(workDir, dataTarFile);

        // Decompress xz first (same approach as control extraction)
        let plainTarPath = dataTarPath;
        if (dataTarFile.endsWith('.xz')) {
            plainTarPath = join(workDir, 'data.tar');
            const xzCommand = await findXzCommand();
            await execAsync(`${xzCommand} -dc "${dataTarPath}" > "${plainTarPath}"`);
        }

        // Find app.json entry in the tarball
        let listCmd: string;
        if (dataTarFile.endsWith('.gz')) {
            listCmd = `tar -tzf "${dataTarPath}"`;
        } else if (dataTarFile.endsWith('.zst')) {
            listCmd = `tar --zstd -tf "${dataTarPath}"`;
        } else {
            listCmd = `tar -tf "${plainTarPath}"`;
        }

        const tarList = await execAsync(listCmd, { cwd: workDir });
        const appJsonEntry = tarList.stdout
            .trim()
            .split('\n')
            .map((f) => f.trim())
            .find((f) => f.endsWith('/app.json') || f === 'app.json' || f === './app.json');

        if (!appJsonEntry) return undefined;

        // Extract just the app.json file
        let extractCmd: string;
        if (dataTarFile.endsWith('.gz')) {
            extractCmd = `tar -xzf "${dataTarPath}" "${appJsonEntry}"`;
        } else if (dataTarFile.endsWith('.zst')) {
            extractCmd = `tar --zstd -xf "${dataTarPath}" "${appJsonEntry}"`;
        } else {
            extractCmd = `tar -xf "${plainTarPath}" "${appJsonEntry}"`;
        }

        await execAsync(extractCmd, { cwd: workDir });

        const appJsonFullPath = join(workDir, appJsonEntry);
        const content = await readFile(appJsonFullPath, 'utf-8');
        const json = JSON.parse(content);
        const name = typeof json.name === 'string' ? json.name.trim() : undefined;
        return name || undefined;
    } catch {
        return undefined;
    }
}

async function parseDebFile(debFilePath: string, workDir: string): Promise<DebMetadata> {
    const listOutput = await execAsync(`ar t "${debFilePath}"`, { cwd: workDir });
    const archiveFiles = listOutput.stdout.trim().split('\n');
    const controlTarFile = archiveFiles.find((f) => f.startsWith('control.tar.'));
    if (!controlTarFile) throw new Error('control.tar.* not found in .deb archive');

    await execAsync(`ar x "${debFilePath}" "${controlTarFile}"`, { cwd: workDir });
    const controlTarPath = join(workDir, controlTarFile);

    if (controlTarFile.endsWith('.gz')) {
        await execAsync(`tar -xzf "${controlTarPath}" control`, { cwd: workDir });
    } else if (controlTarFile.endsWith('.xz')) {
        const decompressedTarPath = join(workDir, 'control.tar');
        const xzCommand = await findXzCommand();
        await execAsync(`${xzCommand} -dc "${controlTarPath}" > "${decompressedTarPath}"`, { cwd: workDir });
        const tarListOutput = await execAsync(`tar -tf "${decompressedTarPath}"`, { cwd: workDir });
        const controlFileName = tarListOutput.stdout.trim().split('\n').find((f) => f.endsWith('control') || f === 'control') || 'control';
        await execAsync(`tar -xf "${decompressedTarPath}" "${controlFileName}"`, { cwd: workDir });
        try {
            await unlink(decompressedTarPath);
        } catch {
            // ignore
        }
        const extractedPath = join(workDir, controlFileName);
        const finalPath = join(workDir, 'control');
        if (extractedPath !== finalPath) {
            try {
                await rename(extractedPath, finalPath);
            } catch {
                // ignore
            }
        }
    } else if (controlTarFile.endsWith('.zst')) {
        const tarListOutput = await execAsync(`tar --zstd -tf "${controlTarPath}"`, { cwd: workDir });
        const controlFileName =
            tarListOutput.stdout
                .trim()
                .split('\n')
                .map((f) => f.trim())
                .find((f) => f.endsWith('control') || f === 'control') || 'control';
        await execAsync(`tar --zstd -xf "${controlTarPath}" "${controlFileName}"`, { cwd: workDir });
        const extractedPath = join(workDir, controlFileName);
        const finalPath = join(workDir, 'control');
        if (extractedPath !== finalPath) {
            try {
                await rename(extractedPath, finalPath);
            } catch {
                // ignore
            }
        }
    } else {
        await execAsync(`tar -xf "${controlTarPath}" control`, { cwd: workDir });
    }

    const controlContent = await readFile(join(workDir, 'control'), 'utf-8');
    const metadata = parseControlFile(controlContent);

    // Try to get human-readable name from app.json bundled in data.tar.*
    const appJsonName = await readNameFromDebAppJson(debFilePath, archiveFiles, workDir);
    if (appJsonName) {
        metadata.name = appJsonName;
    }

    return metadata;
}

/**
 * Download DEB from Cloud Storage and parse metadata. Caller is responsible for cleanup of temp files.
 */
export async function parseDebFromCloud(objectPath: string, bucket?: string): Promise<DebMetadata> {
    const config = getStorageConfig();
    
    // In R2 mode, bucket might be passed or inferred from config
    const targetBucket = bucket || (config.mode === 'R2' ? config.r2Bucket : undefined);
    
    if (!targetBucket) throw new Error('Bucket not configured');

    const tempDir = join(tmpdir(), 'deb-parser');
    await mkdir(tempDir, { recursive: true });
    const workDir = join(tempDir, `work-${Date.now()}`);
    await mkdir(workDir, { recursive: true });
    const tempFilePath = join(tempDir, `${Date.now()}-${objectPath.split('/').pop() || 'deb'}`);

    try {
        await downloadCloudFileToPath(targetBucket, objectPath, tempFilePath);
        logger.info('[DEB Parser] File downloaded from Cloud Storage', { tempFilePath });
        const metadata = await parseDebFile(tempFilePath, workDir);
        return metadata;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[DEB Parser] Cloud download or parse failed', { objectPath, bucket: targetBucket, error: msg });
        throw err;
    } finally {
        try {
            await execAsync(`rm -rf "${workDir}"`);
        } catch (err) {
            logger.warn('[DEB Parser] Error deleting work dir', { err, workDir });
        }
        try {
            await unlink(tempFilePath);
        } catch (err) {
            logger.warn('[DEB Parser] Error deleting temp file', { err, tempFilePath });
        }
    }
}

/**
 * Parse DEB from an already-downloaded file path (e.g. from FormData save).
 * Used by admin parse-deb when receiving file upload.
 */
export async function parseDebFromFilePath(debFilePath: string, workDir: string): Promise<DebMetadata> {
    return parseDebFile(debFilePath, workDir);
}
