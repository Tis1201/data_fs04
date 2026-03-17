import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { PIN_RULE_NAME_MAX, PIN_RULE_DESCRIPTION_MAX } from '$lib/constants/pinRule';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/pin-rules/[id]/duplicate
 * Duplicate a pin rule (same pattern as bundles duplicate).
 * Creates a copy with unique name: " (Copy)", " (Copy 2)", " (Copy 3)", etc. (TC-RDM-APR-0093).
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
				isActive: true,
				isSystemRule: true,
				fallbackScreenEnabled: true,
				fallbackScreenUrl: true
			}
		});

		if (!original) {
			throw Object.assign(new Error('Pin rule not found'), {
				status: 404,
				code: ErrorCodes.NOT_FOUND
			});
		}

		// Account system rules cannot be duplicated
		if (original.isSystemRule) {
			throw Object.assign(new Error('System rules cannot be duplicated'), {
				status: 403,
				code: ErrorCodes.FORBIDDEN
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

		// TC-RDM-APR-0093: Generate unique name for multiple duplication (e.g. "Test (Copy)", "Test (Copy 2)", "Test (Copy 3)")
		const copySuffixBase = ' (Copy)';
		const baseNameRaw = original.name.replace(/\s*\(Copy(?:\s*\d+)?\)\s*$/i, '').trim() || original.name;
		const maxBaseLen = PIN_RULE_NAME_MAX - copySuffixBase.length - 5; // reserve space for " (Copy N)"
		const baseName = baseNameRaw.length > maxBaseLen ? baseNameRaw.slice(0, maxBaseLen).trimEnd() : baseNameRaw;

		const existingSameAccount = await prisma.pinRule.findMany({
			where: { accountId: original.accountId },
			select: { name: true }
		});
		const exactCopy = `${baseName} (Copy)`;
		const copyPrefix = `${baseName} (Copy `;
		const existingNumbers: number[] = [];
		for (const r of existingSameAccount) {
			if (r.name === exactCopy) existingNumbers.push(1);
			else if (r.name.startsWith(copyPrefix) && r.name.endsWith(')')) {
				const numStr = r.name.slice(copyPrefix.length, -1).trim();
				const n = parseInt(numStr, 10);
				if (!Number.isNaN(n) && n >= 2) existingNumbers.push(n);
			}
		}
		const nextNum = existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;
		const copySuffix = nextNum === 1 ? copySuffixBase : ` (Copy ${nextNum})`;
		const newName = `${baseName}${copySuffix}`.slice(0, PIN_RULE_NAME_MAX);

		const descCopySuffix = ' (Copy)';
		const maxDescBaseLen = PIN_RULE_DESCRIPTION_MAX - descCopySuffix.length;
		const descToCopy = original.description
			? (original.description.length > maxDescBaseLen
				? original.description.slice(0, maxDescBaseLen).trimEnd()
				: original.description) + descCopySuffix
			: null;
		const newRule = await prisma.pinRule.create({
			data: {
				name: newName,
				description: descToCopy,
				ruleType: 'user_custom',
				createdBy: session.user.id,
				accountId: original.accountId,
				apps: original.apps ?? [],
				targetType: original.targetType,
				targetValue: original.targetValue ?? [],
				priority: original.priority ?? 0,
				isActive: false,
				fallbackScreenEnabled: original.fallbackScreenEnabled ?? false,
				fallbackScreenUrl: original.fallbackScreenUrl ?? null
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
