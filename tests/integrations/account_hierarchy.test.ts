import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getEnhancedPrisma } from '$lib/server/prisma';

// Minimal integration tests for AccountAssignment / account hierarchy.
// These avoid setting createdById so we don't depend on specific User fixtures.
// The goal is to validate that the relationship model behaves correctly under
// the same enhanced Prisma client used elsewhere in integrations.

describe('AccountAssignment integration (hierarchy relationships)', () => {
    const prisma = getEnhancedPrisma({ id: 'hierarchy-int-test-user', systemRole: 'ADMIN' });

    const ROOT_ID = 'hierarchy-int-root-account';
    const CHILD_A_ID = 'hierarchy-int-child-a';
    const CHILD_B_ID = 'hierarchy-int-child-b';

    beforeAll(async () => {
        // Ensure base accounts exist for all tests in this suite.
        await prisma.account.upsert({
            where: { id: ROOT_ID },
            update: {},
            create: {
                id: ROOT_ID,
                name: 'Hierarchy Int Root',
                slug: 'hierarchy-int-root',
                isSystem: false
            }
        });

        await prisma.account.upsert({
            where: { id: CHILD_A_ID },
            update: {},
            create: {
                id: CHILD_A_ID,
                name: 'Hierarchy Int Child A',
                slug: 'hierarchy-int-child-a',
                isSystem: false
            }
        });

        await prisma.account.upsert({
            where: { id: CHILD_B_ID },
            update: {},
            create: {
                id: CHILD_B_ID,
                name: 'Hierarchy Int Child B',
                slug: 'hierarchy-int-child-b',
                isSystem: false
            }
        });
    });

    beforeEach(async () => {
        // Start each test with a clean set of assignments between our test accounts.
        await prisma.accountAssignment.deleteMany({
            where: {
                OR: [
                    { parentAccountId: ROOT_ID },
                    { parentAccountId: CHILD_A_ID },
                    { childAccountId: CHILD_A_ID },
                    { childAccountId: CHILD_B_ID }
                ]
            }
        });
    });

    afterAll(async () => {
        // Clean up any assignments created by this suite.
        await prisma.accountAssignment.deleteMany({
            where: {
                OR: [
                    { parentAccountId: ROOT_ID },
                    { parentAccountId: CHILD_A_ID },
                    { childAccountId: CHILD_A_ID },
                    { childAccountId: CHILD_B_ID }
                ]
            }
        });

        // Leave the accounts in place to avoid impacting other tests that
        // might rely on them in the future. If you want a fully clean DB,
        // you can delete them here as well.
    });

    it('creates a simple OWNERSHIP link from root to child A', async () => {
        const assignment = await prisma.accountAssignment.create({
            data: {
                parentAccountId: ROOT_ID,
                childAccountId: CHILD_A_ID,
                relationshipType: 'OWNERSHIP',
                status: 'ACTIVE'
            },
            include: {
                parentAccount: { select: { id: true, name: true } },
                childAccount: { select: { id: true, name: true } }
            }
        });

        expect(assignment.parentAccountId).toBe(ROOT_ID);
        expect(assignment.childAccountId).toBe(CHILD_A_ID);
        expect(assignment.relationshipType).toBe('OWNERSHIP');
        expect(assignment.status).toBe('ACTIVE');
        expect(assignment.parentAccount?.name).toBe('Hierarchy Int Root');
        expect(assignment.childAccount?.name).toBe('Hierarchy Int Child A');
    });

    it('can suspend and reactivate a relationship', async () => {
        const created = await prisma.accountAssignment.create({
            data: {
                parentAccountId: ROOT_ID,
                childAccountId: CHILD_A_ID,
                relationshipType: 'DELEGATION',
                status: 'ACTIVE'
            }
        });

        const suspended = await prisma.accountAssignment.update({
            where: { id: created.id },
            data: { status: 'SUSPENDED' }
        });
        expect(suspended.status).toBe('SUSPENDED');

        const reactivated = await prisma.accountAssignment.update({
            where: { id: created.id },
            data: { status: 'ACTIVE' }
        });
        expect(reactivated.status).toBe('ACTIVE');
    });

    it('enforces uniqueness on (parentAccountId, childAccountId, relationshipType)', async () => {
        await prisma.accountAssignment.create({
            data: {
                parentAccountId: ROOT_ID,
                childAccountId: CHILD_A_ID,
                relationshipType: 'OWNERSHIP',
                status: 'ACTIVE'
            }
        });

        await expect(
            prisma.accountAssignment.create({
                data: {
                    parentAccountId: ROOT_ID,
                    childAccountId: CHILD_A_ID,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                }
            })
        ).rejects.toBeTruthy();
    });

    it('supports a small two-level hierarchy for summary-style queries', async () => {
        // Root -> Child A (OWNERSHIP), Root -> Child B (DELEGATION)
        await prisma.accountAssignment.createMany({
            data: [
                {
                    parentAccountId: ROOT_ID,
                    childAccountId: CHILD_A_ID,
                    relationshipType: 'OWNERSHIP',
                    status: 'ACTIVE'
                },
                {
                    parentAccountId: ROOT_ID,
                    childAccountId: CHILD_B_ID,
                    relationshipType: 'DELEGATION',
                    status: 'SUSPENDED'
                }
            ]
        });

        const [total, parents, children, active, suspended] = await Promise.all([
            prisma.accountAssignment.count({
                where: {
                    parentAccountId: ROOT_ID,
                    childAccountId: { in: [CHILD_A_ID, CHILD_B_ID] }
                }
            }),
            prisma.accountAssignment.findMany({
                where: {
                    parentAccountId: ROOT_ID,
                    childAccountId: { in: [CHILD_A_ID, CHILD_B_ID] }
                },
                distinct: ['parentAccountId'],
                select: { parentAccountId: true }
            }),
            prisma.accountAssignment.findMany({
                where: {
                    parentAccountId: ROOT_ID,
                    childAccountId: { in: [CHILD_A_ID, CHILD_B_ID] }
                },
                distinct: ['childAccountId'],
                select: { childAccountId: true }
            }),
            prisma.accountAssignment.count({
                where: {
                    parentAccountId: ROOT_ID,
                    childAccountId: { in: [CHILD_A_ID, CHILD_B_ID] },
                    status: 'ACTIVE'
                }
            }),
            prisma.accountAssignment.count({
                where: {
                    parentAccountId: ROOT_ID,
                    childAccountId: { in: [CHILD_A_ID, CHILD_B_ID] },
                    status: 'SUSPENDED'
                }
            })
        ]);

        expect(total).toBe(2);
        expect(parents).toHaveLength(1);
        expect(children).toHaveLength(2);
        expect(active).toBe(1);
        expect(suspended).toBe(1);
    });
});
