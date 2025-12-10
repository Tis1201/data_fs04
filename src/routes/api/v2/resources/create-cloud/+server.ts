import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { inferTypeAndFormatFromFile } from '$lib/utils/FileUtils';

/**
 * POST /api/v2/resources/create-cloud
 * Create a resource from a cloud storage URL
 * 
 * Body:
 * - name: string (required) - Resource name
 * - path: string (required) - Cloud storage URL (must start with http)
 * - description: string (optional) - Resource description
 * - type: string (optional) - Resource type (will be inferred if missing)
 * - format: string (optional) - Resource format (will be inferred if missing)
 * - version: string (optional) - Version string
 * - versionCode: number (optional) - Version code
 * - signature: string (optional) - Signature hash
 * - releaseType: string (optional) - Release type (default: 'Production')
 * - packageName: string (optional) - Package name (for apps)
 * - size: number (optional) - File size in bytes
 * - accountId: string (optional, admin only) - Target account ID
 * - target: string (optional, user only) - Target type (default: 'user')
 * 
 * Admin: Can create resources for any account or system account
 * User: Creates resources for their current account
 */
export const POST = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma, session, account } = context;
    const body = await event.request.json();
    const {
      name,
      description,
      type,
      target,
      version,
      versionCode,
      signature,
      releaseType,
      format,
      packageName,
      path,
      size,
      accountId: requestedAccountId
    } = body;

    // Validate required fields
    if (!name || !path) {
      throw Object.assign(
        new Error('Name and path are required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Validate that path is a cloud URL
    if (!path.startsWith('http')) {
      throw Object.assign(
        new Error('Path must be a valid cloud storage URL'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Determine target account based on role
    let targetAccountId: string;
    let targetAccountName: string;

    if (session.user.systemRole === 'ADMIN') {
      // Admin can specify accountId or use system account
      let normalizedAccountId = requestedAccountId;
      if (
        normalizedAccountId === 'undefined' ||
        normalizedAccountId === undefined ||
        normalizedAccountId === null ||
        normalizedAccountId === ''
      ) {
        normalizedAccountId = null;
      }

      if (normalizedAccountId) {
        // Use specified account
        logger.debug(`Admin creating cloud resource for account ID: ${normalizedAccountId}`);
        const targetAccount = await prisma.account.findUnique({
          where: { id: normalizedAccountId },
          select: { id: true, name: true }
        });

        if (!targetAccount) {
          throw Object.assign(
            new Error(`The selected account with ID '${normalizedAccountId}' does not exist`),
            { status: 400, code: ErrorCodes.NOT_FOUND }
          );
        }

        targetAccountId = targetAccount.id;
        targetAccountName = targetAccount.name;
      } else {
        // Use system account
        logger.debug(`Admin creating cloud resource for system account`);
        const systemAccount = await prisma.account.findFirst({
          where: { isSystem: true },
          select: { id: true, name: true }
        });

        if (!systemAccount) {
          logger.error('System account not found in database');
          throw Object.assign(
            new Error(
              'The system account does not exist. Please run the database seed to create it.'
            ),
            { status: 500, code: ErrorCodes.INTERNAL_ERROR }
          );
        }

        targetAccountId = systemAccount.id;
        targetAccountName = systemAccount.name;
      }
    } else {
      // User uses their current account
      if (!account?.id) {
        throw Object.assign(
          new Error('No current account selected. Please select an account first.'),
          { status: 400, code: ErrorCodes.INVALID_INPUT }
        );
      }

      targetAccountId = account.id;
      targetAccountName = account.name;
    }

    logger.debug(`Using account: ${targetAccountName} (ID: ${targetAccountId})`);

    // Infer type/format from path if missing
    let finalType = type;
    let finalFormat = format;

    if (!finalType || !finalFormat) {
      // Extract filename from path, removing query parameters
      const url = new URL(path);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];

      const mockFile = {
        name: fileName,
        type: 'application/octet-stream'
      } as File;

      const { type: inferredType, format: inferredFormat } =
        inferTypeAndFormatFromFile(mockFile);
      finalType = finalType || inferredType;
      finalFormat = finalFormat || inferredFormat;
    }

    // Create the resource
    const resource = await prisma.resource.create({
      data: {
        name,
        description: description || '',
        type: finalType,
        target: target || (session.user.systemRole === 'ADMIN' ? undefined : 'user'),
        version: version || '',
        versionCode: versionCode ?? null,
        signature: signature ?? null,
        releaseType: releaseType || 'Production',
        format: finalFormat,
        packageName: packageName || '',
        path,
        size: size || 0,
        accountId: targetAccountId,
        createdBy: session.user.id,
        updatedBy: session.user.id
      }
    });

    logger.info(
      `Cloud resource created by ${session.user.systemRole}: ${resource.id}`,
      { accountId: targetAccountId, resourceId: resource.id }
    );

    // Log audit
    await logAudit({
      actionType: AuditActionType.INSERT,
      tableName: 'Resource',
      recordId: resource.id,
      oldData: null,
      newData: resource,
      userId: session.user.id,
      ipAddress: event.getClientAddress?.() || 'unknown',
      prisma
    });

    return successResponse(
      {
        resourceId: resource.id,
        accountId: targetAccountId,
        accountName: targetAccountName
      },
      {
        message: `Resource '${resource.name}' has been created in ${targetAccountName}`,
        status: 201
      }
    );
  },
  { permission: 'resource.create' }
);
