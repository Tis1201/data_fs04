import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { SYSTEM_ACCOUNT } from '../src/lib/constants/system';

const prisma = new PrismaClient();

async function seedUsers() {
    console.log('🌱 Seeding specific users and accounts...');

    // 1. Ensure Plans exist (should be seeded by seed-plans.ts, but handling fallback or assuming it's run before)
    // We'll assume seed-plans.ts ran.

    // 2. Create Blue.com Account
    const blueAccount = await prisma.account.upsert({
        where: { slug: 'blue-com' },
        update: {},
        create: {
            name: 'Blue.com',
            slug: 'blue-com',
            isSystem: false,
        }
    });
    console.log(`✅ Account 'Blue.com' (blue-com) ready: ${blueAccount.id}`);

    // 3. Create user_01@blue.com
    const blueUserPassword = await hash('password123');
    const blueUser = await prisma.user.upsert({
        where: { email: 'user_01@blue.com' },
        update: {},
        create: {
            email: 'user_01@blue.com',
            password: blueUserPassword,
            name: 'User 01',
            systemRole: 'USER', // Standard user
            primaryAccountId: blueAccount.id,
        }
    });

    // Membership for user_01 in Blue.com
    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: blueUser.id, accountId: blueAccount.id } },
        update: {},
        create: {
            userId: blueUser.id,
            accountId: blueAccount.id,
            role: 'OWNER' // Giving them owner of their account
        }
    });
    console.log(`✅ User 'user_01@blue.com' ready (Owner of Blue.com)`);

    // 4. Create a generic "User User" (user@example.com) for generic testing
    const genericAccount = await prisma.account.upsert({
        where: { slug: 'generic-org' },
        update: {},
        create: {
            name: 'Generic Org',
            slug: 'generic-org',
            isSystem: false,
        }
    });

    const genericUserPassword = await hash('password123');
    const genericUser = await prisma.user.upsert({
        where: { email: 'user@example.com' },
        update: {},
        create: {
            email: 'user@example.com',
            password: genericUserPassword,
            name: 'Generic User',
            systemRole: 'USER',
            primaryAccountId: genericAccount.id,
        }
    });

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: genericUser.id, accountId: genericAccount.id } },
        update: {},
        create: {
            userId: genericUser.id,
            accountId: genericAccount.id,
            role: 'OWNER'
        }
    });
    console.log(`✅ User 'user@example.com' ready (Owner of Generic Org)`);

    console.log('✨ Users and Accounts seeded successfully');
}

seedUsers()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
