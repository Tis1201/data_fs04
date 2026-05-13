/**
 * Creates a per-account system pin rule when an account is created.
 * System rules: always active, cannot be deleted, editable only by ADMIN or account OWNER.
 */
import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';

const SYSTEM_RULE_NAME = 'Account System Rule';
const SYSTEM_RULE_DESCRIPTION = 'Default pinned apps for this account. Cannot be deleted.';

export async function createAccountSystemRule(
	prisma: PrismaClient,
	accountId: string,
	createdBy: string
): Promise<void> {
	try {
		// Check if account already has a system rule
		const existing = await prisma.pinRule.findFirst({
			where: { accountId, isSystemRule: true }
		});
		if (existing) {
			logger.debug('[createAccountSystemRule] Account already has system rule', { accountId });
			return;
		}

		await prisma.pinRule.create({
			data: {
				ruleType: 'user_default',
				accountId,
				createdBy,
				name: SYSTEM_RULE_NAME,
				description: SYSTEM_RULE_DESCRIPTION,
				apps: [],
				targetType: 'all',
				targetValue: [],
				priority: 1,
				isActive: true,
				isSystemRule: true,
				isDraft: false
			}
		});
		logger.info('[createAccountSystemRule] Created system rule for account', { accountId });
	} catch (e) {
		logger.error('[createAccountSystemRule] Failed to create system rule', { accountId, error: e });
		// Don't throw - account creation should not fail if rule creation fails
		// Admin can run backfill script later
	}
}
