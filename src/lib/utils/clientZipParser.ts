// Client-side ZIP/APK/CPK parsing utility
// Note: This uses JSZip for browser-based ZIP/APK/CPK parsing
// APK files are essentially ZIP files with a different extension
// CPK files are also ZIP files with a different extension

export interface AppJsonData {
  name: string;
  display_name: string;
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

/**
 * Parse a ZIP/APK/CPK file and extract app.json data
 * @param file - The ZIP/APK/CPK file to parse
 * @returns Promise with parsing result
 */
export async function parseZipFile(file: File): Promise<ZipParseResult> {
  console.log('[ZIP Parser] Starting ZIP/APK/CPK file parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  // Check if file is supported format
  const fileName = file.name.toLowerCase();
  const isZipFile = fileName.endsWith('.zip');
  const isApkFile = fileName.endsWith('.apk');
  const isCpkFile = fileName.endsWith('.cpk');
  
  if (!isZipFile && !isApkFile && !isCpkFile) {
    return {
      success: false,
      error: 'File must be a .zip, .apk, or .cpk file'
    };
  }

  try {
    // Dynamically import JSZip only when needed
    console.log('[ZIP Parser] Importing JSZip...');
    const JSZip = (await import('jszip')).default;
    console.log('[ZIP Parser] JSZip imported successfully');
    
    const fileType = isApkFile ? 'APK' : isCpkFile ? 'CPK' : 'ZIP';
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
    const fileType = isApkFile ? 'APK' : isCpkFile ? 'CPK' : 'ZIP';
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
 * @param appData - The parsed app.json data
 * @returns Display name
 */
export function extractDisplayName(appData: AppJsonData): string {
  console.log('[ZIP Parser] extractDisplayName called with:', appData);
  const displayName = appData.display_name || appData.name || '';
  console.log('[ZIP Parser] Extracted display name:', displayName);
  return displayName;
}

/**
 * Extract version from app.json data
 * @param appData - The parsed app.json data
 * @returns Version string
 */
export function extractVersion(appData: AppJsonData): string {
  console.log('[ZIP Parser] extractVersion called with:', appData);
  const version = appData.version || '';
  console.log('[ZIP Parser] Extracted version:', version);
  return version;
}
