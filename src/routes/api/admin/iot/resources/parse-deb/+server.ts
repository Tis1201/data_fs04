import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { downloadFileFromGcs, getStorageConfig } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import { Storage } from '@google-cloud/storage';

const execAsync = promisify(exec);

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

/**
 * Parse DEBIAN/control file content
 * Control files use key-value format with continuation lines starting with space
 */
function parseControlFile(content: string): DebMetadata {
    const lines = content.split('\n');
    const metadata: Partial<DebMetadata> = {};
    let currentField = '';
    let currentValue = '';
    
    for (const line of lines) {
        // Field line (starts with uppercase letter, ends with colon)
        if (/^[A-Z][a-zA-Z-]+:\s/.test(line)) {
            // Save previous field
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
            
            // Start new field
            const match = line.match(/^([A-Z][a-zA-Z-]+):\s(.*)$/);
            if (match) {
                currentField = match[1];
                currentValue = match[2];
            }
        } else if (line.startsWith(' ') && currentField) {
            // Continuation line (starts with space)
            currentValue += '\n' + line.trim();
        }
    }
    
    // Save last field
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
    
    // Validate required fields
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
 * Extract and parse DEBIAN/control from .deb file
 * Uses system commands: ar and tar
 * Handles both .tar.gz and .tar.xz compression formats
 */
async function parseDebFile(debFilePath: string, workDir: string): Promise<DebMetadata> {
    try {
        // First, list contents of ar archive to find control file
        logger.debug('[DEB Parser] Listing contents of .deb archive', { debFilePath, workDir });
        const listOutput = await execAsync(`ar t "${debFilePath}"`, { cwd: workDir });
        const archiveFiles = listOutput.stdout.trim().split('\n');
        
        logger.debug('[DEB Parser] Archive contents:', { files: archiveFiles });
        
        // Find control.tar.* file (could be .gz, .xz, .zst, etc.)
        const controlTarFile = archiveFiles.find(file => file.startsWith('control.tar.'));
        
        if (!controlTarFile) {
            throw new Error('control.tar.* not found in .deb archive');
        }
        
        logger.debug('[DEB Parser] Found control file:', { controlTarFile });
        
        // Extract control.tar.* from .deb using ar
        logger.debug('[DEB Parser] Extracting control file from .deb archive');
        await execAsync(`ar x "${debFilePath}" "${controlTarFile}"`, { cwd: workDir });
        
        const controlTarPath = join(workDir, controlTarFile);
        
        // Determine compression format and extract accordingly
        // Note: control.tar.* contains files directly (not in DEBIAN/ subdirectory)
        let extractCmd: string;
        if (controlTarFile.endsWith('.gz')) {
            // gzip compression
            extractCmd = `tar -xzf "${controlTarPath}" control`;
        } else if (controlTarFile.endsWith('.xz')) {
            // xz compression (most common in modern Debian packages)
            extractCmd = `tar -xJf "${controlTarPath}" control`;
        } else if (controlTarFile.endsWith('.zst')) {
            // zstd compression
            extractCmd = `tar --zstd -xf "${controlTarPath}" control`;
        } else {
            // uncompressed tar
            extractCmd = `tar -xf "${controlTarPath}" control`;
        }
        
        // Extract control file from control.tar.*
        // The control file is at the root of the tar archive, not in DEBIAN/ subdirectory
        logger.debug('[DEB Parser] Extracting control file', { compression: controlTarFile.split('.').pop() });
        await execAsync(extractCmd, { cwd: workDir });
        
        const controlFilePath = join(workDir, 'control');
        
        // Read and parse control file
        logger.debug('[DEB Parser] Reading control file');
        const controlContent = await readFile(controlFilePath, 'utf-8');
        
        // Parse control file
        const metadata = parseControlFile(controlContent);
        
        logger.info('[DEB Parser] Successfully parsed .deb file', {
            packageName: metadata.packageName,
            version: metadata.version
        });
        
        return metadata;
    } catch (error) {
        logger.error('[DEB Parser] Error parsing .deb file', {
            error: error instanceof Error ? error.message : String(error),
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
        
        // Check if request contains GCS object path (new flow) or direct file upload (old flow)
        if (contentType.includes('application/json')) {
            // New flow: JSON body with GCS object path
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

            // Create temp directory
            const tempDir = join(tmpdir(), 'deb-parser');
            try {
                await mkdir(tempDir, { recursive: true });
            } catch (err) {
                // Directory might already exist, ignore error
            }

            // Create work directory for extraction
            workDir = join(tempDir, `work-${Date.now()}`);
            await mkdir(workDir, { recursive: true });

            // Download from GCS to temp file
            tempFilePath = join(tempDir, `${Date.now()}-${objectPath.split('/').pop() || 'deb'}`);
            gcsObjectPath = objectPath;
            
            await downloadFileFromGcs(targetBucket, objectPath, tempFilePath);
            logger.info('[DEB Parser] File downloaded from GCS', { tempFilePath });
        } else {
            // Old flow: Direct file upload (fallback for compatibility)
            const formData = await request.formData();
            const file = formData.get('file') as File;

            if (!file) {
                return json({ success: false, error: 'No file provided. Use new flow with objectPath or provide file in formData' }, { status: 400 });
            }

            // Validate file type
            if (!file.name.toLowerCase().endsWith('.deb')) {
                return json({ success: false, error: 'File must be a .deb file' }, { status: 400 });
            }

            logger.info('[DEB Parser] Parsing DEB from direct upload', { fileName: file.name, fileSize: file.size });

            // Create temp directory if it doesn't exist
            const tempDir = join(tmpdir(), 'deb-parser');
            try {
                await mkdir(tempDir, { recursive: true });
            } catch (err) {
                // Directory might already exist, ignore error
            }

            // Create work directory for extraction
            workDir = join(tempDir, `work-${Date.now()}`);
            await mkdir(workDir, { recursive: true });

            // Save file temporarily
            tempFilePath = join(tempDir, `${Date.now()}-${file.name}`);
            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(tempFilePath, buffer);
            logger.info('[DEB Parser] File saved to temp location', { tempFilePath });
        }

        if (!tempFilePath || !workDir) {
            return json({ success: false, error: 'Failed to prepare file for parsing' }, { status: 500 });
        }

        // Parse the .deb file
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
        // Clean up temp files and directories
        if (workDir) {
            try {
                // Remove work directory and all contents
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
        
        // Clean up GCS file if it was a temporary upload
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
