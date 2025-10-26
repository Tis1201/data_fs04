import unzipper from 'unzipper';
import { logger } from '$lib/server/logger';

export interface AppJsonData {
  name: string;
  display_name: string;
  domain: string;
  version: string;
  main: string;
  hidden: string;
}

export async function readJsonFromZip(zipPath: string, filename = 'app.json'): Promise<AppJsonData | null> {
  try {
    const dir = await unzipper.Open.file(zipPath);
    const entry = dir.files.find(f => new RegExp(`(?:^|/)${filename}$`, 'i').test(f.path));
    
    if (!entry) {
      logger.warn(`No ${filename} file found in ZIP: ${zipPath}}`);
      return null;
    }

    // stream -> buffer just this entry
    const buf = await entry.buffer();
    const jsonString = buf.toString('utf8');
    
    try {
      const appData = JSON.parse(jsonString) as AppJsonData;
      logger.info(`Successfully parsed ${filename} from ZIP:`, {
        zipPath,
        appData: {
          name: appData.name,
          domain: appData.domain,
          version: appData.version
        }
      });
      return appData;
    } catch (parseError) {
      logger.error(`Failed to parse ${filename} JSON:`, {
        zipPath,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        jsonString: jsonString.substring(0, 200) + '...' // Log first 200 chars for debugging
      });
      return null;
    }
  } catch (error) {
    logger.error(`Failed to read ${filename} from ZIP:`, {
      zipPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export function generatePackageName(appData: AppJsonData): string {
  if (!appData.domain || !appData.name) {
    return '';
  }
  
  // Combine domain and name to create package name
  // e.g., domain: "com.cenique", name: "com.spectrio.mpdm.x86.client" 
  // Result: "com.cenique.com.spectrio.mpdm.x86.client"
  return `${appData.domain}.${appData.name}`;
}

export function extractDisplayName(appData: AppJsonData): string {
  return appData.display_name || appData.name || '';
}

export function extractVersion(appData: AppJsonData): string {
  return appData.version || '';
}
