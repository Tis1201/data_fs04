import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/** Normalize MAC for comparison: uppercase, keep colons (DB usually stores with colons) */
function normalizeMac(value: string): string {
  return value.replace(/[-.\s]/g, '').replace(/(.{2})(?=.)/g, '$1:').toUpperCase();
}

/** Parse CSV; required column: macId (or mac, macAddress, deviceId). Only macId is used; no other columns required. */
function parseBundleImportCsv(content: string): { values: string[]; error?: string } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { values: [] };
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const macCol = header.find((h) => h === 'macid' || h === 'mac' || h === 'macaddress' || h === 'mac_address');
  const idCol = header.find((h) => h === 'deviceid' || h === 'device_id' || h === 'id');
  const colIndex = macCol !== undefined ? header.indexOf(macCol) : idCol !== undefined ? header.indexOf(idCol) : -1;
  if (colIndex < 0) {
    return { values: [], error: 'CSV must include a macId column.' };
  }
  const values: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const raw = (cols[colIndex] ?? '').trim();
    if (raw.length >= 6) values.push(raw);
  }
  return { values: [...new Set(values)] };
}

/**
 * POST /api/v2/bundles/[id]/devices/import-csv
 * Import devices into a bundle from CSV. Only macId column is required (one MAC or device ID per row).
 * Validates by bundle OS: only devices whose deviceType matches bundle.os (case-insensitive) are added.
 * Non-existent or OS-mismatch rows are skipped and returned as warnings; valid devices are still imported.
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;

    const contentType = context.request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      throw Object.assign(new Error('Content-Type must be multipart/form-data'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    let file: File;
    try {
      const formData = await context.request.formData();
      const raw = formData.get('file');
      if (!(raw instanceof File)) {
        throw Object.assign(new Error('Missing file in form data (field: file)'), {
          status: 400,
          code: ErrorCodes.INVALID_INPUT
        });
      }
      file = raw;
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e) throw e;
      throw Object.assign(new Error('Invalid form data'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    const name = (file.name ?? '').toLowerCase();
    if (!name.endsWith('.csv') && file.type !== 'text/csv') {
      throw Object.assign(new Error('File must be a CSV'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      throw Object.assign(new Error('Failed to read file'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    const parsed = parseBundleImportCsv(text);
    if (parsed.error) {
      throw Object.assign(new Error(parsed.error), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }
    if (parsed.values.length === 0) {
      return successResponse(
        { imported: 0, skipped: [] },
        { message: 'No valid rows to import. CSV must have a macId column with at least 6 characters per value.' }
      );
    }

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { id: true, status: true, os: true }
    });

    if (!bundle) {
      throw Object.assign(new Error('Bundle not found'), {
        status: 404,
        code: ErrorCodes.NOT_FOUND
      });
    }

    if (bundle.status !== 'DRAFT') {
      throw Object.assign(
        new Error('Bundle is not editable (must be DRAFT)'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }

    const bundleOs = (bundle as { os?: string | null }).os;
    const existingBundleDeviceIds = new Set(
      (await prisma.bundleDevice.findMany({
        where: { bundleId },
        select: { deviceId: true }
      })).map((r: { deviceId: string }) => r.deviceId)
    );

    const skipped: Array<{ value: string; reason: string }> = [];
    const toAddDeviceIds: string[] = [];
    const seenDeviceIds = new Set<string>();

    for (const value of parsed.values) {
      // Try by device id first (CUID-like or any id)
      let device: { id: string; deviceType: string | null } | null = null;
      if (value.length >= 20 && value.length <= 30) {
        device = await prisma.device.findUnique({
          where: { id: value },
          select: { id: true, deviceType: true }
        });
      }
      if (!device) {
        const normalized = normalizeMac(value);
        const found = await prisma.device.findFirst({
          where: {
            OR: [
              { macAddress: { equals: normalized, mode: 'insensitive' } },
              { wifiMac: { equals: normalized, mode: 'insensitive' } },
              { macAddress: { equals: value, mode: 'insensitive' } },
              { wifiMac: { equals: value, mode: 'insensitive' } }
            ]
          },
          select: { id: true, deviceType: true }
        });
        device = found;
      }

      if (!device) {
        skipped.push({ value, reason: 'Device not found' });
        continue;
      }

      if (existingBundleDeviceIds.has(device.id) || seenDeviceIds.has(device.id)) {
        skipped.push({ value, reason: 'Already in bundle' });
        continue;
      }

      if (bundleOs && typeof bundleOs === 'string' && bundleOs.trim() !== '') {
        const deviceType = (device.deviceType ?? '').trim();
        const osMatch = deviceType.toLowerCase() === bundleOs.trim().toLowerCase();
        if (!osMatch) {
          skipped.push({
            value,
            reason: `OS mismatch (bundle expects ${bundleOs}, device is ${deviceType || 'unknown'})`
          });
          continue;
        }
      }

      seenDeviceIds.add(device.id);
      toAddDeviceIds.push(device.id);
      existingBundleDeviceIds.add(device.id);
    }

    if (toAddDeviceIds.length === 0) {
      return successResponse(
        { imported: 0, skipped },
        { message: 'No devices were added. All rows were skipped (not found, OS mismatch, or already in bundle).' }
      );
    }

    const toCreate = toAddDeviceIds.map((deviceId) => ({
      bundleId,
      deviceId,
      status: 'PENDING' as const,
      createdBy: session.user.id,
      updatedBy: session.user.id
    }));

    const result = await prisma.bundleDevice.createMany({
      data: toCreate,
      skipDuplicates: true
    });

    const created = await prisma.bundleDevice.findMany({
      where: { bundleId, deviceId: { in: toAddDeviceIds } }
    });

    for (const bd of created) {
      await logAudit({
        actionType: AuditActionType.INSERT,
        tableName: 'BundleDevice',
        recordId: bd.id,
        oldData: null,
        newData: bd,
        userId: session.user.id,
        ipAddress: context.ipAddress,
        prisma
      });
    }

    logger.info(
      `Bundle import-csv: added ${result.count} device(s) to bundle ${bundleId}, skipped ${skipped.length}`,
      { bundleId, imported: result.count, skipped: skipped.length, userId: session.user.id }
    );

    return successResponse(
      {
        imported: result.count,
        skipped
      },
      {
        message:
          skipped.length === 0
            ? `Successfully imported ${result.count} device(s).`
            : `Imported ${result.count} device(s). ${skipped.length} row(s) skipped (see warnings).`
      }
    );
  },
  { permission: 'bundle.edit', skipPermission: true }
);
