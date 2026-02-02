/**
 * GET /api/v2/devices/[id]/detail
 *
 * Returns the same data shape as the Device Details page: device + deviceInformation (ClickHouse metrics).
 * Used by the View Details modal so it shows the same info as the full Device Details page.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { requirePermission } from '$lib/server/security/permissions';
import { successResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { getLatestDeviceInformation, getLatestDeviceInformationByDeviceId } from '$lib/server/clickhouse/client';
import { isDeviceOnline } from '$lib/server/device/devicePresence';
import { loadDeviceProfile } from '$lib/server/device/deviceProfileLoader';
import { logger } from '$lib/server/logger';

export const GET = unifiedEndpoint(
	async ({ context, params }) => {
		const deviceId = params.id;

		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			include: {
				account: true,
				company: true,
				tags: true,
				profileAssignment: {
					include: {
						profile: {
							select: {
								id: true,
								name: true,
								description: true
							}
						}
					}
				},
				_count: {
					select: {
						actionLogs: true
					}
				}
			}
		});

		if (!device) {
			throw Object.assign(
				new Error('Device not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}

		await requirePermission(context.permissionUser, 'device.view', {
			accountId: device.accountId ?? undefined,
			createdBy: device.createdBy ?? undefined
		});

		requireResourceAccess(context, {
			accountId: device.accountId || undefined,
			createdBy: device.createdBy
		});

		// Device information (uptime, cpu, mem, disk) from ClickHouse – same as Device Details page
		let deviceInformation: Record<string, unknown> | null = null;
		try {
			const macToTry = (device as any).lanMac || (device as any).wifiMac || (device as any).macAddress;
			const info = await getLatestDeviceInformation(macToTry);
			if (!info) {
				const infoByDeviceId = await getLatestDeviceInformationByDeviceId(deviceId);
				deviceInformation = infoByDeviceId ? (infoByDeviceId as unknown as Record<string, unknown>) : null;
			} else {
				deviceInformation = info as unknown as Record<string, unknown>;
			}
		} catch (clickhouseError) {
			logger.warn('[devices/detail] ClickHouse query failed (optional)', {
				deviceId,
				error: clickhouseError instanceof Error ? clickhouseError.message : String(clickhouseError)
			});
		}

		// Real-time online status (same as Device Details page)
		let connected = device.connected;
		try {
			connected = await isDeviceOnline(device.id);
		} catch (_) {
			// Keep DB value on failure
		}

		// Device profile for Configuration tab (same as Device Details page)
		let deviceProfile: Record<string, unknown> | null = null;
		try {
			const profile = await loadDeviceProfile(prisma as any, deviceId);
			deviceProfile = profile ? (profile as unknown as Record<string, unknown>) : null;
		} catch (profileError) {
			logger.warn('[devices/detail] Failed to load device profile (optional)', {
				deviceId,
				error: profileError instanceof Error ? profileError.message : String(profileError)
			});
		}

		return successResponse(
			{
				device: { ...device, connected },
				deviceInformation,
				deviceProfile
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'device.view', skipPermission: true }
);
