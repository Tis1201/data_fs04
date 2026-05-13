/**
 * POST /api/devices/[id]/apps/report
 * Device-only: report installed app list to ClickHouse (logs_raw → mv_device_apps).
 * Used by emulator or real device to sync app list so GET /api/v2/devices/[id]/apps returns data from ClickHouse (same as production).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict_device } from '$lib/server/security/guards';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

const ReportAppsSchema = z.object({
  apps: z.array(z.object({
    packageName: z.string(),
    appName: z.string(),
    version: z.string().optional(),
    appType: z.string().optional(),
    metadata: z.union([z.string(), z.record(z.unknown())]).optional(),
    sizeBytes: z.union([z.number(), z.string()]).optional()
  }))
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const result = await restrict_device({ locals, request });

  if ('error' in result) {
    return json(
      { success: false, error: result.error, message: result.error },
      { status: result.response.status }
    );
  }

  const { device } = result;
  if (params.id !== device.id) {
    return json(
      { success: false, error: 'Forbidden', message: 'Device ID does not match' },
      { status: 403 }
    );
  }
  if (device.status !== 'ACTIVE') {
    return json(
      { success: false, error: 'Device not active', message: 'Device not active' },
      { status: 400 }
    );
  }

  if (!deviceAppService.isAvailable()) {
    return json(
      { success: false, error: 'ClickHouse unavailable', message: 'App report service is not configured' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, error: 'Invalid JSON', message: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parsed = ReportAppsSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { success: false, error: 'Validation failed', message: parsed.error.message, issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { apps } = parsed.data;
  if (apps.length === 0) {
    return json({ success: true, message: 'No apps to report', reported: 0 });
  }

  try {
    await deviceAppService.insertDeviceAppReport(device.id, apps);
    logger.info('[DeviceAppsReport] Reported apps to ClickHouse', { deviceId: device.id, count: apps.length });
    return json({ success: true, message: 'Apps reported', reported: apps.length });
  } catch (e) {
    logger.error('[DeviceAppsReport] Failed to report apps', {
      deviceId: device.id,
      error: e instanceof Error ? e.message : String(e)
    });
    return json(
      { success: false, error: 'Report failed', message: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
};
