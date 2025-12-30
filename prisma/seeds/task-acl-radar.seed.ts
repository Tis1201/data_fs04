/**
 * Task: ACL + Radar Seed
 * 
 * Self-contained seed file for testing ACL and Radar features.
 * Follows the correct hierarchy flow as documented in ACCOUNT_HIERARCHY_AND_FLOW.md
 * 
 * Flow:
 *   1. SYSTEM_ACCOUNT Admin creates Account
 *   2. SYSTEM_ACCOUNT Admin creates Company in Account
 *   3. SYSTEM_ACCOUNT Admin creates first User (OWNER)
 *   4. OWNER creates Groups and assigns permissions
 *   5. OWNER assigns Users to Groups
 * 
 * Scope (only modules with ACL implemented):
 *   - Admin Mode: Accounts (ACCOUNTS, COMPANIES, GROUPS) + ADMIN_CONTROLLERS_RADAR
 *   - User Mode: USER_CONTROLLERS_RADAR
 * 
 * Usage:
 *   npx tsx prisma/seeds/task-acl-radar.seed.ts
 * 
 * Prerequisites:
 *   - Run `npx prisma db seed` first to create SYSTEM_ACCOUNT + admin@admin.com
 * 
 * Test Structure:
 *   ============================================
 *   USER MODE (systemRole: USER)
 *   ============================================
 *   - owner@test.com: Account OWNER, creates groups and manages permissions
 *   - user-full@test.com: Full access to USER_CONTROLLERS_RADAR
 *   - user-view@test.com: View only to USER_CONTROLLERS_RADAR
 *   - user-noperm@test.com: No groups, only overrides
 * 
 *   ============================================
 *   ADMIN MODE (systemRole: ADMIN)
 *   ============================================
 *   - admin-full@test.com: Full access to Accounts + Radar
 *   - admin-accounts@test.com: Full access to Accounts only
 *   - admin-radar@test.com: Full access to Radar only
 *   - admin-view@test.com: View only to Accounts + Radar
 *   - admin-noperm@test.com: No groups, only overrides
 * 
 * Created data:
 *   - Test account & company (created by SYSTEM_ACCOUNT Admin)
 *   - Test users with proper hierarchy (OWNER creates groups)
 *   - Groups with permissions for each mode
 *   - User permission overrides
 *   - Radar controllers and sensors
 */

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { SYSTEM_ACCOUNT } from '../../src/lib/constants/system';

const prisma = new PrismaClient();

// =========================================
// MODULE DEFINITIONS
// Only modules with ACL implemented in this task
// =========================================

// Admin modules - Access section + Radar
const ADMIN_MODULES = {
    // Access section (Accounts module)
    ACCOUNTS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    COMPANIES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    GROUPS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    
    // Controllers section
    ADMIN_CONTROLLERS_RADAR: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
} as const;

// User modules - Only Radar (already implemented)
const USER_MODULES = {
    USER_CONTROLLERS_RADAR: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
} as const;

const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'] as const;

async function main() {
    console.log('🌱 Task: ACL + Radar Seed\n');
    console.log('─'.repeat(70));
    console.log('📋 Following correct hierarchy flow:');
    console.log('   1. SYSTEM_ACCOUNT Admin → Account');
    console.log('   2. SYSTEM_ACCOUNT Admin → Company');
    console.log('   3. SYSTEM_ACCOUNT Admin → User (OWNER)');
    console.log('   4. OWNER → Groups + Permissions');
    console.log('   5. OWNER → Assign Users to Groups');
    console.log('─'.repeat(70));

    // =========================================
    // STEP 1: Get SYSTEM_ACCOUNT and Admin
    // =========================================
    console.log('\n📌 STEP 1: Getting SYSTEM_ACCOUNT and Admin...');
    
    const systemAccount = await prisma.account.findUnique({
        where: { slug: SYSTEM_ACCOUNT }
    });

    if (!systemAccount) {
        console.error('❌ SYSTEM_ACCOUNT not found!');
        console.error('   Please run: npx prisma db seed');
        console.error('   This will create SYSTEM_ACCOUNT + admin@admin.com');
        process.exit(1);
    }
    console.log('  ✓ SYSTEM_ACCOUNT found:', systemAccount.name);

    const systemAdmin = await prisma.user.findUnique({
        where: { email: 'admin@admin.com' }
    });

    if (!systemAdmin) {
        console.error('❌ admin@admin.com not found!');
        console.error('   Please run: npx prisma db seed');
        console.error('   This will create SYSTEM_ACCOUNT + admin@admin.com');
        process.exit(1);
    }
    console.log('  ✓ System Admin found: admin@admin.com');

    // =========================================
    // STEP 2: SYSTEM_ACCOUNT Admin creates Account
    // =========================================
    console.log('\n📌 STEP 2: SYSTEM_ACCOUNT Admin creates Account...');

    const testAccount = await prisma.account.upsert({
        where: { slug: 'test-corp' },
        update: {},
        create: {
            name: 'Test Corporation',
            slug: 'test-corp',
            description: 'Test account for ACL and Radar testing',
            status: 'ACTIVE',
            isSystem: false
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ Account created:', testAccount.name);
    console.log('    → Created by: admin@admin.com (SYSTEM_ACCOUNT Admin)');

    // =========================================
    // STEP 3: SYSTEM_ACCOUNT Admin creates Company
    // =========================================
    console.log('\n📌 STEP 3: SYSTEM_ACCOUNT Admin creates Company...');

    const testCompany = await prisma.company.upsert({
        where: { id: 'test-company-1' },
        update: {},
        create: {
            id: 'test-company-1',
            name: 'Test Company HQ',
            status: 'ACTIVE',
            accountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ Company created:', testCompany.name);
    console.log('    → Belongs to:', testAccount.name);
    console.log('    → Created by: admin@admin.com (SYSTEM_ACCOUNT Admin)');

    // =========================================
    // STEP 4: SYSTEM_ACCOUNT Admin creates first User (OWNER)
    // =========================================
    console.log('\n📌 STEP 4: SYSTEM_ACCOUNT Admin creates first User (OWNER)...');
    const hashedPassword = await hash('test1234');

    const owner = await prisma.user.upsert({
        where: { email: 'owner@test.com' },
        update: {},
        create: {
            email: 'owner@test.com',
            name: 'Account Owner',
            password: hashedPassword,
            systemRole: 'USER',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ Owner created: owner@test.com (password: test1234)');
    console.log('    → Created by: admin@admin.com (SYSTEM_ACCOUNT Admin)');

    // Create AccountMembership with OWNER role
    const ownerMembership = await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: owner.id, accountId: testAccount.id } },
        update: { role: 'OWNER' },
        create: {
            userId: owner.id,
            accountId: testAccount.id,
            role: 'OWNER' // First user is OWNER
        }
    });
    console.log('  ✓ AccountMembership: role = OWNER');

    // =========================================
    // STEP 5: Create other test users
    // =========================================
    console.log('\n📌 STEP 5: Creating other test users...');

    // --- USER MODE USERS (systemRole: USER) ---
    console.log('\n  [User Mode - systemRole: USER]');

    const userFull = await prisma.user.upsert({
        where: { email: 'user-full@test.com' },
        update: {},
        create: {
            email: 'user-full@test.com',
            name: 'User Full Access',
            password: hashedPassword,
            systemRole: 'USER',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ user-full@test.com');

    const userView = await prisma.user.upsert({
        where: { email: 'user-view@test.com' },
        update: {},
        create: {
            email: 'user-view@test.com',
            name: 'User View Only',
            password: hashedPassword,
            systemRole: 'USER',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ user-view@test.com');

    const userNoPerm = await prisma.user.upsert({
        where: { email: 'user-noperm@test.com' },
        update: {},
        create: {
            email: 'user-noperm@test.com',
            name: 'User No Permission',
            password: hashedPassword,
            systemRole: 'USER',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ user-noperm@test.com');

    // --- ADMIN MODE USERS (systemRole: ADMIN) ---
    console.log('\n  [Admin Mode - systemRole: ADMIN]');

    const adminFull = await prisma.user.upsert({
        where: { email: 'admin-full@test.com' },
        update: {},
        create: {
            email: 'admin-full@test.com',
            name: 'Admin Full Access',
            password: hashedPassword,
            systemRole: 'ADMIN',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ admin-full@test.com');

    const adminAccounts = await prisma.user.upsert({
        where: { email: 'admin-accounts@test.com' },
        update: {},
        create: {
            email: 'admin-accounts@test.com',
            name: 'Admin Accounts Only',
            password: hashedPassword,
            systemRole: 'ADMIN',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ admin-accounts@test.com');

    const adminRadar = await prisma.user.upsert({
        where: { email: 'admin-radar@test.com' },
        update: {},
        create: {
            email: 'admin-radar@test.com',
            name: 'Admin Radar Only',
            password: hashedPassword,
            systemRole: 'ADMIN',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ admin-radar@test.com');

    const adminView = await prisma.user.upsert({
        where: { email: 'admin-view@test.com' },
        update: {},
        create: {
            email: 'admin-view@test.com',
            name: 'Admin View Only',
            password: hashedPassword,
            systemRole: 'ADMIN',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ admin-view@test.com');

    const adminNoPerm = await prisma.user.upsert({
        where: { email: 'admin-noperm@test.com' },
        update: {},
        create: {
            email: 'admin-noperm@test.com',
            name: 'Admin No Permission',
            password: hashedPassword,
            systemRole: 'ADMIN',
            primaryAccountId: testAccount.id
            // Created by SYSTEM_ACCOUNT Admin (admin@admin.com)
        }
    });
    console.log('  ✓ admin-noperm@test.com');

    // Create AccountMemberships for all users
    console.log('\n  Creating AccountMemberships...');

    const userFullMembership = await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: userFull.id, accountId: testAccount.id } },
        update: {},
        create: { userId: userFull.id, accountId: testAccount.id, role: 'MEMBER' }
    });

    const userViewMembership = await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: userView.id, accountId: testAccount.id } },
        update: {},
        create: { userId: userView.id, accountId: testAccount.id, role: 'MEMBER' }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: userNoPerm.id, accountId: testAccount.id } },
        update: {},
        create: { userId: userNoPerm.id, accountId: testAccount.id, role: 'MEMBER' }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: adminFull.id, accountId: testAccount.id } },
        update: {},
        create: { userId: adminFull.id, accountId: testAccount.id, role: 'ADMIN' }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: adminAccounts.id, accountId: testAccount.id } },
        update: {},
        create: { userId: adminAccounts.id, accountId: testAccount.id, role: 'ADMIN' }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: adminRadar.id, accountId: testAccount.id } },
        update: {},
        create: { userId: adminRadar.id, accountId: testAccount.id, role: 'ADMIN' }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: adminView.id, accountId: testAccount.id } },
        update: {},
        create: { userId: adminView.id, accountId: testAccount.id, role: 'ADMIN' }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: adminNoPerm.id, accountId: testAccount.id } },
        update: {},
        create: { userId: adminNoPerm.id, accountId: testAccount.id, role: 'ADMIN' }
    });

    console.log('  ✓ All users added to Test Corporation');

    // =========================================
    // STEP 6: OWNER creates Groups
    // =========================================
    console.log('\n📌 STEP 6: OWNER creates Groups and assigns permissions...');
    console.log('    → Acting as: owner@test.com (Account OWNER)');

    // --- USER MODE GROUPS (Radar only) ---
    console.log('\n  [User Mode - Radar]');

    const userRadarFullGroup = await prisma.group.upsert({
        where: { accountId_name: { accountId: testAccount.id, name: 'User Radar - Full Access' } },
        update: {},
        create: {
            name: 'User Radar - Full Access',
            description: 'Full access to User Radar Controllers (VIEW, CREATE, EDIT, DELETE)',
            accountId: testAccount.id
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ User Radar - Full Access');

    const userRadarViewOnlyGroup = await prisma.group.upsert({
        where: { accountId_name: { accountId: testAccount.id, name: 'User Radar - View Only' } },
        update: {},
        create: {
            name: 'User Radar - View Only',
            description: 'View-only access to User Radar Controllers',
            accountId: testAccount.id
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ User Radar - View Only');

    // --- ADMIN MODE GROUPS (Accounts + Radar) ---
    console.log('\n  [Admin Mode - Accounts & Radar]');

    const adminFullAccessGroup = await prisma.group.upsert({
        where: { accountId_name: { accountId: testAccount.id, name: 'Admin - Full Access' } },
        update: {},
        create: {
            name: 'Admin - Full Access',
            description: 'Full access to Accounts, Companies, Groups + Admin Radar',
            accountId: testAccount.id
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Admin - Full Access');

    const adminAccountsOnlyGroup = await prisma.group.upsert({
        where: { accountId_name: { accountId: testAccount.id, name: 'Admin - Accounts Only' } },
        update: {},
        create: {
            name: 'Admin - Accounts Only',
            description: 'Full access to Accounts, Companies, Groups (no Radar)',
            accountId: testAccount.id
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Admin - Accounts Only');

    const adminRadarOnlyGroup = await prisma.group.upsert({
        where: { accountId_name: { accountId: testAccount.id, name: 'Admin - Radar Only' } },
        update: {},
        create: {
            name: 'Admin - Radar Only',
            description: 'Full access to Admin Radar Controllers only',
            accountId: testAccount.id
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Admin - Radar Only');

    const adminViewOnlyGroup = await prisma.group.upsert({
        where: { accountId_name: { accountId: testAccount.id, name: 'Admin - View Only' } },
        update: {},
        create: {
            name: 'Admin - View Only',
            description: 'View-only access to Accounts + Radar',
            accountId: testAccount.id
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Admin - View Only');

    // =========================================
    // STEP 7: OWNER assigns Permissions to Groups
    // =========================================
    console.log('\n📌 STEP 7: OWNER assigns Permissions to Groups...');
    console.log('    → Acting as: owner@test.com (Account OWNER)');

    // Helper function to grant permissions
    async function grantPermissions(groupId: string, module: string, actions: readonly string[]) {
        for (const action of actions) {
            await prisma.permission.upsert({
                where: { groupId_module_action: { groupId, module, action } },
                update: { allowed: true },
                create: {
                    groupId,
                    module,
                    action,
                    allowed: true
                    // Created by OWNER (owner@test.com)
                }
            });
        }
    }

    // --- USER MODE PERMISSIONS (Radar only) ---
    console.log('\n  [User Mode - Radar]');

    await grantPermissions(userRadarFullGroup.id, 'USER_CONTROLLERS_RADAR', ACTIONS);
    console.log('  ✓ User Radar - Full Access: VIEW, CREATE, EDIT, DELETE');

    await grantPermissions(userRadarViewOnlyGroup.id, 'USER_CONTROLLERS_RADAR', ['VIEW']);
    console.log('  ✓ User Radar - View Only: VIEW only');

    // --- ADMIN MODE PERMISSIONS (Accounts + Radar) ---
    console.log('\n  [Admin Mode - Accounts & Radar]');

    for (const [module, actions] of Object.entries(ADMIN_MODULES)) {
        await grantPermissions(adminFullAccessGroup.id, module, actions);
    }
    console.log('  ✓ Admin - Full Access: Full Accounts/Companies/Groups + Full Radar');

    await grantPermissions(adminAccountsOnlyGroup.id, 'ACCOUNTS', ACTIONS);
    await grantPermissions(adminAccountsOnlyGroup.id, 'COMPANIES', ACTIONS);
    await grantPermissions(adminAccountsOnlyGroup.id, 'GROUPS', ACTIONS);
    console.log('  ✓ Admin - Accounts Only: Full Accounts/Companies/Groups');

    await grantPermissions(adminRadarOnlyGroup.id, 'ADMIN_CONTROLLERS_RADAR', ACTIONS);
    console.log('  ✓ Admin - Radar Only: Full Admin Radar');

    await grantPermissions(adminViewOnlyGroup.id, 'ACCOUNTS', ['VIEW']);
    await grantPermissions(adminViewOnlyGroup.id, 'COMPANIES', ['VIEW']);
    await grantPermissions(adminViewOnlyGroup.id, 'GROUPS', ['VIEW']);
    await grantPermissions(adminViewOnlyGroup.id, 'ADMIN_CONTROLLERS_RADAR', ['VIEW']);
    console.log('  ✓ Admin - View Only: VIEW only for Accounts/Companies/Groups/Radar');

    // =========================================
    // STEP 8: OWNER assigns Users to Groups
    // =========================================
    console.log('\n📌 STEP 8: OWNER assigns Users to Groups...');
    console.log('    → Acting as: owner@test.com (Account OWNER)');

    // --- USER MODE GROUP MEMBERSHIPS ---
    console.log('\n  [User Mode]');

    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: userRadarFullGroup.id, membershipId: userFullMembership.id } },
        update: {},
        create: {
            groupId: userRadarFullGroup.id,
            membershipId: userFullMembership.id
            // Assigned by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ user-full@test.com → User Radar Full Access');

    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: userRadarViewOnlyGroup.id, membershipId: userViewMembership.id } },
        update: {},
        create: {
            groupId: userRadarViewOnlyGroup.id,
            membershipId: userViewMembership.id
            // Assigned by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ user-view@test.com → User Radar View Only');

    console.log('  ✓ user-noperm@test.com → (no group - for override testing)');

    // --- ADMIN MODE GROUP MEMBERSHIPS ---
    console.log('\n  [Admin Mode]');

    const adminFullMembership = await prisma.accountMembership.findUniqueOrThrow({
        where: { userId_accountId: { userId: adminFull.id, accountId: testAccount.id } }
    });
    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: adminFullAccessGroup.id, membershipId: adminFullMembership.id } },
        update: {},
        create: {
            groupId: adminFullAccessGroup.id,
            membershipId: adminFullMembership.id
            // Assigned by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ admin-full@test.com → Admin Full Access (Accounts + Radar)');

    const adminAccountsMembership = await prisma.accountMembership.findUniqueOrThrow({
        where: { userId_accountId: { userId: adminAccounts.id, accountId: testAccount.id } }
    });
    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: adminAccountsOnlyGroup.id, membershipId: adminAccountsMembership.id } },
        update: {},
        create: {
            groupId: adminAccountsOnlyGroup.id,
            membershipId: adminAccountsMembership.id
            // Assigned by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ admin-accounts@test.com → Admin Accounts Only');

    const adminRadarMembership = await prisma.accountMembership.findUniqueOrThrow({
        where: { userId_accountId: { userId: adminRadar.id, accountId: testAccount.id } }
    });
    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: adminRadarOnlyGroup.id, membershipId: adminRadarMembership.id } },
        update: {},
        create: {
            groupId: adminRadarOnlyGroup.id,
            membershipId: adminRadarMembership.id
            // Assigned by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ admin-radar@test.com → Admin Radar Only');

    const adminViewMembership = await prisma.accountMembership.findUniqueOrThrow({
        where: { userId_accountId: { userId: adminView.id, accountId: testAccount.id } }
    });
    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: adminViewOnlyGroup.id, membershipId: adminViewMembership.id } },
        update: {},
        create: {
            groupId: adminViewOnlyGroup.id,
            membershipId: adminViewMembership.id
            // Assigned by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ admin-view@test.com → Admin View Only');

    console.log('  ✓ admin-noperm@test.com → (no group - for override testing)');

    // =========================================
    // STEP 9: Create User Permission Overrides
    // =========================================
    console.log('\n📌 STEP 9: Creating user permission overrides...');

    // Helper function to create override
    async function createOverride(userId: string, module: string, action: string, allowed: boolean, reason: string) {
        await prisma.userPermissionOverride.upsert({
            where: {
                userId_accountId_module_action: {
                    userId,
                    accountId: testAccount.id,
                    module,
                    action
                }
            },
            update: { allowed },
            create: {
                userId,
                accountId: testAccount.id,
                module,
                action,
                allowed,
                reason,
                isActive: true
                // Created by OWNER (owner@test.com)
            }
        });
    }

    // --- USER MODE OVERRIDES (Radar) ---
    console.log('\n  [User Mode - Radar Overrides]');

    await createOverride(userView.id, 'USER_CONTROLLERS_RADAR', 'CREATE', true, 'Override: Grant CREATE access for radar testing');
    console.log('  ✓ user-view@test.com: +CREATE on USER_CONTROLLERS_RADAR (override)');

    await createOverride(userNoPerm.id, 'USER_CONTROLLERS_RADAR', 'VIEW', true, 'Override: Grant VIEW access for radar monitoring');
    console.log('  ✓ user-noperm@test.com: +VIEW on USER_CONTROLLERS_RADAR (override only)');

    // --- ADMIN MODE OVERRIDES (Accounts + Radar) ---
    console.log('\n  [Admin Mode - Accounts & Radar Overrides]');

    await createOverride(adminView.id, 'ADMIN_CONTROLLERS_RADAR', 'CREATE', true, 'Override: Grant CREATE access for admin radar testing');
    console.log('  ✓ admin-view@test.com: +CREATE on ADMIN_CONTROLLERS_RADAR (override)');

    await createOverride(adminNoPerm.id, 'ADMIN_CONTROLLERS_RADAR', 'VIEW', true, 'Override: Grant VIEW access for admin radar');
    await createOverride(adminNoPerm.id, 'ACCOUNTS', 'VIEW', true, 'Override: Grant VIEW access for accounts');
    console.log('  ✓ admin-noperm@test.com: +VIEW on ADMIN_CONTROLLERS_RADAR, ACCOUNTS (override only)');

    // =========================================
    // STEP 10: Create Radar Device & Controllers
    // =========================================
    console.log('\n📌 STEP 10: Creating radar data...');

    const testDevice = await prisma.device.upsert({
        where: { apiKey: 'test-radar-device-api-key' },
        update: {},
        create: {
            name: 'Radar Gateway Device',
            description: 'Gateway device for radar controllers',
            status: 'ACTIVE',
            apiKey: 'test-radar-device-api-key',
            accountId: testAccount.id,
            companyId: testCompany.id,
            deviceType: 'GATEWAY',
            manufacturer: 'DataReal',
            model: 'DRG-100'
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Gateway device:', testDevice.name);

    const controller1 = await prisma.controller.upsert({
        where: { serialNumber: 'RADAR-CTRL-001' },
        update: {},
        create: {
            name: 'Main Entrance Radar',
            type: 'RADAR',
            serialNumber: 'RADAR-CTRL-001',
            status: 'ACTIVE',
            deviceId: testDevice.id,
            accountId: testAccount.id,
            description: 'Radar controller at main entrance'
            // Created by OWNER (owner@test.com)
        }
    });

    const controller2 = await prisma.controller.upsert({
        where: { serialNumber: 'RADAR-CTRL-002' },
        update: {},
        create: {
            name: 'Parking Lot Radar',
            type: 'RADAR',
            serialNumber: 'RADAR-CTRL-002',
            status: 'ACTIVE',
            deviceId: testDevice.id,
            accountId: testAccount.id,
            description: 'Radar controller for parking monitoring'
            // Created by OWNER (owner@test.com)
        }
    });

    const controller3 = await prisma.controller.upsert({
        where: { serialNumber: 'RADAR-CTRL-003' },
        update: {},
        create: {
            name: 'Warehouse Radar',
            type: 'RADAR',
            serialNumber: 'RADAR-CTRL-003',
            status: 'INACTIVE',
            deviceId: testDevice.id,
            accountId: testAccount.id,
            description: 'Radar controller for warehouse (offline)'
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Controllers: Main Entrance, Parking Lot, Warehouse');

    // =========================================
    // STEP 11: Create Radar Sensors
    // =========================================
    await prisma.sensor.upsert({
        where: { serialNumber: 'RADAR-SNS-001' },
        update: {},
        create: {
            name: 'Entry Point Sensor A',
            type: 'RADAR_SENSOR',
            serialNumber: 'RADAR-SNS-001',
            status: 'ACTIVE',
            controllerId: controller1.id,
            accountId: testAccount.id,
            location: 'Main Gate - Left',
            firmware: 'v2.1.0',
            config: { detectionRange: 50, sensitivity: 'HIGH', trackingEnabled: true }
            // Created by OWNER (owner@test.com)
        }
    });

    await prisma.sensor.upsert({
        where: { serialNumber: 'RADAR-SNS-002' },
        update: {},
        create: {
            name: 'Entry Point Sensor B',
            type: 'RADAR_SENSOR',
            serialNumber: 'RADAR-SNS-002',
            status: 'ACTIVE',
            controllerId: controller1.id,
            accountId: testAccount.id,
            location: 'Main Gate - Right',
            firmware: 'v2.1.0',
            config: { detectionRange: 50, sensitivity: 'HIGH', trackingEnabled: true }
            // Created by OWNER (owner@test.com)
        }
    });

    await prisma.sensor.upsert({
        where: { serialNumber: 'RADAR-SNS-003' },
        update: {},
        create: {
            name: 'Parking Zone Sensor',
            type: 'RADAR_SENSOR',
            serialNumber: 'RADAR-SNS-003',
            status: 'ACTIVE',
            controllerId: controller2.id,
            accountId: testAccount.id,
            location: 'Parking Lot B1',
            firmware: 'v2.0.5',
            config: { detectionRange: 100, sensitivity: 'MEDIUM', trackingEnabled: true, occupancyTracking: true }
            // Created by OWNER (owner@test.com)
        }
    });
    console.log('  ✓ Sensors: Entry A, Entry B, Parking Zone');

    // =========================================
    // SUMMARY
    // =========================================
    console.log('\n' + '═'.repeat(70));
    console.log('✅ SEED COMPLETED!');
    console.log('═'.repeat(70));
    console.log('\n📋 HIERARCHY FLOW (as documented):');
    console.log('   1. ✅ SYSTEM_ACCOUNT Admin (admin@admin.com) → Account');
    console.log('   2. ✅ SYSTEM_ACCOUNT Admin → Company');
    console.log('   3. ✅ SYSTEM_ACCOUNT Admin → User (owner@test.com, OWNER)');
    console.log('   4. ✅ OWNER → Groups + Permissions');
    console.log('   5. ✅ OWNER → Assign Users to Groups');
    console.log('   6. ✅ OWNER → Create Radar Data');
    
    console.log('\n📌 SCOPE: Accounts (Admin) + Radar (Admin & User)');
    
    console.log('\n' + '═'.repeat(70));
    console.log('📋 USER MODE TEST ACCOUNTS (systemRole: USER)');
    console.log('═'.repeat(70));
    console.log('┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│ owner@test.com / test1234                                            │');
    console.log('│   → systemRole: USER                                                  │');
    console.log('│   → AccountMembership.role: OWNER                                     │');
    console.log('│   → Created Groups, Permissions, and assigned Users                  │');
    console.log('│   → Test: Can manage Account, create Groups, assign Users            │');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ user-full@test.com / test1234                                        │');
    console.log('│   → systemRole: USER                                                  │');
    console.log('│   → Group: User Radar - Full Access                                   │');
    console.log('│   → Permissions: VIEW, CREATE, EDIT, DELETE on USER_CONTROLLERS_RADAR│');
    console.log('│   → Test: /user/controllers/radar → All buttons visible              │');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ user-view@test.com / test1234                                        │');
    console.log('│   → systemRole: USER                                                  │');
    console.log('│   → Group: User Radar - View Only                                     │');
    console.log('│   → Override: +CREATE on USER_CONTROLLERS_RADAR                       │');
    console.log('│   → Test: /user/controllers/radar → VIEW + CREATE (override)        │');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ user-noperm@test.com / test1234                                      │');
    console.log('│   → systemRole: USER                                                  │');
    console.log('│   → No group (testing overrides only)                                 │');
    console.log('│   → Override: +VIEW on USER_CONTROLLERS_RADAR                         │');
    console.log('│   → Test: /user/controllers/radar → VIEW only (override)             │');
    console.log('└──────────────────────────────────────────────────────────────────────┘');
    
    console.log('\n' + '═'.repeat(70));
    console.log('📋 ADMIN MODE TEST ACCOUNTS (systemRole: ADMIN)');
    console.log('═'.repeat(70));
    console.log('┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│ admin-full@test.com / test1234                                       │');
    console.log('│   → systemRole: ADMIN (can access /admin/* routes)                  │');
    console.log('│   → Group: Admin - Full Access                                       │');
    console.log('│   → Permissions: Full Accounts/Companies/Groups + Radar              │');
    console.log('│   → Test: /admin/* → ✅ All routes accessible (has permissions)      │');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ admin-accounts@test.com / test1234                                  │');
    console.log('│   → systemRole: ADMIN (can access /admin/* routes)                   │');
    console.log('│   → Group: Admin - Accounts Only                                     │');
    console.log('│   → Permissions: Full Accounts/Companies/Groups (no Radar)           │');
    console.log('│   → Test: /admin/accounts/* → ✅ Access, /admin/controllers/radar → ❌ No access');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ admin-radar@test.com / test1234                                      │');
    console.log('│   → systemRole: ADMIN (can access /admin/* routes)                   │');
    console.log('│   → Group: Admin - Radar Only                                        │');
    console.log('│   → Permissions: Full ADMIN_CONTROLLERS_RADAR (no Accounts)          │');
    console.log('│   → Test: /admin/controllers/radar → ✅ Access, /admin/accounts → ❌ No access');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ admin-view@test.com / test1234                                       │');
    console.log('│   → systemRole: ADMIN (can access /admin/* routes)                   │');
    console.log('│   → Group: Admin - View Only                                          │');
    console.log('│   → Override: +CREATE on ADMIN_CONTROLLERS_RADAR                      │');
    console.log('│   → Test: /admin/* → VIEW only, but CREATE Radar works (override)    │');
    console.log('├──────────────────────────────────────────────────────────────────────┤');
    console.log('│ admin-noperm@test.com / test1234                                     │');
    console.log('│   → systemRole: ADMIN (can access /admin/* routes)                   │');
    console.log('│   → No group (testing overrides only)                                 │');
    console.log('│   → Override: +VIEW on ADMIN_CONTROLLERS_RADAR, ACCOUNTS              │');
    console.log('│   → Test: /admin/* → VIEW only (via overrides), no CREATE/EDIT/DELETE │');
    console.log('└──────────────────────────────────────────────────────────────────────┘');
    
    console.log('\n🧪 TEST SCENARIOS (User Mode):');
    console.log('1. user-full@test.com /user/controllers/radar → ✅ All buttons visible');
    console.log('2. user-view@test.com /user/controllers/radar → ✅ VIEW + CREATE (override)');
    console.log('3. user-noperm@test.com /user/controllers/radar → ✅ VIEW only (override)');
    console.log('4. /user/controllers/radar/new as user-noperm → ❌ 403 Forbidden');
    console.log('5. /user/controllers/radar/new as user-view → ✅ Works (override)');
    
    console.log('\n🧪 TEST SCENARIOS (Admin Mode):');
    console.log('6. admin-full@test.com /admin/* → ✅ All routes accessible (has permissions)');
    console.log('7. admin-accounts@test.com /admin/accounts/* → ✅ Full access');
    console.log('8. admin-accounts@test.com /admin/controllers/radar → ❌ 403 Forbidden (no Radar group)');
    console.log('9. admin-radar@test.com /admin/controllers/radar → ✅ Full access');
    console.log('10. admin-radar@test.com /admin/accounts/* → ❌ 403 Forbidden (no Accounts group)');
    console.log('11. admin-view@test.com /admin/* → ✅ VIEW only, but CREATE Radar works (override)');
    console.log('12. admin-noperm@test.com /admin/* → ✅ VIEW only (override)');
    
    console.log('\n📡 RADAR DATA:');
    console.log('• Controllers: Main Entrance, Parking Lot, Warehouse');
    console.log('• Sensors: Entry A, Entry B, Parking Zone');
    console.log('• Gateway Device: Radar Gateway Device');
    console.log('\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
