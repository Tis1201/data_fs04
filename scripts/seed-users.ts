import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { SYSTEM_ACCOUNT } from '../src/lib/constants/system';

const prisma = new PrismaClient();

interface UserConfig {
    email: string;
    password: string;
    name: string;
    systemRole?: 'ADMIN' | 'USER';
    accountRole: 'OWNER' | 'ADMIN' | 'MEMBER';
    accountSlug: string;
    accountName: string;
    primaryAccount?: boolean;
}

// Define accounts and their users
const accountConfigs = [
    {
        account: {
            slug: 'blue-com',
            name: 'Blue.com',
            description: 'Blue.com organization account'
        },
        users: [
            {
                email: 'owner@blue.com',
                password: 'Password123!',
                name: 'Blue Owner',
                systemRole: 'USER' as const,
                accountRole: 'OWNER' as const,
                primaryAccount: true
            },
            {
                email: 'admin@blue.com',
                password: 'Password123!',
                name: 'Blue Admin',
                systemRole: 'USER' as const,
                accountRole: 'ADMIN' as const,
                primaryAccount: false
            },
            {
                email: 'member@blue.com',
                password: 'Password123!',
                name: 'Blue Member',
                systemRole: 'USER' as const,
                accountRole: 'MEMBER' as const,
                primaryAccount: false
            }
        ]
    },
    {
        account: {
            slug: 'generic-org',
            name: 'Generic Org',
            description: 'Generic organization for testing'
        },
        users: [
            {
                email: 'user@example.com',
                password: 'Password123!',
                name: 'Generic User',
                systemRole: 'USER' as const,
                accountRole: 'OWNER' as const,
                primaryAccount: true
            }
        ]
    },
    {
        account: {
            slug: 'acme-corp',
            name: 'ACME Corporation',
            description: 'ACME Corporation account with multiple users'
        },
        users: [
            {
                email: 'ceo@acme.com',
                password: 'Password123!',
                name: 'ACME CEO',
                systemRole: 'USER' as const,
                accountRole: 'OWNER' as const,
                primaryAccount: true
            },
            {
                email: 'manager@acme.com',
                password: 'Password123!',
                name: 'ACME Manager',
                systemRole: 'USER' as const,
                accountRole: 'ADMIN' as const,
                primaryAccount: false
            },
            {
                email: 'employee1@acme.com',
                password: 'Password123!',
                name: 'ACME Employee 1',
                systemRole: 'USER' as const,
                accountRole: 'MEMBER' as const,
                primaryAccount: false
            },
            {
                email: 'employee2@acme.com',
                password: 'Password123!',
                name: 'ACME Employee 2',
                systemRole: 'USER' as const,
                accountRole: 'MEMBER' as const,
                primaryAccount: false
            }
        ]
    },
    {
        account: {
            slug: 'test-company',
            name: 'Test Company',
            description: 'Test company for development'
        },
        users: [
            {
                email: 'test@test.com',
                password: 'Password123!',
                name: 'Test User',
                systemRole: 'USER' as const,
                accountRole: 'OWNER' as const,
                primaryAccount: true
            }
        ]
    }
];

async function createAccount(accountData: { slug: string; name: string; description?: string }) {
    return await prisma.account.upsert({
        where: { slug: accountData.slug },
        update: {
            name: accountData.name,
            description: accountData.description,
            status: 'ACTIVE'
        },
        create: {
            name: accountData.name,
            slug: accountData.slug,
            description: accountData.description,
            isSystem: false,
            status: 'ACTIVE'
        }
    });
}

async function createUser(userConfig: UserConfig, accountId: string) {
    const hashedPassword = await hash(userConfig.password);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: userConfig.email }
    });

    if (existingUser) {
        console.log(`  ⚠️  User ${userConfig.email} already exists, updating...`);
    }

    const user = await prisma.user.upsert({
        where: { email: userConfig.email },
        update: {
            name: userConfig.name,
            password: hashedPassword,
            systemRole: userConfig.systemRole || 'USER',
            status: 'ACTIVE',
            primaryAccountId: userConfig.primaryAccount ? accountId : undefined
        },
        create: {
            email: userConfig.email,
            password: hashedPassword,
            name: userConfig.name,
            systemRole: userConfig.systemRole || 'USER',
            primaryAccountId: userConfig.primaryAccount ? accountId : undefined,
            status: 'ACTIVE'
        }
    });

    // Create or update account membership
    await prisma.accountMembership.upsert({
        where: { userId_accountId: { userId: user.id, accountId } },
        update: {
            role: userConfig.accountRole
        },
        create: {
            userId: user.id,
            accountId,
            role: userConfig.accountRole
        }
    });

    return user;
}

async function seedUsers() {
    console.log('🌱 Seeding users and accounts...\n');

    try {
        let totalAccounts = 0;
        let totalUsers = 0;

        for (const config of accountConfigs) {
            console.log(`📦 Creating account: ${config.account.name} (${config.account.slug})`);
            
            // Create account
            const account = await createAccount(config.account);
            totalAccounts++;
            console.log(`  ✅ Account created: ${account.id}`);

            // Create users for this account
            console.log(`  👥 Creating ${config.users.length} user(s)...`);
            for (const userConfig of config.users) {
                const user = await createUser(userConfig, account.id);
                totalUsers++;
                console.log(`    ✅ ${user.email} (${userConfig.accountRole})`);
            }
            console.log('');
        }

        console.log(`✨ Seeding completed!`);
        console.log(`   📊 Total accounts: ${totalAccounts}`);
        console.log(`   👤 Total users: ${totalUsers}`);
    } catch (error) {
        console.error('❌ Error seeding users:', error);
        throw error;
    }
}

seedUsers()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

