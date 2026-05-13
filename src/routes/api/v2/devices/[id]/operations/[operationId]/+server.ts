import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * GET /api/v2/devices/[id]/operations/[operationId]
 * Get operation status details
 */
export const GET = unifiedEndpoint(async ({ context, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: deviceId, operationId } = params;

	if (!deviceId || !operationId) {
		throw Object.assign(
			new Error('Device ID and Operation ID are required'),
			{ status: 400 }
		);
	}

	// Verify device exists and user has access
	const device = await prisma.device.findUnique({
		where: { id: deviceId },
		select: {
			id: true,
			user: { select: { id: true } }
		}
	});

	if (!device) {
		throw Object.assign(
			new Error('Device not found'),
			{ status: 404, code: ErrorCodes.NOT_FOUND }
		);
	}

	// Check if user has access to this device
	if (!isAdmin && device.user.id !== session.user.id) {
		throw Object.assign(
			new Error('Access denied to this device'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Get operation details
	const operation = await prisma.deviceActionLog.findFirst({
		where: {
			id: operationId,
			deviceId
		},
		select: {
			id: true,
			actionType: true,
			status: true,
			initiatedAt: true,
			completedAt: true,
			message: true,
			progress: true,
			metadata: true,
			initiatedBy: true,
			requestId: true,
			connectionId: true,
			protocol: true
		}
	});

	if (!operation) {
		throw Object.assign(
			new Error('Operation not found'),
			{ status: 404, code: 'OPERATION_NOT_FOUND' }
		);
	}

	// Calculate duration if completed
	let duration = null;
	if (operation.completedAt && operation.initiatedAt) {
		duration =
			new Date(operation.completedAt).getTime() - new Date(operation.initiatedAt).getTime();
	}

	logger.info(
		`[OperationStatusAPI] Operation status retrieved for device ${deviceId}, operation ${operationId} by user ${session.user.email}`
	);

	return successResponse(
		{
			operation: {
				id: operation.id,
				actionType: operation.actionType,
				status: operation.status,
				initiatedAt: operation.initiatedAt,
				completedAt: operation.completedAt,
				message: operation.message,
				progress: operation.progress,
				metadata: operation.metadata,
				initiatedBy: operation.initiatedBy,
				requestId: operation.requestId,
				connectionId: operation.connectionId,
				protocol: operation.protocol,
				duration: duration ? Math.floor(duration / 1000) : null // Duration in seconds
			},
			deviceId
		},
		{ requestId: context.requestId }
	);
});

