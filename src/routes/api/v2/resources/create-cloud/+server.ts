/**
 * Unified Cloud Resource Creation API (v2)
 * 
 * This endpoint creates a resource from an existing cloud storage URL.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { inferTypeAndFormatFromFile } from '$lib/utils/FileUtils';

/**
 * POST /api/v2/resources/create-cloud
 * Create a resource from a cloud storage URL
 * 
 * Request body:
 * {
 *   "name": "My App",
 *   "description": "App description",
 *   "type": "APP",
 *   "version": "1.0.0",
 *   "versionCode": 1,
 *   "signature": "optional_signature",
 *   "releaseType": "Production",
 *   "format": "apk",
 *   "packageName": "com.example.app",
 *   "path": "https://storage.googleapis.com/...",
 *   "size": 1024000,
 *   "accountId": "optional_account_id"
 * }
 */
export const POST = unifiedEndpoint(
	async ({ context, event }) => {
		const body = await event.request.json();
		const { 
			name, 
			description, 
			type, 
			version, 
			versionCode,
			signature,
			releaseType,
			format, 
			packageName, 
			path, 
			size, 
			accountId 
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
		
		// Determine target account
		let targetAccountId: string;
		let accountName = 'Unknown Account';
		const isAdmin = context.session.user.systemRole === 'ADMIN';
		const currentAccountId = context.account?.id;
		
		if (accountId && accountId !== 'undefined' && accountId !== undefined) {
			// Specific account requested
			if (!isAdmin && accountId !== currentAccountId) {
				throw Object.assign(
					new Error('Cannot create resource in a different account'),
					{ status: 403, code: ErrorCodes.FORBIDDEN }
				);
			}
			
			const account = await prisma.account.findUnique({
				where: { id: accountId }
			});
			
			if (!account) {
				throw Object.assign(
					new Error('Invalid account'),
					{ status: 400, code: ErrorCodes.INVALID_INPUT, details: `Account with ID '${accountId}' does not exist` }
				);
			}
			
			targetAccountId = account.id;
			accountName = account.name;
		} else {
			// Use current account for non-admin, system account for admin
			if (isAdmin) {
				const systemAccount = await prisma.account.findFirst({
					where: { isSystem: true }
				});
				
				if (!systemAccount) {
					throw Object.assign(
						new Error('System account not found'),
						{ status: 500, code: ErrorCodes.INTERNAL_ERROR, details: 'Please run database seed' }
					);
				}
				
				targetAccountId = systemAccount.id;
				accountName = systemAccount.name;
			} else {
				if (!currentAccountId) {
					throw Object.assign(
						new Error('Account ID is required'),
						{ status: 400, code: ErrorCodes.INVALID_INPUT }
					);
				}
				targetAccountId = currentAccountId;
			}
		}
		
		// Infer type/format from path if missing
		let finalType = type;
		let finalFormat = format;
		
		if (!finalType || !finalFormat) {
			const url = new URL(path);
			const pathParts = url.pathname.split('/');
			const fileName = pathParts[pathParts.length - 1];
			
			const mockFile = {
				name: fileName,
				type: 'application/octet-stream'
			} as File;
			const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFile(mockFile);
			finalType = finalType || inferredType;
			finalFormat = finalFormat || inferredFormat;
		}
		
		// Create the resource
		const resource = await prisma.resource.create({
			data: {
				name,
				description: description || '',
				type: finalType,
				version: version || '',
				versionCode: versionCode ?? null,
				signature: signature ?? null,
				releaseType: releaseType || 'Production',
				format: finalFormat,
				packageName: packageName || '',
				path,
				size: size || 0,
				accountId: targetAccountId,
				createdBy: context.session.user.id,
				updatedBy: context.session.user.id
			}
		});
		
		logger.info(`[Resources v2] Cloud resource created: ${resource.id}`, {
			requestId: context.requestId,
			userId: context.session.user.id,
			resourceId: resource.id,
			accountId: targetAccountId
		});
		
		return successResponse(
			{
				resourceId: resource.id,
				accountId: targetAccountId,
				accountName,
				message: `Resource '${resource.name}' has been created in ${accountName}`
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'resource.create' }
);

