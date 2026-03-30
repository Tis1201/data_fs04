import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import type { Prisma } from '@prisma/client';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { inferTypeAndFormatFromFile } from '$lib/utils/FileUtils';
import {
  getStorageConfig,
  ensureResourceInResourcesFolder,
  parseCloudStorageUrl,
  isCloudStorageUrl
} from '$lib/server/storage';

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
      accountId: requestedAccountId,
      shareScope: rawShareScope,
      accountIds: rawAccountIds
    } = body;

    // Validate required fields
    if (!name || !path) {
      throw Object.assign(
        new Error('Name and path are required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Path can be: (a) full cloud URL (http...), or (b) object path (temp/resources/... or resources/...)
    const isObjectPath = typeof path === 'string' && !path.startsWith('http') && (path.startsWith('temp/') || path.startsWith('resources/'));

    // Validate path format
    if (!path.startsWith('http') && !isObjectPath) {
      throw Object.assign(
        new Error('Path must be a valid cloud storage URL or object path (e.g. temp/resources/... or resources/...)'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Ensure object lives under resources/ (move from temp/resources to resources/ when needed)
    let finalPath = path;
    const config = getStorageConfig();
    if (config.mode === 'R2') {
      if (!config.r2Bucket) {
        throw Object.assign(
          new Error('R2 mode requires CLOUDFLARE_R2_BUCKET_NAME to be set'),
          { status: 500, code: ErrorCodes.INTERNAL_ERROR }
        );
      }
      if (!config.r2CdnUrl) {
        throw Object.assign(
          new Error('R2 mode requires CLOUDFLARE_R2_CDN_URL to be set'),
          { status: 500, code: ErrorCodes.INTERNAL_ERROR }
        );
      }

      let objectPath: string;
      const bucket = config.r2Bucket;

      if (isCloudStorageUrl(path)) {
        const parsed = parseCloudStorageUrl(path);
        if (!parsed) {
          throw Object.assign(
            new Error(`Failed to parse cloud storage URL: ${path}`),
            { status: 400, code: ErrorCodes.INVALID_INPUT }
          );
        }
        objectPath = parsed.objectPath;
      } else {
        // Raw object path (e.g. temp/resources/uuid.deb)
        objectPath = path.replace(/^\/+|\/+$/g, '');
      }

      const newObjectPath = await ensureResourceInResourcesFolder(bucket, objectPath);
      finalPath = `${config.r2CdnUrl.replace(/\/$/, '')}/${newObjectPath}`;
      logger.info(`[create-cloud] Resource path ensured in resources folder: ${finalPath}`);
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

    const VALID_SCOPES = new Set([
      'NONE',
      'ALL_ACCOUNTS',
      'SELECTED_ACCOUNTS',
      'PUBLIC_DEVELOPER'
    ]);
    let shareScope =
      typeof rawShareScope === 'string' && VALID_SCOPES.has(rawShareScope) ? rawShareScope : 'NONE';
    let accountIds =
      Array.isArray(rawAccountIds)
        ? [...new Set(rawAccountIds.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0))]
        : [];

    if (session.user.systemRole !== 'ADMIN') {
      shareScope = 'NONE';
      accountIds = [];
    }

    if (shareScope === 'SELECTED_ACCOUNTS' && accountIds.length === 0) {
      throw Object.assign(
        new Error('Select at least one account, or choose Private or All accounts'),
        { status: 400, code: ErrorCodes.VALIDATION_ERROR }
      );
    }
    if (shareScope === 'PUBLIC_DEVELOPER' && accountIds.length > 0) {
      throw Object.assign(
        new Error('Developer catalog scope does not use account picks'),
        { status: 400, code: ErrorCodes.VALIDATION_ERROR }
      );
    }

    // Infer type/format from path if missing
    let finalType = type;
    let finalFormat = format;

    if (!finalType || !finalFormat) {
      // Extract filename from path (handles both URLs and object paths)
      let fileName: string;
      try {
        const url = new URL(finalPath);
        const pathParts = url.pathname.split('/');
        fileName = pathParts[pathParts.length - 1] || finalPath;
      } catch {
        fileName = finalPath.split('/').pop() || finalPath;
      }

      const mockFile = {
        name: fileName,
        type: 'application/octet-stream'
      } as File;

      const { type: inferredType, format: inferredFormat } =
        inferTypeAndFormatFromFile(mockFile);
      finalType = finalType || inferredType;
      finalFormat = finalFormat || inferredFormat;
    }

    if (shareScope === 'SELECTED_ACCOUNTS') {
      const found = await prisma.account.findMany({
        where: {
          id: { in: accountIds },
          OR: [{ isSystem: false }, { id: targetAccountId }]
        },
        select: { id: true }
      });
      if (found.length !== accountIds.length) {
        throw Object.assign(
          new Error('One or more account IDs are invalid'),
          { status: 400, code: ErrorCodes.VALIDATION_ERROR }
        );
      }
    }

    // Create the resource (+ optional shares for SELECTED_ACCOUNTS)
    const resource = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.resource.create({
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
          path: finalPath,
          size: size || 0,
          shareScope,
          accountId: targetAccountId,
          createdBy: session.user.id,
          updatedBy: session.user.id
        }
      });
      if (shareScope === 'SELECTED_ACCOUNTS' && accountIds.length > 0) {
        await tx.resourceAccountShare.createMany({
          data: accountIds.map((accountId: string) => ({
            resourceId: r.id,
            accountId
          })),
          skipDuplicates: true
        });
      }
      return r;
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
