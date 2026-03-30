import { ErrorCodes } from '$lib/types/api';
import {
	canAccessResourceFields,
	normalizeResourceAccessInput
} from '$lib/server/api/unifiedEndpoint';
import type { SystemRole } from '$lib/server/features/flags';

const INSTALL_CHECK_USER_ID = '__install_scope_check__';

function forbidden(msg: string) {
	return Object.assign(new Error(msg), { status: 403, code: ErrorCodes.FORBIDDEN });
}

export function accountMayInstallResource(accountId: string, resource: Record<string, unknown>): boolean {
	const accessInput = normalizeResourceAccessInput(resource);
	if (accessInput.shareScope === 'PUBLIC_DEVELOPER') {
		return false;
	}
	return canAccessResourceFields(
		{
			systemRole: 'USER' as SystemRole,
			userId: INSTALL_CHECK_USER_ID,
			accountId
		},
		accessInput
	);
}

export function assertResourceRowInstallableByAccount(
	accountId: string | null | undefined,
	resource: Record<string, unknown>
): void {
	if (!accountId) {
		throw Object.assign(new Error('Bundle has no account'), {
			status: 400,
			code: ErrorCodes.INVALID_INPUT
		});
	}
	if (!accountMayInstallResource(accountId, resource)) {
		throw forbidden('This resource cannot be installed for this account');
	}
}

export async function assertCanInstallResource(
	prisma: any,
	accountId: string,
	deviceId: string,
	resourceId: string
): Promise<void> {
	const device = await prisma.device.findFirst({
		where: { id: deviceId, accountId },
		select: { id: true }
	});
	if (!device) {
		throw forbidden('Device not found or not in this account');
	}
	await assertResourceInstallableByAccount(prisma, accountId, resourceId);
}

export async function assertResourceInstallableByAccount(
	prisma: any,
	accountId: string | null | undefined,
	resourceId: string
): Promise<void> {
	if (!accountId) {
		throw Object.assign(new Error('Bundle has no account'), {
			status: 400,
			code: ErrorCodes.INVALID_INPUT
		});
	}
	const resource = await prisma.resource.findUnique({
		where: { id: resourceId },
		include: { sharedWithAccounts: { select: { accountId: true } } }
	});
	if (!resource) {
		throw Object.assign(new Error('Resource not found'), {
			status: 404,
			code: ErrorCodes.NOT_FOUND
		});
	}
	assertResourceRowInstallableByAccount(accountId, resource as Record<string, unknown>);
}

export async function assertResourcesInstallableForAccount(
	prisma: any,
	accountId: string | null | undefined,
	apps: Array<{ resourceId: string | null }>
): Promise<void> {
	if (!accountId) {
		throw Object.assign(new Error('Bundle has no account'), {
			status: 400,
			code: ErrorCodes.INVALID_INPUT
		});
	}

	const resourceIds = [
		...new Set(
			apps
				.map((a) => a.resourceId)
				.filter((id): id is string => typeof id === 'string' && id.length > 0)
		)
	];

	if (resourceIds.length === 0) return;

	const resources = await prisma.resource.findMany({
		where: { id: { in: resourceIds } },
		include: { sharedWithAccounts: { select: { accountId: true } } }
	});
	const byId = new Map(resources.map((r: { id: string }) => [r.id, r]));
	for (const rid of resourceIds) {
		const r = byId.get(rid);
		if (!r) {
			throw Object.assign(new Error('Resource not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}
		if (!accountMayInstallResource(accountId, r as Record<string, unknown>)) {
			throw forbidden('One or more apps are not available for install to this account');
		}
	}
}

export async function assertBundleWaveInstallAllowed(
	prisma: any,
	accountId: string | null | undefined,
	apps: Array<{ resourceId: string | null; resource?: unknown }>,
	progresses: Array<{ bundleDevice?: { deviceId?: string | null } | null }>
): Promise<void> {
	if (!accountId) {
		throw Object.assign(new Error('Bundle has no account'), {
			status: 400,
			code: ErrorCodes.INVALID_INPUT
		});
	}

	const deviceIds = [
		...new Set(
			progresses
				.map((p) => p.bundleDevice?.deviceId)
				.filter((id): id is string => typeof id === 'string' && id.length > 0)
		)
	];

	if (deviceIds.length > 0) {
		const devices = await prisma.device.findMany({
			where: { id: { in: deviceIds }, accountId },
			select: { id: true }
		});
		const ok = new Set(devices.map((d: { id: string }) => d.id));
		const missing = deviceIds.filter((id) => !ok.has(id));
		if (missing.length > 0) {
			throw forbidden('One or more devices are not in this bundle account');
		}
	}

	await assertResourcesInstallableForAccount(prisma, accountId, apps);
}
