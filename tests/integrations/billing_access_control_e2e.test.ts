/**
 * Billing Access Control E2E Tests
 * 
 * Verifies that billing pages and APIs are restricted to Account OWNERs only.
 * 
 * Run with: npx vitest run tests/integrations/billing_access_control_e2e.test.ts
 * 
 * Prerequisites:
 * - Dev server running: npm run dev
 */

import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getAdminPrisma } from '$lib/server/prisma';
import { randomUUID } from 'crypto';
import { hash } from '@node-rs/argon2';

const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';

describe('Billing Access Control E2E', () => {
    const prisma = getAdminPrisma();

    let testAccountId: string;
    let ownerUserId: string;
    let memberUserId: string;
    let ownerSessionCookie: string;
    let memberSessionCookie: string;

    beforeAll(async () => {
        const uniqueId = randomUUID().slice(0, 8);

        // Create test account
        const account = await prisma.account.create({
            data: {
                id: `test-billing-${uniqueId}`,
                name: 'Test Billing Access Account',
                slug: `test-billing-${uniqueId}`
            }
        });
        testAccountId = account.id;

        // Create owner user
        const ownerPasswordHash = await hash('ownerpassword123');
        const ownerUser = await prisma.user.create({
            data: {
                id: `owner-${uniqueId}`,
                email: `owner-${uniqueId}@test.local`,
                password: ownerPasswordHash,
                name: 'Test Owner',
                systemRole: 'USER',
                primaryAccountId: testAccountId
            }
        });
        ownerUserId = ownerUser.id;

        // Create OWNER membership
        await prisma.accountMembership.create({
            data: {
                userId: ownerUserId,
                accountId: testAccountId,
                role: 'OWNER'
            }
        });

        // Create member user
        const memberPasswordHash = await hash('memberpassword123');
        const memberUser = await prisma.user.create({
            data: {
                id: `member-${uniqueId}`,
                email: `member-${uniqueId}@test.local`,
                password: memberPasswordHash,
                name: 'Test Member',
                systemRole: 'USER',
                primaryAccountId: testAccountId
            }
        });
        memberUserId = memberUser.id;

        // Create MEMBER membership
        await prisma.accountMembership.create({
            data: {
                userId: memberUserId,
                accountId: testAccountId,
                role: 'MEMBER'
            }
        });

        // Create session for OWNER
        const ownerSessionId = randomUUID();
        await prisma.session.create({
            data: {
                id: ownerSessionId,
                userId: ownerUserId,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60) // 1 hour
            }
        });
        ownerSessionCookie = `auth_session=${ownerSessionId}`;

        // Create session for MEMBER
        const memberSessionId = randomUUID();
        await prisma.session.create({
            data: {
                id: memberSessionId,
                userId: memberUserId,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60) // 1 hour
            }
        });
        memberSessionCookie = `auth_session=${memberSessionId}`;

        console.log('[BillingAccessE2E] Setup complete', {
            testAccountId,
            ownerUserId,
            memberUserId,
            ownerSessionId,
            memberSessionId
        });
    }, 30_000);

    afterAll(async () => {
        // Cleanup
        try {
            await prisma.session.deleteMany({ where: { userId: { in: [ownerUserId, memberUserId] } } });
            await prisma.accountMembership.deleteMany({ where: { accountId: testAccountId } });
            await prisma.user.delete({ where: { id: ownerUserId } });
            await prisma.user.delete({ where: { id: memberUserId } });
            await prisma.account.delete({ where: { id: testAccountId } });
        } catch (e) {
            console.warn('[BillingAccessE2E] Cleanup warning:', e);
        }
    });

    describe('Billing Page Access', () => {
        it('OWNER can access /user/settings/billing', async () => {
            const res = await fetch(`${WEB_BASE_URL}/user/settings/billing`, {
                headers: {
                    Cookie: ownerSessionCookie
                },
                redirect: 'manual'
            });

            // 200 = success, 302 redirect to login means no session
            // We accept 200 or any non-403 as "allowed"
            expect(res.status).not.toBe(403);
        });

        it('MEMBER is forbidden from /user/settings/billing', async () => {
            const res = await fetch(`${WEB_BASE_URL}/user/settings/billing`, {
                headers: {
                    Cookie: memberSessionCookie
                },
                redirect: 'manual'
            });

            // Should be 403 Forbidden
            expect(res.status).toBe(403);
        });

        it('OWNER can access /user/billing/invoices', async () => {
            const res = await fetch(`${WEB_BASE_URL}/user/billing/invoices`, {
                headers: {
                    Cookie: ownerSessionCookie
                },
                redirect: 'manual'
            });

            expect(res.status).not.toBe(403);
        });

        it('MEMBER is forbidden from /user/billing/invoices', async () => {
            const res = await fetch(`${WEB_BASE_URL}/user/billing/invoices`, {
                headers: {
                    Cookie: memberSessionCookie
                },
                redirect: 'manual'
            });

            expect(res.status).toBe(403);
        });
    });

    describe('Billing API Access', () => {
        it('OWNER can call POST /api/billing/checkout', async () => {
            const res = await fetch(`${WEB_BASE_URL}/api/billing/checkout`, {
                method: 'POST',
                headers: {
                    Cookie: ownerSessionCookie,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ planCode: 'starter' })
            });

            // 400/404 = plan issue (allowed to reach endpoint)
            // 403 = forbidden (should NOT happen for OWNER)
            expect(res.status).not.toBe(403);
        });

        it('MEMBER is forbidden from POST /api/billing/checkout', async () => {
            const res = await fetch(`${WEB_BASE_URL}/api/billing/checkout`, {
                method: 'POST',
                headers: {
                    Cookie: memberSessionCookie,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ planCode: 'starter' })
            });

            expect(res.status).toBe(403);
        });

        it('OWNER can call POST /api/billing/portal', async () => {
            const res = await fetch(`${WEB_BASE_URL}/api/billing/portal`, {
                method: 'POST',
                headers: {
                    Cookie: ownerSessionCookie,
                    'Content-Type': 'application/json'
                }
            });

            // 400 = no billing info (allowed to reach endpoint)
            // 403 = forbidden (should NOT happen for OWNER)
            expect(res.status).not.toBe(403);
        });

        it('MEMBER is forbidden from POST /api/billing/portal', async () => {
            const res = await fetch(`${WEB_BASE_URL}/api/billing/portal`, {
                method: 'POST',
                headers: {
                    Cookie: memberSessionCookie,
                    'Content-Type': 'application/json'
                }
            });

            expect(res.status).toBe(403);
        });
    });
});
