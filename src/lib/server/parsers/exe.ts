/**
 * EXE metadata parser — derives package info from filename conventions.
 *
 * Unlike .deb (which embeds DEBIAN/control), Windows .exe files have no
 * standard embedded package metadata. We parse the filename instead.
 *
 * Supported patterns (case-insensitive):
 *   name_version_windows_arch.exe   → hello-world_1.0.0_windows_arm64.exe
 *   name_version_arch.exe           → hello-world_1.0.0_amd64.exe
 *   name-windows-arch.exe           → device-windows-amd64.exe
 *   name.exe                        → myapp.exe
 */
import { logger } from '$lib/server/logger';

export interface ExeMetadata {
    packageName: string;
    version: string;
    description: string;
    architecture?: string;
}

const KNOWN_ARCHS = new Set(['amd64', 'x86_64', 'x64', 'arm64', 'aarch64', 'x86', 'i386', 'i686', '386']);

export function parseExeFilename(filename: string): ExeMetadata {
    const base = filename.replace(/\.exe$/i, '');

    // Pattern 1: name_version_windows_arch  (e.g. hello-world_1.0.0_windows_arm64)
    const p1 = base.match(/^(.+?)[-_](\d+\.\d+(?:\.\d+)?)[-_]windows[-_](\w+)$/i);
    if (p1) {
        return {
            packageName: normalise(p1[1]),
            version: p1[2],
            description: `Windows application ${normalise(p1[1])}`,
            architecture: p1[3].toLowerCase()
        };
    }

    // Pattern 2: name_version_arch  (e.g. hello-world_1.0.0_amd64)
    const p2 = base.match(/^(.+?)[-_](\d+\.\d+(?:\.\d+)?)[-_](\w+)$/i);
    if (p2 && KNOWN_ARCHS.has(p2[3].toLowerCase())) {
        return {
            packageName: normalise(p2[1]),
            version: p2[2],
            description: `Windows application ${normalise(p2[1])}`,
            architecture: p2[3].toLowerCase()
        };
    }

    // Pattern 3: name_version  (e.g. myapp_2.1.0)
    const p3 = base.match(/^(.+?)[-_](\d+\.\d+(?:\.\d+)?)$/);
    if (p3) {
        return {
            packageName: normalise(p3[1]),
            version: p3[2],
            description: `Windows application ${normalise(p3[1])}`
        };
    }

    // Pattern 4: name-windows-arch  (e.g. device-windows-amd64)
    const p4 = base.match(/^(.+?)[-_]windows[-_](\w+)$/i);
    if (p4) {
        return {
            packageName: normalise(p4[1]),
            version: '',
            description: `Windows application ${normalise(p4[1])}`,
            architecture: p4[2].toLowerCase()
        };
    }

    // Fallback: just the basename
    return {
        packageName: normalise(base),
        version: '',
        description: `Windows application ${normalise(base)}`
    };
}

function normalise(name: string): string {
    return name.replace(/[\s_]+/g, '-').toLowerCase();
}

/**
 * Parse EXE metadata from a GCS object path (just uses the filename portion).
 * No file download is needed — metadata is derived from the filename only.
 */
export function parseExeFromGcsPath(objectPath: string): ExeMetadata {
    const filename = objectPath.split('/').pop() || objectPath;
    logger.info('[EXE Parser] Parsing EXE metadata from GCS path', { objectPath, filename });
    return parseExeFilename(filename);
}
