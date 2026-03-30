import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';

const SCOPE_NONE = 'NONE';
const SCOPE_ALL = 'ALL_ACCOUNTS';
const SCOPE_SELECTED = 'SELECTED_ACCOUNTS';
const SCOPE_PUBLIC_DEVELOPER = 'PUBLIC_DEVELOPER';
const VALID_SCOPES = new Set<string>([
	SCOPE_NONE,
	SCOPE_ALL,
	SCOPE_SELECTED,
	SCOPE_PUBLIC_DEVELOPER
]);

export const PATCH = unifiedEndpoint(
	async ({ context, event, params }) => {
		if (!context.isAdmin) {
			throw Object.assign(new Error('Only administrators can change resource sharing'), {
				status: 403,
				code: ErrorCodes.FORBIDDEN
			});
		}

		const { id } = params;
		if (!id) {
			throw Object.assign(new Error('Resource ID is required'), {
				status: 400,
				code: ErrorCodes.INVALID_INPUT
			});
		}

		let body: unknown;
		try {
			body = await event.request.json();
		} catch {
			throw Object.assign(new Error('Invalid JSON body'), {
				status: 400,
				code: ErrorCodes.INVALID_INPUT
			});
		}

		const raw = body as { shareScope?: unknown; accountIds?: unknown };
		const shareScope = raw.shareScope;
		if (typeof shareScope !== 'string' || !VALID_SCOPES.has(shareScope)) {
			throw Object.assign(new Error('Invalid or missing shareScope'), {
				status: 400,
				code: ErrorCodes.VALIDATION_ERROR
			});
		}

		const accountIdsRaw = raw.accountIds;
		const accountIds =
			Array.isArray(accountIdsRaw)
				? [
						...new Set(
							accountIdsRaw.filter((x): x is string => typeof x === 'string' && x.length > 0)
						)
					]
				: [];

		if (shareScope === SCOPE_SELECTED && accountIds.length === 0) {
			throw Object.assign(
				new Error('Select at least one account, or choose Private or All accounts'),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}

		if (shareScope === SCOPE_PUBLIC_DEVELOPER && accountIds.length > 0) {
			throw Object.assign(
				new Error('Developer catalog scope does not use account picks'),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}

		const existing = await context.prisma.resource.findUnique({ where: { id } });
		if (!existing) {
			throw Object.assign(new Error('Resource not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		if (shareScope === SCOPE_SELECTED) {
			const found = await context.prisma.account.findMany({
				where: {
					id: { in: accountIds },
					OR: [{ isSystem: false }, { id: existing.accountId }]
				},
				select: { id: true }
			});
			if (found.length !== accountIds.length) {
				throw Object.assign(new Error('One or more account IDs are invalid'), {
					status: 400,
					code: ErrorCodes.VALIDATION_ERROR
				});
			}
		}

		await context.prisma.$transaction(async (tx: any) => {
			await tx.resourceAccountShare.deleteMany({ where: { resourceId: id } });
			if (shareScope === SCOPE_PUBLIC_DEVELOPER) {
				await tx.resource.update({
					where: { id },
					data: {
						shareScope: SCOPE_PUBLIC_DEVELOPER,
						updatedAt: new Date(),
						updatedBy: context.session.user.id
					}
				});
				return;
			}
			if (shareScope === SCOPE_SELECTED) {
				await tx.resourceAccountShare.createMany({
					data: accountIds.map((accountId) => ({ resourceId: id, accountId })),
					skipDuplicates: true
				});
			}
			await tx.resource.update({
				where: { id },
				data: {
					shareScope,
					updatedAt: new Date(),
					updatedBy: context.session.user.id
				}
			});
		});

		const updated = await context.prisma.resource.findUnique({
			where: { id },
			include: {
				sharedWithAccounts: { select: { accountId: true } }
			}
		});

		if (!updated) {
			throw Object.assign(new Error('Resource not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		return successResponse({
			shareScope: updated.shareScope,
			sharedWithAccountIds: updated.sharedWithAccounts.map((s: { accountId: string }) => s.accountId)
		});
	},
	{ permission: 'resource.edit' }
);
