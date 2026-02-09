import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/pin-rules/[id]/duplicate
 * Duplicate a pin rule (same pattern as bundles duplicate).
 * Creates a copy with name " (Copy)", user_custom type, same apps/target/settings, isActive: false.
 */
export const POST = unifiedEndpoint(
	async ({ context, params }) => {
		const { session, account, prisma } = context;
		const { id: ruleId } = params;

		const original = await prisma.pinRule.findUnique({
			where: { id: ruleId },
			select: {
				id: true,
				name: true,
				description: true,
				ruleType: true,
				accountId: true,
				createdBy: true,
				apps: true,
				targetType: true,
				targetValue: true,
				priority: true,
				isActive: true
			}
		});

		if (!original) {
			throw Object.assign(new Error('Pin rule not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		// Same access logic as GET: user can duplicate rules they can access
		if (session.user.systemRole === 'USER') {
			const userAccountId = account?.id;
			const canAccess =
				(original.ruleType === 'user_default' && original.accountId === userAccountId) ||
				(original.ruleType === 'user_custom' &&
					original.accountId === userAccountId &&
					original.createdBy === session.user.id);
			if (!canAccess) {
				throw Object.assign(new Error('You do not have permission to duplicate this pin rule'), {
					status: 403,
					code: ErrorCodes.FORBIDDEN
				});
			}
		}
		// ADMIN can duplicate admin_* rules; for user_* rules they may not have account context, so allow if they can see it
		if (session.user.systemRole === 'ADMIN' && (original.ruleType === 'user_default' || original.ruleType === 'user_custom')) {
			// Admin duplicating a user rule: keep same accountId, createdBy = admin (or keep original createdBy for audit)
			// Create as user_custom so it's editable by the account
		}

		const newRule = await prisma.pinRule.create({
			data: {
				name: `${original.name} (Copy)`,
				description: original.description ? `${original.description} (Copy)` : null,
				ruleType: 'user_custom',
				createdBy: session.user.id,
				accountId: original.accountId,
				apps: original.apps ?? [],
				targetType: original.targetType,
				targetValue: original.targetValue ?? [],
				priority: original.priority ?? 0,
				isActive: false
			}
		});

		logger.info(`Pin rule ${ruleId} duplicated to ${newRule.id} by user ${session.user.id}`);

		await logAudit({
			actionType: AuditActionType.INSERT,
			tableName: 'PinRule',
			recordId: newRule.id,
			oldData: null,
			newData: newRule,
			userId: session.user.id,
			ipAddress: context.ipAddress || undefined,
			prisma
		});

		return successResponse(
			{
				id: newRule.id,
				name: newRule.name,
				message: 'Pin rule duplicated successfully'
			},
			{ message: 'Pin rule duplicated successfully', status: 201 }
		);
	},
	{ skipPermission: true }
);
