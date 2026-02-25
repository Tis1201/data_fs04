import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/bundles/[id]/devices/import-csv
 * Import devices into a bundle from a CSV file.
 *
 * The CSV must have a header row with at least one of: macId, macAddress, wifiMac, lanMac, deviceId.
 * Each subsequent row is looked up against the Device table; matching devices are added to the bundle.
 *
 * Body: multipart/form-data with a "file" field containing the CSV.
 *
 * Response: { imported: number, skipped: { value: string, reason: string }[] }
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { id: true, status: true, os: true, accountId: true }
    });

    if (!bundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    if (bundle.status !== 'DRAFT') {
      throw Object.assign(
        new Error('Bundle is not editable (must be DRAFT)'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }

    const formData = await context.request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      throw Object.assign(
        new Error('CSV file is required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      throw Object.assign(
        new Error('CSV must have a header row and at least one data row'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());

    const macIdIdx = headers.indexOf('macid');
    const macAddressIdx = headers.indexOf('macaddress');
    const wifiMacIdx = headers.indexOf('wifimac');
    const lanMacIdx = headers.indexOf('lanmac');
    const deviceIdIdx = headers.indexOf('deviceid');

    if (macIdIdx === -1 && macAddressIdx === -1 && wifiMacIdx === -1 && lanMacIdx === -1 && deviceIdIdx === -1) {
      throw Object.assign(
        new Error('CSV must have at least one of these columns: macId, macAddress, wifiMac, lanMac, deviceId'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    const skipped: { value: string; reason: string }[] = [];
    const deviceIdsToAdd: string[] = [];

    const existingBundleDevices = await prisma.bundleDevice.findMany({
      where: { bundleId },
      select: { deviceId: true }
    });
    const alreadyInBundle = new Set(existingBundleDevices.map((bd: { deviceId: string }) => bd.deviceId));

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const rowLabel = `Row ${i + 1}`;

      const macId = macIdIdx !== -1 ? cols[macIdIdx] : undefined;
      const macAddress = macAddressIdx !== -1 ? cols[macAddressIdx] : undefined;
      const wifiMac = wifiMacIdx !== -1 ? cols[wifiMacIdx] : undefined;
      const lanMac = lanMacIdx !== -1 ? cols[lanMacIdx] : undefined;
      const deviceId = deviceIdIdx !== -1 ? cols[deviceIdIdx] : undefined;

      const identifier = macId || macAddress || wifiMac || lanMac || deviceId;
      if (!identifier) {
        skipped.push({ value: rowLabel, reason: 'No identifier value' });
        continue;
      }

      const orConditions: Record<string, string>[] = [];
      if (deviceId) orConditions.push({ id: deviceId });
      if (macId) {
        orConditions.push({ macAddress: macId });
        orConditions.push({ wifiMac: macId });
        orConditions.push({ lanMac: macId });
      }
      if (macAddress) orConditions.push({ macAddress });
      if (wifiMac) orConditions.push({ wifiMac });
      if (lanMac) orConditions.push({ lanMac });

      const device = await prisma.device.findFirst({
        where: {
          OR: orConditions,
          ...(bundle.accountId ? { accountId: bundle.accountId } : {})
        },
        select: { id: true, deviceType: true }
      });

      if (!device) {
        skipped.push({ value: identifier, reason: 'Device not found' });
        continue;
      }

      if (bundle.os && device.deviceType && device.deviceType.toUpperCase() !== bundle.os.toUpperCase()) {
        skipped.push({ value: identifier, reason: `OS mismatch (device: ${device.deviceType}, bundle: ${bundle.os})` });
        continue;
      }

      if (alreadyInBundle.has(device.id)) {
        skipped.push({ value: identifier, reason: 'Already in bundle' });
        continue;
      }

      if (deviceIdsToAdd.includes(device.id)) {
        skipped.push({ value: identifier, reason: 'Duplicate in CSV' });
        continue;
      }

      deviceIdsToAdd.push(device.id);
    }

    let importedCount = 0;
    if (deviceIdsToAdd.length > 0) {
      const toCreate = deviceIdsToAdd.map((dId) => ({
        bundleId,
        deviceId: dId,
        status: 'PENDING',
        createdBy: session.user.id,
        updatedBy: session.user.id
      }));

      const result = await prisma.bundleDevice.createMany({
        data: toCreate,
        skipDuplicates: true
      });
      importedCount = result.count;

      const created = await prisma.bundleDevice.findMany({
        where: { bundleId, deviceId: { in: deviceIdsToAdd } }
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
    }

    logger.info(`CSV import: ${importedCount} device(s) added to bundle ${bundleId}, ${skipped.length} skipped, by user ${session.user.id}`);

    return successResponse(
      { imported: importedCount, skipped },
      { message: importedCount > 0 ? `${importedCount} device(s) imported successfully` : 'No devices were imported' }
    );
  },
  { permission: 'bundle.edit', skipPermission: true }
);
