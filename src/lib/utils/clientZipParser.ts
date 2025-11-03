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
    appName: string | null;
  };
  error?: string;
}

/**
 * Parse an APK file using the server-side parser
 * @param file - The APK file to parse
 * @returns Promise with parsing result
 */
export async function parseApkFile(file: File): Promise<ApkParseResult> {
  console.log('[APK Parser] Starting APK file parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/admin/iot/resources/parse-apk', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Failed to parse APK file'
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
 * Parse a ZIP/APK/CPK file and extract app.json data
 * Note: For APK files, this will use app-info-parser to read Android manifest
 * For ZIP and CPK files, this will read app.json from the archive
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
  
  // For APK files, the name field already contains the full package name
  // (domain is empty for APK files)
  if (!appData.domain && appData.name) {
    console.log('[ZIP Parser] APK format detected, using name as package name:', appData.name);
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
 * @param appData - The parsed app.json data
 * @returns Version string
 */
export function extractVersion(appData: AppJsonData): string {
  console.log('[ZIP Parser] extractVersion called with:', appData);
  const version = appData.version || '';
  console.log('[ZIP Parser] Extracted version:', version);
  return version;
}
