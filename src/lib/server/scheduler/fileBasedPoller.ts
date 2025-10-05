import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { logger } from '$lib/server/logger';
import { processEvent, type FileStatusEvent } from './bundleEventProcessor';
import { applyTimeouts } from './bundleTimeoutManager';

const DEFAULT_LOG_PATH = process.env.FILE_STATUS_LOG || '/Users/macos/Desktop/out/fs04_device/workings/bundle_status.log';
const DEFAULT_OFFSET_PATH = process.env.FILE_STATUS_OFFSET || '/Users/macos/Desktop/out/fs04_web/workings/bundle_status.offset';

export async function pollOnce(logPath: string, offsetPath: string) {
  const now = new Date().toISOString();
  // If file missing, skip
  if (!fs.existsSync(logPath)) {
    logger.debug(`[FileBasedPoller] ${now} - Log file not found: ${logPath}`);
    return;
  }

  const fd = await fsp.open(logPath, 'r');
  try {
    const stat = await fd.stat();
    let offset = await readOffset(offsetPath);
    if (offset > stat.size) {
      // File was truncated/rotated
      offset = 0;
      logger.info(`[FileBasedPoller] Detected truncation/rotation. Reset offset to 0 (size=${stat.size})`);
    }

    if (offset === stat.size) {
      logger.debug(`[FileBasedPoller] ${now} - No new data (size=${stat.size}, offset=${offset})`);
      return; // no new data
    }

    logger.info(`[FileBasedPoller] ${now} - Found new data: ${stat.size - offset} bytes (size=${stat.size}, offset=${offset})`);

    const bufSize = stat.size - offset;
    const buffer = Buffer.allocUnsafe(bufSize);
    await fd.read(buffer, 0, bufSize, offset);
    const chunk = buffer.toString('utf8');
    const lines = chunk.split(/\r?\n/).filter(Boolean);

    logger.info(`[FileBasedPoller] Read ${lines.length} new line(s) (from=${offset}, to=${stat.size})`);

    for (const line of lines) {
      try {
        const evt = JSON.parse(line) as FileStatusEvent;
        logger.info(`[FileBasedPoller] Processing event: ${evt.deviceId} -> ${evt.bundleId} (${evt.status}, ${evt.progress}%)`);
        await processEvent(evt);
        logger.info(`[FileBasedPoller] Successfully processed event for device ${evt.deviceId}`);
      } catch (e: any) {
        logger.warn(`[FileBasedPoller] Bad line skipped: ${line.slice(0, 200)}... (${String(e?.message || e)})`);
      }
    }

    // Advance offset to end
    await writeOffset(offsetPath, stat.size);
    logger.debug(`[FileBasedPoller] Advanced offset to ${stat.size}`);
  } finally {
    await fd.close();
  }

  // After handling new events, run timeout pass
  try {
    await applyTimeouts();
  } catch (e: any) {
    logger.warn(`[FileBasedPoller] Timeout pass error: ${String(e?.message || e)}`);
  }
}

async function readOffset(offsetPath: string): Promise<number> {
  try {
    const raw = await fsp.readFile(offsetPath, 'utf8');
    const n = Number(raw.trim());
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeOffset(offsetPath: string, value: number) {
  try {
    await fsp.writeFile(offsetPath, String(value));
  } catch (e) {
    logger.warn(`[FileBasedPoller] Failed writing offset: ${String(e)}`);
  }
}

let fileBasedPollerTimer: NodeJS.Timeout | null = null;

export function startFileBasedPoller() {
  if (fileBasedPollerTimer) {
    logger.warn(`[FileBasedPoller] Already running, skipping start (timer=${!!fileBasedPollerTimer})`);
    return fileBasedPollerTimer;
  }

  const POLL_MS = Number(process.env.FILE_STATUS_POLL_MS || 60000);
  
  logger.info(`[FileBasedPoller] Starting with file-based polling (interval=${POLL_MS}ms, file=${DEFAULT_LOG_PATH})`);
  
  // Ensure offset directory exists
  try {
    fs.mkdirSync(path.dirname(DEFAULT_OFFSET_PATH), { recursive: true });
  } catch {}

  fileBasedPollerTimer = setInterval(async () => {
    const startTime = Date.now();
    try {
      logger.debug(`[FileBasedPoller] Starting poll cycle at ${new Date().toISOString()}`);
      await pollOnce(DEFAULT_LOG_PATH, DEFAULT_OFFSET_PATH);
      const duration = Date.now() - startTime;
      logger.debug(`[FileBasedPoller] Poll cycle completed in ${duration}ms`);
    } catch (e: any) {
      const duration = Date.now() - startTime;
      logger.warn(`[FileBasedPoller] Poll error after ${duration}ms: ${String(e?.message || e)}`);
    }
  }, POLL_MS);

  logger.info(`[FileBasedPoller] Started successfully with file-based polling (file=${DEFAULT_LOG_PATH}, interval=${POLL_MS}ms)`);
  
  return fileBasedPollerTimer;
}

export function stopFileBasedPoller() {
  if (fileBasedPollerTimer) {
    clearInterval(fileBasedPollerTimer);
    fileBasedPollerTimer = null;
    logger.info('[FileBasedPoller] Stopped');
  }
}
