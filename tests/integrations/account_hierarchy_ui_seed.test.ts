import { describe, it, expect, beforeAll } from 'vitest';
import { getEnhancedPrisma } from '$lib/server/prisma';

// Integration test that seeds a richer, 6-level-deep account hierarchy
// for the admin UI.
//
// This is intentionally more of a "fixture seeder" than a strict unit test:
// - It creates a realistic hierarchy with meaningful names (Global → Division → Region → Country → City → Site).
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
    // Path example (6 levels):
    // 1. UI Global Org
    // 2. UI Division Enterprise
    // 3. UI Region APAC
    // 4. UI Country Singapore
    // 5. UI City Singapore Downtown
    // 6. UI Site Alpha
    const GLOBAL_ORG = 'hierarchy-ui-global-org';
    const DIVISION_ENTERPRISE = 'hierarchy-ui-division-enterprise';
    const DIVISION_SMB = 'hierarchy-ui-division-smb';
    const REGION_APAC = 'hierarchy-ui-region-apac';
    const REGION_NA = 'hierarchy-ui-region-na';
    const COUNTRY_SG = 'hierarchy-ui-country-sg';
    const COUNTRY_US = 'hierarchy-ui-country-us';
    const CITY_SG_DOWNTOWN = 'hierarchy-ui-city-sg-downtown';
    const CITY_SF_DOWNTOWN = 'hierarchy-ui-city-sf-downtown';
    const SITE_ALPHA = 'hierarchy-ui-site-alpha';
    const SITE_BRAVO = 'hierarchy-ui-site-bravo';

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

        // Create seed accounts for a 6-level hierarchy
        await prisma.account.createMany({
            data: [
                {
                    id: GLOBAL_ORG,
                    name: 'UI Global Org',
                    slug: `${SLUG_PREFIX}global-org`,
                    isSystem: false
                },
                {
                    id: DIVISION_ENTERPRISE,
                    name: 'UI Division Enterprise',
                    slug: `${SLUG_PREFIX}division-enterprise`,
                    isSystem: false
                },
                {
                    id: DIVISION_SMB,
                    name: 'UI Division SMB',
                    slug: `${SLUG_PREFIX}division-smb`,
                    isSystem: false
                },
                {
                    id: REGION_APAC,
                    name: 'UI Region APAC',
                    slug: `${SLUG_PREFIX}region-apac`,
                    isSystem: false
                },
                {
                    id: REGION_NA,
                    name: 'UI Region North America',
                    slug: `${SLUG_PREFIX}region-na`,
                    isSystem: false
                },
                {
                    id: COUNTRY_SG,
                    name: 'UI Country Singapore',
                    slug: `${SLUG_PREFIX}country-sg`,
                    isSystem: false
                },
                {
                    id: COUNTRY_US,
                    name: 'UI Country United States',
                    slug: `${SLUG_PREFIX}country-us`,
                    isSystem: false
                },
                {
                    id: CITY_SG_DOWNTOWN,
                    name: 'UI City Singapore Downtown',
                    slug: `${SLUG_PREFIX}city-sg-downtown`,
                    isSystem: false
                },
                {
                    id: CITY_SF_DOWNTOWN,
                    name: 'UI City San Francisco Downtown',
                    slug: `${SLUG_PREFIX}city-sf-downtown`,
                    isSystem: false
                },
                {
                    id: SITE_ALPHA,
                    name: 'UI Site Alpha',
                    slug: `${SLUG_PREFIX}site-alpha`,
                    isSystem: false
                },
                {
                    id: SITE_BRAVO,
                    name: 'UI Site Bravo',
                    slug: `${SLUG_PREFIX}site-bravo`,
                    isSystem: false
                }
            ]
        });

        // Create relationships (AccountAssignment)
        //
        // UI Global Org
        //   ├─ UI Division Enterprise
        //   │    └─ UI Region APAC
        //   │         └─ UI Country Singapore
        //   │              └─ UI City Singapore Downtown
        //   │                   └─ UI Site Alpha
        //   └─ UI Division SMB
        //        └─ UI Region North America
        //             └─ UI Country United States
        //                  └─ UI City San Francisco Downtown
        //                       └─ UI Site Bravo

        await prisma.accountAssignment.createMany({
            data: [
                // Level 1: Global -> Divisions
                {
                    parentAccountId: GLOBAL_ORG,
                    childAccountId: DIVISION_ENTERPRISE,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: GLOBAL_ORG,
                    childAccountId: DIVISION_SMB,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                // Level 2: Divisions -> Regions
                {
                    parentAccountId: DIVISION_ENTERPRISE,
                    childAccountId: REGION_APAC,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: DIVISION_SMB,
                    childAccountId: REGION_NA,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                // Level 3: Regions -> Countries
                {
                    parentAccountId: REGION_APAC,
                    childAccountId: COUNTRY_SG,
                    relationshipType: 'DELEGATION',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: REGION_NA,
                    childAccountId: COUNTRY_US,
                    relationshipType: 'DELEGATION',
                    status: 'SUSPENDED'
                },
                // Level 4: Countries -> Cities
                {
                    parentAccountId: COUNTRY_SG,
                    childAccountId: CITY_SG_DOWNTOWN,
                    relationshipType: 'DELEGATION',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: COUNTRY_US,
                    childAccountId: CITY_SF_DOWNTOWN,
                    relationshipType: 'DELEGATION',
                    status: 'ACTIVE'
                },
                // Level 5: Cities -> Sites
                {
                    parentAccountId: CITY_SG_DOWNTOWN,
                    childAccountId: SITE_ALPHA,
                    relationshipType: 'VISIBILITY_ONLY',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: CITY_SF_DOWNTOWN,
                    childAccountId: SITE_BRAVO,
                    relationshipType: 'VISIBILITY_ONLY',
                    status: 'ACTIVE',
                    validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // started yesterday
                    validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // ends in a week
                }
            ]
        });
    });

    it('seeds a 6-level hierarchy for the admin UI', async () => {
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

        // Expect exactly the number of accounts and assignments we created.
        expect(accounts.length).toBe(11);
        expect(assignments.length).toBe(10);

        // Global org should have two divisions.
        const globalChildren = assignments.filter((a) => a.parentAccountId === GLOBAL_ORG);
        expect(globalChildren.length).toBe(2);

        // Verify the 6-level path Global -> Enterprise -> APAC -> Singapore -> SG Downtown -> Site Alpha
        const hasGlobalToDivision = assignments.some(
            (a) => a.parentAccountId === GLOBAL_ORG && a.childAccountId === DIVISION_ENTERPRISE
        );
        const hasDivisionToRegion = assignments.some(
            (a) => a.parentAccountId === DIVISION_ENTERPRISE && a.childAccountId === REGION_APAC
        );
        const hasRegionToCountry = assignments.some(
            (a) => a.parentAccountId === REGION_APAC && a.childAccountId === COUNTRY_SG
        );
        const hasCountryToCity = assignments.some(
            (a) => a.parentAccountId === COUNTRY_SG && a.childAccountId === CITY_SG_DOWNTOWN
        );
        const hasCityToSite = assignments.some(
            (a) => a.parentAccountId === CITY_SG_DOWNTOWN && a.childAccountId === SITE_ALPHA
        );

        expect(hasGlobalToDivision).toBe(true);
        expect(hasDivisionToRegion).toBe(true);
        expect(hasRegionToCountry).toBe(true);
        expect(hasCountryToCity).toBe(true);
        expect(hasCityToSite).toBe(true);

        // There should be at least one suspended link and at least one time-limited link.
        const suspended = assignments.filter((a) => a.status === 'SUSPENDED');
        const timeLimited = assignments.filter((a) => a.validFrom && a.validTo);
        expect(suspended.length).toBeGreaterThanOrEqual(1);
        expect(timeLimited.length).toBeGreaterThanOrEqual(1);
    });
});
