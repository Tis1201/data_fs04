import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// GET /api/v2/pin-rules - Get all pin rules (filtered by user permissions)
export const GET = unifiedEndpoint(async ({ context, event }) => {
	const { url } = event;
	const { session, account, prisma } = context;

	// Get query parameters
	const search = url.searchParams.get('search') || '';
	const ruleType = url.searchParams.get('ruleType') || '';
	const accountId = url.searchParams.get('accountId') || '';
	const isActive = url.searchParams.get('isActive');

	logger.info(`[PinRulesAPI][GET] incoming params`, {
		search,
		ruleType,
		accountId,
		isActive,
		userId: session.user.id,
		systemRole: session.user.systemRole
	});

	// Build where clause based on user permissions
	let whereClause: any = {};

	// Filter by rule type if specified
	if (ruleType) {
		whereClause.ruleType = ruleType;
	}

	// Filter by account if specified
	if (accountId) {
		whereClause.accountId = accountId;
	}

	// Filter by active status if specified
	if (isActive !== null && isActive !== undefined) {
		whereClause.isActive = isActive === 'true';
	}

	// Add search filter if provided
	if (search) {
		const searchConditions = [
			{ name: { contains: search, mode: 'insensitive' as const } },
			{ description: { contains: search, mode: 'insensitive' as const } },
			{ apps: { has: search } }
		];

		// If we already have other conditions, combine them with AND
		if (Object.keys(whereClause).length > 0) {
			whereClause = {
				AND: [whereClause, { OR: searchConditions }]
			};
		} else {
			whereClause.OR = searchConditions;
		}
	}

	// Permission-based scoping
	if (session.user.systemRole === 'ADMIN') {
		// Admins: return only admin-level rules
		logger.info('[PinRulesAPI][GET] applying ADMIN scoping (admin_default/admin_custom only)');
		const adminRuleTypes = {
			OR: [{ ruleType: 'admin_default' }, { ruleType: 'admin_custom' }]
		};

		// Combine with existing whereClause
		if (Object.keys(whereClause).length > 0) {
			whereClause = {
				AND: [whereClause, adminRuleTypes]
			};
		} else {
			whereClause = adminRuleTypes;
		}
	} else {
		// Non-admins: scope to account
		logger.info('[PinRulesAPI][GET] applying NON-ADMIN scoping');

		// Get user's account from current account context
		const userAccountId = account?.id;

		// If we cannot determine an account, return empty result to avoid leaking data
		if (!userAccountId) {
			logger.info(
				`[PinRulesAPI][GET] No account determined for non-admin; returning empty list`,
				{ userId: session.user.id }
			);
			return successResponse(
				{
					rules: [],
					total: 0
				},
				{ requestId: context.requestId }
			);
		}

		// Debug: Check availability per branch before combined query
		try {
			const [cntUserDefault, cntUserCustom] = await Promise.all([
				prisma.pinRule.count({
					where: { ruleType: 'user_default', accountId: userAccountId }
				}),
				prisma.pinRule.count({
					where: {
						ruleType: 'user_custom',
						accountId: userAccountId,
						createdBy: session.user.id
					}
				})
			]);
			logger.info(`[PinRulesAPI][GET] pre-query counts`, {
				userAccountId,
				cntUserDefault,
				cntUserCustom
			});
		} catch (e) {
			logger.error('[PinRulesAPI][GET] pre-query count failed', {
				error: e instanceof Error ? e.message : String(e)
			});
		}

		whereClause = {
			...whereClause,
			OR: [
				{
					ruleType: 'user_default',
					accountId: userAccountId
				},
				{
					ruleType: 'user_custom',
					accountId: userAccountId,
					createdBy: session.user.id
				}
			]
		};
	}

	logger.info(`[PinRulesAPI][GET] final whereClause`, whereClause);

	// Get rules based on user permissions
	const rules = await prisma.pinRule.findMany({
		where: whereClause,
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
			_count: {
				select: {
					userActions: true
				}
			}
		},
		orderBy: [{ ruleType: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }]
	});

	logger.info(`[PinRulesAPI][GET] query result`, {
		count: rules.length,
		sample: rules
			.slice(0, 10)
			.map((r: any) => ({
				id: r.id,
				ruleType: r.ruleType,
				accountId: r.accountId,
				createdBy: r.createdBy
			}))
	});

	return successResponse(
		{
			rules,
			total: rules.length
		},
		{ requestId: context.requestId }
	);
});

// POST /api/v2/pin-rules - Create a new pin rule
export const POST = unifiedEndpoint(async ({ context, event }) => {
	const { session, account, prisma } = context;
	const body = await event.request.json();

	// Validate required fields
	const { ruleType, name, apps, targetType, targetValue, description } = body;

	if (!ruleType || !name || !apps || !Array.isArray(apps)) {
		throw Object.assign(new Error('ruleType, name, and apps are required'), { status: 400 });
	}

	// Validate rule type
	const validRuleTypes = ['admin_default', 'user_default', 'admin_custom', 'user_custom'];
	if (!validRuleTypes.includes(ruleType)) {
		throw Object.assign(
			new Error(
				'ruleType must be one of: admin_default, user_default, admin_custom, user_custom'
			),
			{ status: 400 }
		);
	}

	// Set default priority if not provided: 1 for *_default, 2 for *_custom (higher overrides)
	const priority =
		typeof body.priority === 'number' ? body.priority : ruleType.endsWith('_default') ? 1 : 2;

	// Get user's account ID for user-scoped rules
	let ruleAccountId = null;
	if (ruleType === 'user_custom' || ruleType === 'user_default') {
		ruleAccountId = account?.id;

		if (!ruleAccountId) {
			throw Object.assign(
				new Error('Cannot create user rules without account membership'),
				{ status: 400 }
			);
		}
	}

	// Create the pin rule
	const newRule = await prisma.pinRule.create({
		data: {
			ruleType,
			createdBy: session.user.id,
			accountId: ruleAccountId,
			name,
			description,
			apps,
			targetType: targetType || 'all',
			targetValue: targetValue || [],
			priority,
			isActive: true
		},
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

	logger.info(`Created pin rule ${newRule.id}`, {
		ruleId: newRule.id,
		ruleType: newRule.ruleType,
		userId: session.user.id,
		accountId: newRule.accountId
	});

	// Log audit for pin rule creation
	await logAudit({
		actionType: AuditActionType.INSERT,
		tableName: 'PinRule',
		recordId: newRule.id,
		oldData: null,
		newData: newRule,
		userId: session.user.id,
		ipAddress: event.getClientAddress?.() || 'unknown',
		prisma
	});

	return successResponse(
		{
			rule: newRule,
			message: 'Pin rule created successfully'
		},
		{ requestId: context.requestId }
	);
});
