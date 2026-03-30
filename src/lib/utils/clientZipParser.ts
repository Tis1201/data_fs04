// Client-side ZIP/APK/CPK parsing utility
// Note: This uses JSZip for browser-based ZIP/APK/CPK parsing
// APK files are essentially ZIP files with a different extension
// CPK files are also ZIP files with a different extension

export interface AppJsonData {
  name: string;
  display_name: string | string[]; // Can be array from APK parsing
  domain: string;
  version: string;
  main: string;
  hidden: string;
}

export interface ZipParseResult {
  success: boolean;
  appData?: AppJsonData;
  error?: string;
}

export interface ApkParseResult {
  success: boolean;
  data?: {
    packageName: string | null;
    versionName: string | null;
    versionCode: number | null;
    signature: string | null;
    appName: string | null;
  };
  error?: string;
}

export interface DebParseResult {
  success: boolean;
  data?: {
    packageName: string;
    name?: string | null;
    version: string;
    description: string;
    architecture?: string | null;
    section?: string | null;
    priority?: string | null;
    maintainer?: string | null;
    depends?: string | null;
  };
  error?: string;
}

export interface ExeParseResult {
  success: boolean;
  data?: {
    packageName: string;
    version: string;
    description: string;
    architecture?: string | null;
  };
  error?: string;
}

/**
 * Parse an APK file via server (FormData to v2 endpoint).
 * Prefer parseApkFileClient or upload-to-GCS then parseApkByPath when possible.
 */
export async function parseApkFile(file: File): Promise<ApkParseResult> {
  console.log('[APK Parser] Parsing APK via v2 (FormData):', { fileName: file.name, fileSize: file.size });

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v2/resources/parse-apk', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData?.error?.message || errorData?.error || 'Failed to parse APK file'
      };
    }

    const result = await response.json();
    console.log('[APK Parser] Successfully parsed APK:', result.data);
    return result;
  } catch (error) {
    console.error('[APK Parser] APK parsing error:', error);
    return {
      success: false,
      error: 'Failed to parse APK file: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Parse an APK file in the browser (no server round-trip).
 * Uses app-info-parser when available; signature is left null (server-only).
 * Returns { success: false } if client parsing is not supported or fails.
 */
export async function parseApkFileClient(file: File): Promise<ApkParseResult> {
  if (!file.name.toLowerCase().endsWith('.apk')) {
    return { success: false, error: 'File must be an APK' };
  }
  try {
    const AppInfoParser = (await import('app-info-parser')).default;
    const parser = new AppInfoParser(file);
    const result = await parser.parse();
    const versionCode =
      result.versionCode != null
        ? typeof result.versionCode === 'number'
          ? result.versionCode
          : parseInt(String(result.versionCode), 10)
        : null;
    const appName =
      result.application?.label != null
        ? Array.isArray(result.application.label)
          ? result.application.label[0]
          : String(result.application.label)
        : null;
    return {
      success: true,
      data: {
        packageName: result.package ?? null,
        versionName: result.versionName ?? null,
        versionCode: Number.isNaN(versionCode) ? null : versionCode,
        signature: null,
        appName: appName ?? null
      }
    };
  } catch (error) {
    console.warn('[APK Parser] Client-side parse failed, use server fallback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Client parse failed'
    };
  }
}

export interface ParseApkOptions {
  /** When true, on client failure use upload-to-GCS then parseByPath instead of FormData */
  isCloudMode?: boolean;
  /** Set after upload when isCloudMode and client parse failed; used for parseByPath */
  objectPath?: string;
  bucket?: string;
}

/**
 * Parse APK with fallback: try client-side first, then server (by path if cloud, else FormData).
 * When isCloudMode and client fails, caller must upload file first and pass objectPath/bucket.
 */
export async function parseApkWithFallback(
  file: File,
  options: ParseApkOptions = {}
): Promise<ApkParseResult> {
  const clientResult = await parseApkFileClient(file);
  if (clientResult.success) {
    return clientResult;
  }
  if (options.isCloudMode && options.objectPath) {
    return parseApkByPath(options.objectPath, options.bucket);
  }
  return parseApkFile(file);
}

/**
 * Parse an APK already in GCS by object path (no file body to app server)
 * Use when file is uploaded to cloud first; server downloads from GCS and parses.
 * @param objectPath - GCS object path (e.g. from presigned upload response)
 * @param bucket - Optional bucket; if omitted, server uses default from config
 * @returns Promise with parsing result
 */
export async function parseApkByPath(objectPath: string, bucket?: string): Promise<ApkParseResult> {
  console.log('[APK Parser] Parsing APK from GCS path:', { objectPath, bucket });

  try {
    const response = await fetch('/api/v2/resources/parse-apk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectPath, bucket })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData?.error?.message || errorData?.error || 'Failed to parse APK file'
      };
    }

    const result = await response.json();
    console.log('[APK Parser] Successfully parsed APK from path:', result.data);
    return result;
  } catch (error) {
    console.error('[APK Parser] APK parse-by-path error:', error);
    return {
      success: false,
      error: 'Failed to parse APK file: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Parse a .deb file via server (FormData to v2 endpoint).
 * Prefer upload-to-GCS then parseDebByPath when in cloud mode.
 */
export async function parseDebFile(file: File): Promise<DebParseResult> {
  console.log('[DEB Parser] Parsing DEB via v2 (FormData):', { fileName: file.name, fileSize: file.size });

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v2/resources/parse-deb', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData?.error?.message || errorData?.error || 'Failed to parse .deb file'
      };
    }

    const result = await response.json();
    console.log('[DEB Parser] Successfully parsed DEB:', result.data);
    return result;
  } catch (error) {
    console.error('[DEB Parser] DEB parsing error:', error);
    return {
      success: false,
      error: 'Failed to parse .deb file: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Parse a .deb already in GCS by object path (no file body to app server)
 * Use when file is uploaded to cloud first; server downloads from GCS and parses.
 * @param objectPath - GCS object path (e.g. from presigned upload response)
 * @param bucket - Optional bucket; if omitted, server uses default from config
 * @returns Promise with parsing result
 */
export async function parseDebByPath(objectPath: string, bucket?: string): Promise<DebParseResult> {
  console.log('[DEB Parser] Parsing DEB from GCS path:', { objectPath, bucket });

  try {
    const response = await fetch('/api/v2/resources/parse-deb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectPath, bucket })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData?.error?.message || errorData?.error || 'Failed to parse .deb file'
      };
    }

    const result = await response.json();
    console.log('[DEB Parser] Successfully parsed DEB from path:', result.data);
    return result;
  } catch (error) {
    console.error('[DEB Parser] DEB parse-by-path error:', error);
    return {
      success: false,
      error: 'Failed to parse .deb file: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Parse a Windows .exe file via server (FormData to v2 endpoint).
 * Metadata is derived from the filename (no binary parsing needed).
 */
export async function parseExeFile(file: File): Promise<ExeParseResult> {
  console.log('[EXE Parser] Parsing EXE via v2 (FormData):', { fileName: file.name, fileSize: file.size });

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v2/resources/parse-exe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData?.error?.message || errorData?.error || 'Failed to parse .exe file'
      };
    }

    const result = await response.json();
    console.log('[EXE Parser] Successfully parsed EXE:', result.data);
    return result;
  } catch (error) {
    console.error('[EXE Parser] EXE parsing error:', error);
    return {
      success: false,
      error: 'Failed to parse .exe file: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Parse a .exe already in GCS by object path.
 * No file download — metadata is derived from the filename in the path.
 */
export async function parseExeByPath(objectPath: string, bucket?: string): Promise<ExeParseResult> {
  console.log('[EXE Parser] Parsing EXE from GCS path:', { objectPath, bucket });

  try {
    const response = await fetch('/api/v2/resources/parse-exe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectPath, bucket })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData?.error?.message || errorData?.error || 'Failed to parse .exe file'
      };
    }

    const result = await response.json();
    console.log('[EXE Parser] Successfully parsed EXE from path:', result.data);
    return result;
  } catch (error) {
    console.error('[EXE Parser] EXE parse-by-path error:', error);
    return {
      success: false,
      error: 'Failed to parse .exe file: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * Client-side EXE filename parser (no server round-trip).
 * Extracts packageName, version, architecture from filename conventions.
 */
export function parseExeFromFilename(filename: string): ExeParseResult {
  const base = filename.replace(/\.exe$/i, '');
  const KNOWN_ARCHS = new Set(['amd64', 'x86_64', 'x64', 'arm64', 'aarch64', 'x86', 'i386', 'i686', '386']);

  const norm = (s: string) => s.replace(/[\s_]+/g, '-').toLowerCase();

  // name_version_windows_arch
  let m = base.match(/^(.+?)[-_](\d+\.\d+(?:\.\d+)?)[-_]windows[-_](\w+)$/i);
  if (m) return { success: true, data: { packageName: norm(m[1]), version: m[2], description: `Windows application ${norm(m[1])}`, architecture: m[3].toLowerCase() } };

  // name_version_arch
  m = base.match(/^(.+?)[-_](\d+\.\d+(?:\.\d+)?)[-_](\w+)$/i);
  if (m && KNOWN_ARCHS.has(m[3].toLowerCase())) return { success: true, data: { packageName: norm(m[1]), version: m[2], description: `Windows application ${norm(m[1])}`, architecture: m[3].toLowerCase() } };

  // name_version
  m = base.match(/^(.+?)[-_](\d+\.\d+(?:\.\d+)?)$/);
  if (m) return { success: true, data: { packageName: norm(m[1]), version: m[2], description: `Windows application ${norm(m[1])}` } };

  // name-windows-arch
  m = base.match(/^(.+?)[-_]windows[-_](\w+)$/i);
  if (m) return { success: true, data: { packageName: norm(m[1]), version: '', description: `Windows application ${norm(m[1])}`, architecture: m[2].toLowerCase() } };

  // fallback
  return { success: true, data: { packageName: norm(base), version: '', description: `Windows application ${norm(base)}` } };
}

/**
 * Derive package name / version from a .zip filename when the archive has no app.json
 * (e.g. SDK bundles, generic archives). CPK/device packages should still ship app.json.
 */
export function parseZipFromFilename(filename: string): ExeParseResult {
  const base = filename.replace(/\.zip$/i, '').trim();
  if (!base) {
    return { success: false, error: 'Invalid ZIP filename' };
  }
  const norm = (s: string) => s.replace(/[\s_]+/g, '-').toLowerCase();

  const mVer = base.match(/^(.+)[-_](\d+\.\d+(?:\.\d+)?)$/);
  if (mVer) {
    const pkg = norm(mVer[1]);
    return {
      success: true,
      data: {
        packageName: pkg,
        version: mVer[2],
        description: `Archive ${pkg}`
      }
    };
  }

  return {
    success: true,
    data: {
      packageName: norm(base),
      version: '',
      description: `Archive ${norm(base)}`
    }
  };
}

/**
 * Parse a ZIP/APK/CPK/DEB file and extract app.json data
 * Note: For APK files, this will use app-info-parser to read Android manifest
 * For ZIP and CPK files, this will read app.json from the archive
 * For DEB files, this will use server-side parser to read DEBIAN/control
 * @param file - The ZIP/APK/CPK/DEB file to parse
 * @returns Promise with parsing result
 */
export async function parseZipFile(file: File): Promise<ZipParseResult> {
  console.log('[ZIP Parser] Starting ZIP/APK/CPK/DEB file parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  // Check if file is supported format
  const fileName = file.name.toLowerCase();
  const isZipFile = fileName.endsWith('.zip');
  const isApkFile = fileName.endsWith('.apk');
  const isCpkFile = fileName.endsWith('.cpk');
  const isDebFile = fileName.endsWith('.deb');
  
  if (!isZipFile && !isApkFile && !isCpkFile && !isDebFile) {
    return {
      success: false,
      error: 'File must be a .zip, .apk, .cpk, or .deb file'
    };
  }

  // For DEB files, use the server-side parser
  if (isDebFile) {
    console.log('[ZIP Parser] Detected DEB file, using DEB parser...');
    const debResult = await parseDebFile(file);
    
    if (!debResult.success || !debResult.data) {
      return {
        success: false,
        error: debResult.error || 'Failed to parse .deb file'
      };
    }

    // Convert DEB result to ZipParseResult format for compatibility
    const appData: AppJsonData = {
      name: debResult.data.name || debResult.data.packageName,
      display_name: debResult.data.name || debResult.data.packageName,
      domain: '',
      version: debResult.data.version,
      main: '',
      hidden: ''
    };

    return {
      success: true,
      appData
    };
  }

  // For APK files, use the app-info-parser via API
  if (isApkFile) {
    console.log('[ZIP Parser] Detected APK file, using APK parser...');
    const apkResult = await parseApkFile(file);
    
    if (!apkResult.success || !apkResult.data) {
      return {
        success: false,
        error: apkResult.error || 'Failed to parse APK file'
      };
    }

    // Convert APK result to ZipParseResult format for compatibility
    const appData: AppJsonData = {
      name: apkResult.data.packageName || '',
      display_name: apkResult.data.appName || '',
      domain: '',
      version: apkResult.data.versionName || '',
      main: '',
      hidden: ''
    };

    return {
      success: true,
      appData
    };
  }

  // For ZIP and CPK files, use the old logic (read app.json)
  try {
    // Dynamically import JSZip only when needed
    console.log('[ZIP Parser] Importing JSZip...');
    const JSZip = (await import('jszip')).default;
    console.log('[ZIP Parser] JSZip imported successfully');
    
    const fileType = isCpkFile ? 'CPK' : 'ZIP';
    console.log(`[ZIP Parser] Loading ${fileType} file...`);
    const zip = await JSZip.loadAsync(file);
    console.log(`[ZIP Parser] ${fileType} file loaded, checking for app.json...`);
    
    // List all files in the ZIP for debugging
    const allFiles = Object.keys(zip.files);
    console.log('[ZIP Parser] All files in ZIP:', allFiles);
    
    // Debug: Show detailed file information
    Object.values(zip.files).forEach((file, index) => {
      console.log(`[ZIP Parser] File ${index}:`, {
        name: file.name,
        dir: file.dir,
        size: 'unknown'
      });
    });
    
    // Just find the first app.json file anywhere in the ZIP
    const appJsonFile = Object.values(zip.files).find(file => 
      !file.dir && file.name.toLowerCase().includes('app.json')
    ) || null;
    
    console.log('[ZIP Parser] Found app.json file:', appJsonFile?.name || 'none');
    
    console.log('[ZIP Parser] app.json file check:', {
      found: !!appJsonFile,
      fileName: appJsonFile?.name,
      allFiles: allFiles
    });
    
    if (!appJsonFile) {
      // Plain .zip (not CPK): allow SDK/generic archives without app.json — infer from filename.
      if (isZipFile && !isCpkFile) {
        const synthetic = parseZipFromFilename(file.name);
        if (!synthetic.success || !synthetic.data) {
          return {
            success: false,
            error: synthetic.error || 'Could not derive metadata from ZIP filename'
          };
        }
        const pretty =
          file.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim() || synthetic.data.packageName;
        const appData: AppJsonData = {
          name: synthetic.data.packageName,
          display_name: pretty,
          domain: '',
          version: synthetic.data.version,
          main: '',
          hidden: ''
        };
        console.log('[ZIP Parser] No app.json; using filename-based metadata:', appData);
        return { success: true, appData };
      }
      console.log(`[ZIP Parser] No app.json file found in ${fileType}`);
      return {
        success: false,
        error: `No app.json file found in the ${fileType} file`
      };
    }
    
    console.log('[ZIP Parser] Reading app.json content...');
    const appJsonContent = await appJsonFile.async('text');
    console.log('[ZIP Parser] app.json content:', {
      length: appJsonContent.length,
      preview: appJsonContent.substring(0, 200) + '...'
    });
    
    try {
      const appData = JSON.parse(appJsonContent) as AppJsonData;
      console.log('[ZIP Parser] Successfully parsed app.json:', appData);
      return {
        success: true,
        appData
      };
    } catch (parseError) {
      console.error('[ZIP Parser] JSON parse error:', parseError);
      return {
        success: false,
        error: 'Invalid JSON in app.json file'
      };
    }
  } catch (error) {
    const fileType = isCpkFile ? 'CPK' : 'ZIP';
    console.error(`[ZIP Parser] ${fileType} parsing error:`, error);
    return {
      success: false,
      error: `Failed to parse ${fileType} file. The file may be corrupted or not a valid ${fileType} file.`
    };
  }
}

/**
 * Generate package name from app.json data
 * @param appData - The parsed app.json data
 * @returns Generated package name
 */
export function generatePackageName(appData: AppJsonData): string {
  console.log('[ZIP Parser] generatePackageName called with:', appData);
  
  // For APK and DEB files, the name field already contains the full package name
  // (domain is empty for APK and DEB files)
  if (!appData.domain && appData.name) {
    console.log('[ZIP Parser] APK/DEB format detected, using name as package name:', appData.name);
    return appData.name;
  }
  
  // For ZIP/CPK files, combine domain and name
  if (!appData.domain || !appData.name) {
    console.log('[ZIP Parser] Missing domain or name:', {
      domain: appData.domain,
      name: appData.name
    });
    return '';
  }
  
  // Combine domain and name to create package name
  // e.g., domain: "com.cenique", name: "com.spectrio.mpdm.x86.client" 
  // Result: "com.cenique.com.spectrio.mpdm.x86.client"
  const packageName = `${appData.domain}.${appData.name}`;
  console.log('[ZIP Parser] Generated package name:', packageName);
  return packageName;
}

/**
 * Extract display name from app.json data
 * For APK files, this returns the appName from the Android manifest
 * For ZIP/CPK files, this returns the display_name from app.json
 * For DEB files, this returns the package name (name field)
 * @param appData - The parsed app.json data
 * @returns Display name
 */
export function extractDisplayName(appData: AppJsonData): string {
  console.log('[ZIP Parser] extractDisplayName called with:', appData);
  let displayName: string = '';
  
  if (appData.display_name) {
    // Handle case where display_name might be an array (from APK parsing)
    if (Array.isArray(appData.display_name) && appData.display_name.length > 0) {
      displayName = appData.display_name[0];
    } else if (typeof appData.display_name === 'string') {
      displayName = appData.display_name;
    }
  } else {
    displayName = appData.name || '';
  }
  
  console.log('[ZIP Parser] Extracted display name:', displayName);
  return displayName;
}

/**
 * Extract version from app.json data
 * For APK files, this returns the versionName from the Android manifest
 * For ZIP/CPK files, this returns the version from app.json
 * For DEB files, this returns the version from DEBIAN/control
 * @param appData - The parsed app.json data
 * @returns Version string
 */
export function extractVersion(appData: AppJsonData): string {
  console.log('[ZIP Parser] extractVersion called with:', appData);
  const version = appData.version || '';
  console.log('[ZIP Parser] Extracted version:', version);
  return version;
}
