import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';
import { ResourceShareScope } from '@prisma/client';
import { radarDownloadPackages } from '$lib/content/developers/radarSdkDoc';

function formatApproxSize(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `~${Math.round(bytes / 1024)} KB`;
	}
	return `${bytes} B`;
}

function versionLabel(raw: string | null | undefined, fallback: string): string {
	if (raw == null || raw === '') return fallback;
	const s = String(raw).trim();
	if (s.startsWith('v')) return s;
	return `v${s}`;
}

/**
 * Match one Developer SDK catalog row. Used for every slot in `radarDownloadPackages`
 * (radar-c++-sdk, radar-node.js-sdk, radar-android-sdk): exact `packageName`, or any
 * versioned name that starts with `{catalogId}-` or `{catalogId}_`.
 */
function whereCatalogPackageName(catalogPackageName: string) {
	return {
		shareScope: ResourceShareScope.PUBLIC_DEVELOPER,
		OR: [
			{ packageName: catalogPackageName },
			{ packageName: { startsWith: `${catalogPackageName}-` } },
			{ packageName: { startsWith: `${catalogPackageName}_` } }
		]
	};
}

export const load = restrict(
	async (_event: AuthenticatedLoadEvent) => {
		const packageNames = radarDownloadPackages.map((p) => p.catalogPackageName);
		const latestRows = await prisma.$transaction(
			packageNames.map((catalogPackageName) =>
				prisma.resource.findFirst({
					where: whereCatalogPackageName(catalogPackageName),
					orderBy: { createdAt: 'desc' },
					select: {
						id: true,
						version: true,
						size: true
					}
				})
			)
		);

		const radarPackages = radarDownloadPackages.map((pkg, i) => {
			const row = latestRows[i];
			if (!row) {
				return {
					...pkg,
					resourceId: undefined as string | undefined,
					version: pkg.version,
					sizeLabel: pkg.size
				};
			}
			return {
				...pkg,
				resourceId: row.id,
				version: versionLabel(row.version, pkg.version),
				sizeLabel: formatApproxSize(row.size)
			};
		});

		return { radarPackages };
	},
	[SystemRole.USER, SystemRole.ADMIN]
);
