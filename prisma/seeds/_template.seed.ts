/**
 * Task: [Task Name] Seed
 * 
 * Description: [Brief description of what this task seeds]
 * 
 * Usage:
 *   npx tsx prisma/seeds/task-xxx.seed.ts
 * 
 * Notes:
 *   - Use upsert to avoid duplicates
 *   - Prefix unique keys (email, slug, apiKey) to avoid conflicts with other tasks
 *   - This file is self-contained, no dependencies on other seeds
 */

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Task: [Task Name] Seed\n');
    console.log('─'.repeat(50));

    // =========================================
    // 1. CREATE ACCOUNT (if needed)
    // =========================================
    console.log('\n📦 Creating account...');

    const account = await prisma.account.upsert({
        where: { slug: 'task-xxx-account' },  // Prefix with task name
        update: {},
        create: {
            name: 'Task XXX Account',
            slug: 'task-xxx-account',
            status: 'ACTIVE'
        }
    });
    console.log('  ✓ Account:', account.name);

    // =========================================
    // 2. CREATE USERS (if needed)
    // =========================================
    console.log('\n👥 Creating users...');
    const hashedPassword = await hash('test1234');

    const testUser = await prisma.user.upsert({
        where: { email: 'task-xxx@test.com' },  // Prefix with task name
        update: {},
        create: {
            email: 'task-xxx@test.com',
            name: 'Task XXX User',
            password: hashedPassword,
            systemRole: 'USER',
            primaryAccountId: account.id,
        }
    });
    console.log('  ✓ User:', testUser.email);

    // =========================================
    // 3. CREATE ACCOUNT MEMBERSHIP
    // =========================================
    const membership = await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: testUser.id, accountId: account.id } },
        update: {},
        create: { userId: testUser.id, accountId: account.id, role: 'MEMBER' }
    });
    console.log('  ✓ Membership created');

    // =========================================
    // 4. CREATE GROUP + PERMISSIONS (if needed)
    // =========================================
    console.log('\n🔐 Creating group & permissions...');

    const group = await prisma.group.upsert({
        where: { accountId_name: { accountId: account.id, name: 'Task XXX Group' } },
        update: {},
        create: {
            name: 'Task XXX Group',
            description: 'Group for Task XXX',
            accountId: account.id
        }
    });

    // Add permissions
    const modules = ['USER_DEVICES', 'USER_DASHBOARD'];
    const actions = ['VIEW', 'CREATE', 'EDIT', 'DELETE'] as const;
    
    for (const module of modules) {
        for (const action of actions) {
            await prisma.permission.upsert({
                where: { groupId_module_action: { groupId: group.id, module, action } },
                update: { allowed: true },
                create: { groupId: group.id, module, action, allowed: true }
            });
        }
    }
    console.log('  ✓ Group + Permissions');

    // Add user to group
    await prisma.groupMembership.upsert({
        where: { groupId_membershipId: { groupId: group.id, membershipId: membership.id } },
        update: {},
        create: { groupId: group.id, membershipId: membership.id }
    });
    console.log('  ✓ User added to group');

    // =========================================
    // 5. CREATE FEATURE-SPECIFIC DATA
    // =========================================
    console.log('\n📊 Creating feature-specific data...');

    // Example: create a device
    // const device = await prisma.device.upsert({
    //     where: { apiKey: 'task-xxx-device-key' },
    //     update: {},
    //     create: {
    //         name: 'Task XXX Device',
    //         apiKey: 'task-xxx-device-key',
    //         accountId: account.id
    //     }
    // });
    // console.log('  ✓ Device:', device.name);

    // =========================================
    // SUMMARY
    // =========================================
    console.log('\n' + '═'.repeat(50));
    console.log('✅ SEED COMPLETED!');
    console.log('═'.repeat(50));
    console.log('\n📋 CREATED DATA:');
    console.log('  • Account:', account.name);
    console.log('  • User: task-xxx@test.com / test1234');
    console.log('  • Group:', group.name);
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
