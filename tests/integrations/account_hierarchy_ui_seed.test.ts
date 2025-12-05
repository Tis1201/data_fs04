import { describe, it, expect, beforeAll } from 'vitest';
import { getEnhancedPrisma } from '$lib/server/prisma';

// Integration test that seeds a richer account hierarchy for the admin UI.
//
// This is intentionally more of a "fixture seeder" than a strict unit test:
// - It creates a small, realistic hierarchy of accounts.
// - It leaves the data in place so you can inspect it via the UI.
// - It is idempotent for repeated runs by cleaning any previous seed data
//   with the same slug prefix before re-creating it.
//
// IMPORTANT: We do NOT set `createdById` here to avoid depending on
// specific User fixtures. The production code still sets it; this file is
// purely about having stable data for hierarchy visualization.

describe('UI hierarchy seed data (accounts + relationships)', () => {
    const prisma = getEnhancedPrisma({ id: 'hierarchy-ui-seed-user', systemRole: 'ADMIN' });

    // All seed data will use this slug prefix so we can clean/recreate safely.
    const SLUG_PREFIX = 'hierarchy-ui-';

    // Named IDs for clarity when reading the DB and UI.
    const ROOT = 'hierarchy-ui-root';
    const REGION_EAST = 'hierarchy-ui-region-east';
    const REGION_WEST = 'hierarchy-ui-region-west';
    const SUB_EAST_A = 'hierarchy-ui-sub-east-a';
    const SUB_WEST_A = 'hierarchy-ui-sub-west-a';
    const TEAM_ALPHA = 'hierarchy-ui-team-alpha';
    const TEAM_BRAVO = 'hierarchy-ui-team-bravo';

    beforeAll(async () => {
        // Clean any previous seed data created by this file.
        // 1) Find all accounts with our slug prefix
        const existingAccounts = await prisma.account.findMany({
            where: { slug: { startsWith: SLUG_PREFIX } },
            select: { id: true }
        });

        const seedAccountIds = existingAccounts.map((a) => a.id);

        if (seedAccountIds.length > 0) {
            // Delete assignments where these accounts are parent or child
            await prisma.accountAssignment.deleteMany({
                where: {
                    OR: [
                        { parentAccountId: { in: seedAccountIds } },
                        { childAccountId: { in: seedAccountIds } }
                    ]
                }
            });

            // Delete the accounts themselves
            await prisma.account.deleteMany({
                where: { id: { in: seedAccountIds } }
            });
        }

        // Create seed accounts
        await prisma.account.createMany({
            data: [
                {
                    id: ROOT,
                    name: 'UI Root Org',
                    slug: `${SLUG_PREFIX}root-org`,
                    isSystem: false
                },
                {
                    id: REGION_EAST,
                    name: 'UI Region East',
                    slug: `${SLUG_PREFIX}region-east`,
                    isSystem: false
                },
                {
                    id: REGION_WEST,
                    name: 'UI Region West',
                    slug: `${SLUG_PREFIX}region-west`,
                    isSystem: false
                },
                {
                    id: SUB_EAST_A,
                    name: 'UI Subsidiary East A',
                    slug: `${SLUG_PREFIX}sub-east-a`,
                    isSystem: false
                },
                {
                    id: SUB_WEST_A,
                    name: 'UI Subsidiary West A',
                    slug: `${SLUG_PREFIX}sub-west-a`,
                    isSystem: false
                },
                {
                    id: TEAM_ALPHA,
                    name: 'UI Team Alpha',
                    slug: `${SLUG_PREFIX}team-alpha`,
                    isSystem: false
                },
                {
                    id: TEAM_BRAVO,
                    name: 'UI Team Bravo',
                    slug: `${SLUG_PREFIX}team-bravo`,
                    isSystem: false
                }
            ]
        });

        // Create relationships (AccountAssignment)
        //
        // UI Root Org
        //   ├─ Region East (OWNERSHIP, ACTIVE)
        //   │    └─ Subsidiary East A (DELEGATION, ACTIVE)
        //   │         └─ Team Alpha (VISIBILITY_ONLY, ACTIVE)
        //   └─ Region West (OWNERSHIP, ACTIVE)
        //        └─ Subsidiary West A (DELEGATION, SUSPENDED)
        //             └─ Team Bravo (VISIBILITY_ONLY, ACTIVE, time-limited)

        await prisma.accountAssignment.createMany({
            data: [
                // Level 1: Root -> Regions
                {
                    parentAccountId: ROOT,
                    childAccountId: REGION_EAST,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: ROOT,
                    childAccountId: REGION_WEST,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                // Level 2: Regions -> Subsidiaries
                {
                    parentAccountId: REGION_EAST,
                    childAccountId: SUB_EAST_A,
                    relationshipType: 'DELEGATION',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: REGION_WEST,
                    childAccountId: SUB_WEST_A,
                    relationshipType: 'DELEGATION',
                    status: 'SUSPENDED'
                },
                // Level 3: Subsidiaries -> Teams
                {
                    parentAccountId: SUB_EAST_A,
                    childAccountId: TEAM_ALPHA,
                    relationshipType: 'VISIBILITY_ONLY',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: SUB_WEST_A,
                    childAccountId: TEAM_BRAVO,
                    relationshipType: 'VISIBILITY_ONLY',
                    status: 'ACTIVE',
                    validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // started yesterday
                    validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // ends in a week
                }
            ]
        });
    });

    it('seeds hierarchy data for the admin UI', async () => {
        const accounts = await prisma.account.findMany({
            where: { slug: { startsWith: SLUG_PREFIX } },
            orderBy: { slug: 'asc' }
        });

        const assignments = await prisma.accountAssignment.findMany({
            where: {
                OR: [
                    { parentAccount: { slug: { startsWith: SLUG_PREFIX } } },
                    { childAccount: { slug: { startsWith: SLUG_PREFIX } } }
                ]
            },
            include: {
                parentAccount: { select: { slug: true } },
                childAccount: { select: { slug: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Basic sanity checks so the test actually asserts something.
        expect(accounts.length).toBeGreaterThanOrEqual(7);
        expect(assignments.length).toBeGreaterThanOrEqual(6);

        // Root should have at least two children (east/west regions).
        const rootChildren = assignments.filter((a) => a.parentAccountId === ROOT);
        expect(rootChildren.length).toBeGreaterThanOrEqual(2);

        // There should be at least one suspended link and at least one time-limited link.
        const suspended = assignments.filter((a) => a.status === 'SUSPENDED');
        const timeLimited = assignments.filter((a) => a.validFrom && a.validTo);
        expect(suspended.length).toBeGreaterThanOrEqual(1);
        expect(timeLimited.length).toBeGreaterThanOrEqual(1);
    });
});
