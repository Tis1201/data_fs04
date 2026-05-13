import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { PinRuleEngine } from '$lib/server/pin-management/ruleEngine';

/**
 * POST /api/v2/devices/[id]/apply-rules
 * Apply all applicable pin rules to a device
 */
export const POST = unifiedEndpoint(async ({ context, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: deviceId } = params;

	// Get device information
	const device = await prisma.device.findUnique({
		where: { id: deviceId },
		include: {
			account: {
				select: {
					members: {
						where: { userId: session.user.id },
						select: { role: true }
					}
				}
			},
			tags: {
				select: {
					name: true
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

	// Check if user has permission to apply rules to this device
	const hasPermission =
		isAdmin ||
		device.account?.members?.[0]?.role === 'ADMIN' ||
		device.account?.members?.[0]?.role === 'MEMBER';

	if (!hasPermission) {
		throw Object.assign(
			new Error('You do not have permission to apply rules to this device'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Use the rule engine to apply rules
	const ruleEngine = new PinRuleEngine(prisma);
	const result = await ruleEngine.applyRulesToDevice(deviceId, session.user.id);

	logger.info('Applied pin rules to device', {
		deviceId,
		rulesApplied: result.rulesApplied,
		userId: session.user.id
	});

	return successResponse(
		{
			deviceId,
			rulesApplied: result.rulesApplied,
			pinsApplied: result.pinsApplied,
			pinsRemoved: result.pinsRemoved,
			appliedPins: result.appliedPins,
			removedPins: result.removedPins,
			matchingRules: result.matchingRules,
			message: `Applied ${result.rulesApplied} rules successfully`
		},
		{ requestId: context.requestId }
	);
});

