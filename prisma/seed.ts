import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { SYSTEM_ACCOUNT } from '../src/lib/constants/system';

const prisma = new PrismaClient();

// Generate a secure random API key
function generateApiKey(length = 32): string {
    return randomBytes(length).toString('hex');
}

async function initAdminUser(systemAccount) {
// Create admin user
    const hashedPassword = await hash('admin0823'); // You should change this password

    const admin = await prisma.user.upsert({
        where: { email: 'admin@admin.com' },
        update: {},
        create: {
            email: 'admin@admin.com',
            password: hashedPassword,
            systemRole: 'ADMIN',
            rolesString: 'admin',
            primaryAccountId: systemAccount.id,
        },
    });

    console.log('Created admin user:', admin.email);

    await prisma.accountMembership.upsert({
        where: { userId_accountId: { accountId: systemAccount.id, userId: admin.id } },
        update: {},
        create: {
            accountId: systemAccount.id,
            userId: admin.id,
            role: 'SYSTEM'
        }
    })

    // Create API key for the admin user
    const apiKey = generateApiKey();
    
    const adminApiKey = await prisma.apiKey.upsert({
        where: { 
            id: 'admin-api-key-1' // Using a fixed ID for upsert
        },
        update: {
            key: apiKey,
            lastUsedAt: new Date()
        },
        create: {
            id: 'admin-api-key-1',
            key: apiKey,
            name: 'Admin Default API Key',
            description: 'Default API key for WebSocket testing',
            active: true,
            userId: admin.id
        }
    });

    console.log('Created API key for admin:');
    console.log(`Name: ${adminApiKey.name}`);
    console.log(`Key: ${apiKey}`);
    console.log('⚠️  Store this API key securely as it will not be displayed again!');
}

async function initSystemAccount() {
    const account = await prisma.account.upsert({
        where: { name: SYSTEM_ACCOUNT, slug: SYSTEM_ACCOUNT },
        update: {},
        create: { name: SYSTEM_ACCOUNT, slug: SYSTEM_ACCOUNT, isSystem: true }
    });

    console.log('Created system account:', account.id);

    return account;
}

async function main() {
    const systemAccount = await initSystemAccount();
    await initAdminUser(systemAccount);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
