import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { PIN_RULE_NAME_MAX, PIN_RULE_DESCRIPTION_MAX } from '$lib/constants/pinRule';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { deleteFileFromCloudStorage, deleteFilesFromCloudStorageByPrefix } from '$lib/server/storage';

// GET /api/v2/pin-rules/[id] - Get a specific pin rule
export const GET = unifiedEndpoint(async ({ context, params }) => {
	const { session, account, prisma } = context;
	const { id } = params;

	const rule = await prisma.pinRule.findUnique({
		where: { id },
		include: {
			createdByUser: {
				select: {
					id: true,
					name: true,
					email: true
				}
			},
			account: {
				select: {
					id: true,
					name: true,
					slug: true
				}
			},
			devicePins: {
				include: {
					device: {
						select: {
							id: true,
							name: true,
							status: true
						}
					}
				}
			},
			userActions: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true
						}
					},
					device: {
						select: {
							id: true,
							name: true
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				},
				take: 10 // Last 10 actions
			},
			_count: {
				select: {
					devicePins: true,
					userActions: true
				}
			}
		}
	});

	if (!rule) {
		throw Object.assign(
			new Error('Pin rule not found'),
			{ status: 404, code: ErrorCodes.NOT_FOUND }
		);
	}

	// Permission check: If ADMIN, restrict visibility to admin_* rules only
	if (
		session.user.systemRole === 'ADMIN' &&
		!(rule.ruleType === 'admin_default' || rule.ruleType === 'admin_custom')
	) {
		throw Object.assign(
			new Error('Admins can only access admin-level rules'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Permission check: If USER, ensure they can access this rule
	if (session.user.systemRole === 'USER') {
		const userAccountId = account?.id;

		// User can access:
		// - user_default rules from their account
		// - user_custom rules they created from their account
		const canAccess =
			(rule.ruleType === 'user_default' && rule.accountId === userAccountId) ||
			(rule.ruleType === 'user_custom' &&
				rule.accountId === userAccountId &&
				rule.createdBy === session.user.id);

		if (!canAccess) {
			throw Object.assign(
				new Error('You do not have permission to access this pin rule'),
				{ status: 403, code: ErrorCodes.FORBIDDEN }
			);
		}
	}

	logger.info(`Retrieved pin rule ${id} for user ${session.user.id}`, {
		ruleId: id,
		userId: session.user.id,
		ruleType: rule.ruleType
	});

	return successResponse(
		{
			rule
		},
		{ requestId: context.requestId }
	);
});

// PUT /api/v2/pin-rules/[id] - Update a pin rule
export const PUT = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma } = context;
	const { id } = params;
	const body = await event.request.json();

	// Get the existing rule to check permissions
	const existingRule = await prisma.pinRule.findUnique({
		where: { id },
		include: {
			account: {
				select: {
					members: {
						where: { userId: session.user.id },
						select: { role: true }
					}
				}
			}
		}
	});

	if (!existingRule) {
		throw Object.assign(
			new Error('Pin rule not found'),
			{ status: 404, code: ErrorCodes.NOT_FOUND }
		);
	}

	// Check permissions
	const memberRole = existingRule.account?.members?.[0]?.role as string | undefined;
	const canEdit =
		session.user.systemRole === 'ADMIN' || // Admin can edit any rule
		(existingRule.ruleType === 'user_custom' && existingRule.createdBy === session.user.id) || // User can edit their own custom rules
		(existingRule.ruleType === 'user_default' &&
			!!memberRole &&
			['OWNER', 'ADMIN'].includes(memberRole)); // Account OWNER/ADMIN can edit account default rules

	if (!canEdit) {
		throw Object.assign(
			new Error('You do not have permission to edit this pin rule'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Validate update data
	const { name, description, apps, targetType, targetValue, isActive, isDraft, fallbackScreenEnabled, fallbackScreenUrl } = body;

	const updateData: any = {};

	// Account System Rules: cannot change name or description; only apps, devices, fallback screen
	if (existingRule.isSystemRule) {
		if (name !== undefined) {
			throw Object.assign(
				new Error('System rule name cannot be changed'),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}
		if (description !== undefined) {
			throw Object.assign(
				new Error('System rule description cannot be changed'),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}
	}

	if (name !== undefined && !existingRule.isSystemRule) {
		if (typeof name === 'string' && name.length > PIN_RULE_NAME_MAX) {
			throw Object.assign(
				new Error(`Name must be at most ${PIN_RULE_NAME_MAX} characters`),
				{ status: 400 }
			);
		}
		// Check for duplicate name (case-insensitive, exclude current rule)
		const nameTrimmed = String(name).trim();
		const duplicateWhere: any = {
			name: { equals: nameTrimmed, mode: 'insensitive' },
			id: { not: id }
		};
		if (existingRule.accountId) {
			duplicateWhere.accountId = existingRule.accountId;
		} else {
			duplicateWhere.accountId = null;
			duplicateWhere.ruleType = { in: ['admin_default', 'admin_custom'] };
		}
		const existingWithName = await prisma.pinRule.findFirst({ where: duplicateWhere });
		if (existingWithName) {
			throw Object.assign(
				new Error('A pin rule with this name already exists'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		updateData.name = name;
	}
	if (description !== undefined && !existingRule.isSystemRule) {
		if (description !== null && typeof description === 'string' && description.length > PIN_RULE_DESCRIPTION_MAX) {
			throw Object.assign(
				new Error(`Description must be at most ${PIN_RULE_DESCRIPTION_MAX} characters`),
				{ status: 400 }
			);
		}
		updateData.description = description;
	}
	if (apps !== undefined) {
		if (!Array.isArray(apps)) {
			throw Object.assign(new Error('apps must be an array'), { status: 400 });
		}
		// System rules can have empty apps; other rules must have at least one
		if (apps.length === 0 && !existingRule.isSystemRule) {
			throw Object.assign(
				new Error('Cannot remove the last app. A pin rule must have at least one app.'),
				{ status: 400 }
			);
		}
		updateData.apps = apps;
	}
	if (targetType !== undefined) updateData.targetType = targetType;
	if (targetValue !== undefined) {
		if (!Array.isArray(targetValue)) {
			throw Object.assign(new Error('targetValue must be an array'), { status: 400 });
		}
		updateData.targetValue = targetValue;
	}

	// Validate: cannot remove last device when targetType is specific (not "all devices")
	// Only check when targetType or targetValue is being updated
	if (targetType !== undefined || targetValue !== undefined) {
		const effectiveTargetType = (targetType !== undefined ? targetType : existingRule.targetType) || 'all';
		const effectiveTargetValue = targetValue !== undefined ? targetValue : (existingRule.targetValue ?? []);
		if (
			(effectiveTargetType === 'specific' || effectiveTargetType === 'devices') &&
			(!Array.isArray(effectiveTargetValue) || effectiveTargetValue.length === 0)
		) {
			throw Object.assign(
				new Error(
					'Cannot remove the last device. Switch to "All Devices" or add at least one device.'
				),
				{ status: 400 }
			);
		}
	}
	if (isActive !== undefined) {
		// System rules must always stay active
		if (existingRule.isSystemRule && isActive === false) {
			throw Object.assign(
				new Error('System rules cannot be deactivated'),
				{ status: 400, code: ErrorCodes.VALIDATION_ERROR }
			);
		}
		updateData.isActive = isActive;
	}
	if (isDraft !== undefined) updateData.isDraft = !!isDraft;
	if (fallbackScreenEnabled !== undefined) updateData.fallbackScreenEnabled = !!fallbackScreenEnabled;
	if (fallbackScreenUrl !== undefined) updateData.fallbackScreenUrl = fallbackScreenUrl == null || fallbackScreenUrl === '' ? null : String(fallbackScreenUrl);

	// When clearing fallback URL, delete the old file from storage
	if (
		(fallbackScreenUrl === null || fallbackScreenUrl === '') &&
		existingRule.fallbackScreenUrl
	) {
		try {
			await deleteFileFromCloudStorage(existingRule.fallbackScreenUrl);
		} catch (e) {
			logger.warn(`Failed to delete old fallback file: ${existingRule.fallbackScreenUrl}`, { error: e });
		}
	}

	// Update the rule
	const updatedRule = await prisma.pinRule.update({
		where: { id },
		data: updateData,
		include: {
			createdByUser: {
				select: {
					id: true,
					name: true,
					email: true
				}
			},
			account: {
				select: {
					id: true,
					name: true,
					slug: true
				}
			}
		}
	});

	logger.info(`Updated pin rule ${id}`, {
		ruleId: id,
		userId: session.user.id,
		changes: Object.keys(updateData)
	});

	// Log audit for pin rule update
	await logAudit({
		actionType: AuditActionType.UPDATE,
		tableName: 'PinRule',
		recordId: id,
		oldData: existingRule,
		newData: updatedRule,
		userId: session.user.id,
		ipAddress: event.getClientAddress?.() || 'unknown',
		prisma
	});

	return successResponse(
		{
			rule: updatedRule,
			message: 'Pin rule updated successfully'
		},
		{ requestId: context.requestId }
	);
});

// DELETE /api/v2/pin-rules/[id] - Delete a pin rule
export const DELETE = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma } = context;
	const { id } = params;

	// Get the existing rule to check permissions
	const existingRule = await prisma.pinRule.findUnique({
		where: { id },
		include: {
			account: {
				select: {
					members: {
						where: { userId: session.user.id },
						select: { role: true }
					}
				}
			}
		}
	});

	if (!existingRule) {
		throw Object.assign(
			new Error('Pin rule not found'),
			{ status: 404, code: ErrorCodes.NOT_FOUND }
		);
	}

	// Check permissions
	const memberRole = existingRule.account?.members?.[0]?.role as string | undefined;
	const canDelete =
		session.user.systemRole === 'ADMIN' || // Admin can delete any rule
		(existingRule.ruleType === 'user_custom' && existingRule.createdBy === session.user.id) || // User can delete their own custom rules
		(existingRule.ruleType === 'user_default' &&
			!!memberRole &&
			['OWNER', 'ADMIN'].includes(memberRole)); // Account OWNER/ADMIN can delete account default rules

	if (!canDelete) {
		throw Object.assign(
			new Error('You do not have permission to delete this pin rule'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Prevent deletion of system rules (per-account system rules cannot be deleted)
	if (existingRule.isSystemRule) {
		throw Object.assign(
			new Error('System rules cannot be deleted'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Prevent deletion of admin default rules by non-admins
	if (existingRule.ruleType === 'admin_default' && session.user.systemRole !== 'ADMIN') {
		throw Object.assign(
			new Error('Only system administrators can delete admin default rules'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Delete fallback screen file(s) from storage (pinrule/{id}/)
	try {
		await deleteFilesFromCloudStorageByPrefix(`pinrule/${id}`);
	} catch (e) {
		logger.warn(`Failed to delete fallback files for pin rule ${id}`, { error: e });
	}

	// Delete the rule (cascade will handle related records)
	await prisma.pinRule.delete({
		where: { id }
	});

	logger.info(`Deleted pin rule ${id}`, {
		ruleId: id,
		userId: session.user.id,
		ruleType: existingRule.ruleType
	});

	// Log audit for pin rule deletion
	await logAudit({
		actionType: AuditActionType.DELETE,
		tableName: 'PinRule',
		recordId: id,
		oldData: existingRule,
		newData: null,
		userId: session.user.id,
		ipAddress: event.getClientAddress?.() || 'unknown',
		prisma
	});

	return successResponse(
		{
			message: 'Pin rule deleted successfully'
		},
		{ requestId: context.requestId }
	);
});
