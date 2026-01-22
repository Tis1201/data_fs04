import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getStorageConfig } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import { Storage } from '@google-cloud/storage';
import { access } from 'fs/promises';
import { constants } from 'fs';

const execAsync = promisify(exec);

async function findXzCommand(): Promise<string> {
    const commonPaths = [
        '/usr/bin/xz',
        '/usr/local/bin/xz',
        '/opt/homebrew/bin/xz',
        '/bin/xz',
        'xz'
    ];

    try {
        const whichOutput = await execAsync('which xz');
        const xzPath = whichOutput.stdout.trim();
        if (xzPath) {
            logger.debug('[DEB Parser] Found xz via which', { path: xzPath });
            return xzPath;
        }
    } catch (err) {
        // Continue to try common paths
    }

    for (const path of commonPaths) {
        try {
            if (path === 'xz') {
                try {
                    await execAsync(`${path} --version`);
                    logger.debug('[DEB Parser] Found xz in PATH', { path });
                    return path;
                } catch (err) {
                    continue;
                }
            } else {
                try {
                    await access(path, constants.F_OK | constants.X_OK);
                    logger.debug('[DEB Parser] Found xz at path', { path });
                    return path;
                } catch (err) {
                    continue;
                }
            }
        } catch (err) {
            continue;
        }
    }

    logger.debug('[DEB Parser] Using xz from PATH (fallback)');
    return 'xz';
}

interface DebMetadata {
    packageName: string;
    version: string;
    description: string;
    architecture?: string;
    section?: string;
    priority?: string;
    maintainer?: string;
    depends?: string;
}

function parseControlFile(content: string): DebMetadata {
    const lines = content.split('\n');
    const metadata: Partial<DebMetadata> = {};
    let currentField = '';
    let currentValue = '';
    
    for (const line of lines) {
        if (/^[A-Z][a-zA-Z-]+:\s/.test(line)) {
            if (currentField) {
                const fieldKey = currentField.toLowerCase();
                if (fieldKey === 'package') {
                    metadata.packageName = currentValue.trim();
                } else if (fieldKey === 'version') {
                    metadata.version = currentValue.trim();
                } else if (fieldKey === 'description') {
                    metadata.description = currentValue.trim();
                } else if (fieldKey === 'architecture') {
                    metadata.architecture = currentValue.trim();
                } else if (fieldKey === 'section') {
                    metadata.section = currentValue.trim();
                } else if (fieldKey === 'priority') {
                    metadata.priority = currentValue.trim();
                } else if (fieldKey === 'maintainer') {
                    metadata.maintainer = currentValue.trim();
                } else if (fieldKey === 'depends') {
                    metadata.depends = currentValue.trim();
                }
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
        const fieldKey = currentField.toLowerCase();
        if (fieldKey === 'package') {
            metadata.packageName = currentValue.trim();
        } else if (fieldKey === 'version') {
            metadata.version = currentValue.trim();
        } else if (fieldKey === 'description') {
            metadata.description = currentValue.trim();
        } else if (fieldKey === 'architecture') {
            metadata.architecture = currentValue.trim();
        } else if (fieldKey === 'section') {
            metadata.section = currentValue.trim();
        } else if (fieldKey === 'priority') {
            metadata.priority = currentValue.trim();
        } else if (fieldKey === 'maintainer') {
            metadata.maintainer = currentValue.trim();
        } else if (fieldKey === 'depends') {
            metadata.depends = currentValue.trim();
        }
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

async function parseDebFile(debFilePath: string, workDir: string): Promise<DebMetadata> {
    try {
        logger.debug('[DEB Parser] Listing contents of .deb archive', { debFilePath, workDir });
        const listOutput = await execAsync(`ar t "${debFilePath}"`, { cwd: workDir });
        const archiveFiles = listOutput.stdout.trim().split('\n');
        
        logger.debug('[DEB Parser] Archive contents:', { files: archiveFiles });
        
        const controlTarFile = archiveFiles.find(file => file.startsWith('control.tar.'));
        
        if (!controlTarFile) {
            throw new Error('control.tar.* not found in .deb archive');
        }
        
        logger.debug('[DEB Parser] Found control file:', { controlTarFile });
        
        logger.debug('[DEB Parser] Extracting control file from .deb archive');
        await execAsync(`ar x "${debFilePath}" "${controlTarFile}"`, { cwd: workDir });
        
        const controlTarPath = join(workDir, controlTarFile);
        
        if (controlTarFile.endsWith('.gz')) {
            logger.debug('[DEB Parser] Extracting control file (gzip)', { compression: 'gz' });
            await execAsync(`tar -xzf "${controlTarPath}" control`, { cwd: workDir });
        } else if (controlTarFile.endsWith('.xz')) {
            logger.debug('[DEB Parser] Decompressing xz file first', { compression: 'xz' });
            const decompressedTarPath = join(workDir, 'control.tar');

            const xzCommand = await findXzCommand();
            logger.debug('[DEB Parser] Using xz command', { command: xzCommand });

            await execAsync(`${xzCommand} -dc "${controlTarPath}" > "${decompressedTarPath}"`, { cwd: workDir });
            
            logger.debug('[DEB Parser] Listing contents of decompressed tar');
            const tarListOutput = await execAsync(`tar -tf "${decompressedTarPath}"`, { cwd: workDir });
            const tarContents = tarListOutput.stdout.trim().split('\n');
            logger.debug('[DEB Parser] Tar contents:', { files: tarContents });
            
            const controlFileName = tarContents.find(f => f.endsWith('control') || f === 'control') || 'control';
            logger.debug('[DEB Parser] Extracting control file from decompressed tar', { 
                compression: 'xz', 
                controlFileName 
            });
            await execAsync(`tar -xf "${decompressedTarPath}" "${controlFileName}"`, { cwd: workDir });
            
            try {
                await unlink(decompressedTarPath);
            } catch (err) {
                // Ignore cleanup errors
            }
            
            const extractedPath = join(workDir, controlFileName);
            const finalPath = join(workDir, 'control');
            if (extractedPath !== finalPath) {
                try {
                    const { rename } = await import('fs/promises');
                    await rename(extractedPath, finalPath);
                } catch (err) {
                    console.log('[DEB Parser] File move failed or not needed:', err);
                }
            }
        } else if (controlTarFile.endsWith('.zst')) {
            logger.debug('[DEB Parser] Extracting control file (zstd)', { compression: 'zst' });
            await execAsync(`tar --zstd -xf "${controlTarPath}" control`, { cwd: workDir });
        } else {
            logger.debug('[DEB Parser] Extracting control file (uncompressed)', { compression: 'none' });
            await execAsync(`tar -xf "${controlTarPath}" control`, { cwd: workDir });
        }
        
        const controlFilePath = join(workDir, 'control');
        
        logger.debug('[DEB Parser] Reading control file');
        const controlContent = await readFile(controlFilePath, 'utf-8');
        
        const metadata = parseControlFile(controlContent);
        
        logger.info('[DEB Parser] Successfully parsed .deb file', {
            packageName: metadata.packageName,
            version: metadata.version
        });
        
        return metadata;
    } catch (error) {
        logger.error('[DEB Parser] Error parsing .deb file', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            debFilePath
        });
        throw new Error(`Failed to parse .deb file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export const POST: RequestHandler = async ({ request }) => {
    let tempFilePath: string | null = null;
    let workDir: string | null = null;
    let gcsObjectPath: string | null = null;

    try {
        const contentType = request.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            const body = await request.json();
            const { objectPath, bucket } = body;

            if (!objectPath) {
                return json({ success: false, error: 'objectPath is required' }, { status: 400 });
            }

            logger.info('[DEB Parser] Parsing DEB from GCS', { objectPath, bucket });

            const config = getStorageConfig();
            const targetBucket = bucket || config.bucket;
            
            if (!targetBucket) {
                return json({ success: false, error: 'Bucket not configured' }, { status: 500 });
            }

            const tempDir = join(tmpdir(), 'deb-parser');
            try {
                await mkdir(tempDir, { recursive: true });
            } catch (err) {
                // Directory might already exist
            }

            workDir = join(tempDir, `work-${Date.now()}`);
            await mkdir(workDir, { recursive: true });

            tempFilePath = join(tempDir, `${Date.now()}-${objectPath.split('/').pop() || 'deb'}`);
            gcsObjectPath = objectPath;
            
            const storage = new Storage({ 
                projectId: config.projectId 
            });
            
            const file = storage.bucket(targetBucket).file(objectPath);
            await file.download({ destination: tempFilePath });
            logger.info('[DEB Parser] File downloaded from GCS', { tempFilePath });
        } else {
            const formData = await request.formData();
            const file = formData.get('file') as File;

            if (!file) {
                return json({ success: false, error: 'No file provided. Use new flow with objectPath or provide file in formData' }, { status: 400 });
            }

            if (!file.name.toLowerCase().endsWith('.deb')) {
                return json({ success: false, error: 'File must be a .deb file' }, { status: 400 });
            }

            logger.info('[DEB Parser] Parsing DEB from direct upload', { fileName: file.name, fileSize: file.size });

            const tempDir = join(tmpdir(), 'deb-parser');
            try {
                await mkdir(tempDir, { recursive: true });
            } catch (err) {
                // Directory might already exist
            }

            workDir = join(tempDir, `work-${Date.now()}`);
            await mkdir(workDir, { recursive: true });

            tempFilePath = join(tempDir, `${Date.now()}-${file.name}`);
            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(tempFilePath, buffer);
            logger.info('[DEB Parser] File saved to temp location', { tempFilePath });
        }

        if (!tempFilePath || !workDir) {
            return json({ success: false, error: 'Failed to prepare file for parsing' }, { status: 500 });
        }

        const metadata = await parseDebFile(tempFilePath, workDir);

        const out = {
            packageName: metadata.packageName,
            version: metadata.version,
            description: metadata.description,
            architecture: metadata.architecture || null,
            section: metadata.section || null,
            priority: metadata.priority || null,
            maintainer: metadata.maintainer || null,
            depends: metadata.depends || null
        };

        return json({ success: true, data: out });
    } catch (error) {
        logger.error('[DEB Parser] Error parsing DEB', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return json({ 
            success: false, 
            error: 'Failed to parse .deb file: ' + (error instanceof Error ? error.message : String(error))
        }, { status: 500 });
    } finally {
        if (workDir) {
            try {
                await execAsync(`rm -rf "${workDir}"`);
                logger.debug('[DEB Parser] Work directory deleted', { workDir });
            } catch (err) {
                logger.warn('[DEB Parser] Error deleting work directory', { error: err, workDir });
            }
        }
        
        if (tempFilePath) {
            try {
                await unlink(tempFilePath);
                logger.debug('[DEB Parser] Temp file deleted', { tempFilePath });
            } catch (err) {
                logger.warn('[DEB Parser] Error deleting temp file', { error: err, tempFilePath });
            }
        }
        
        if (gcsObjectPath && gcsObjectPath.startsWith('temp/deb-parser/')) {
            try {
                const config = getStorageConfig();
                if (config.bucket && config.mode !== 'LOCAL') {
                    const storage = new Storage({ projectId: config.projectId });
                    const file = storage.bucket(config.bucket).file(gcsObjectPath);
                    await file.delete();
                    logger.info('[DEB Parser] Temporary GCS file deleted', { objectPath: gcsObjectPath });
                }
            } catch (err) {
                logger.warn('[DEB Parser] Error deleting temporary GCS file', { 
                    error: err, 
                    objectPath: gcsObjectPath 
                });
            }
        }
    }
};
