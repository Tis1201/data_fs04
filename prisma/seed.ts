import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'crypto';
import { SYSTEM_ACCOUNT } from '../src/lib/constants/system';

const prisma = new PrismaClient();

// Generate a secure random API key
function generateApiKey(length = 32): string {
    return randomBytes(length).toString('hex');
}

// Validate password strength (relaxed for seed data)
function validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long' };
    }
    // For seed data, we allow simpler passwords
    // In production, you should enforce stronger requirements
    return { valid: true };
}

interface AdminUserConfig {
    email: string;
    password: string;
    name?: string;
    systemRole?: 'ADMIN' | 'SUPER_ADMIN';
    createApiKey?: boolean;
}

// Default admin users to create
const defaultAdminUsers: AdminUserConfig[] = [
    {
        email: 'admin@admin.com',
        password: 'admin0823', // Simple password for development/testing
        name: 'System Administrator',
        systemRole: 'ADMIN',
        createApiKey: true
    },
    {
        email: 'superadmin@admin.com',
        password: 'SuperAdmin123!',
        name: 'Super Administrator',
        systemRole: 'SUPER_ADMIN',
        createApiKey: true
    }
];

async function initAdminUser(systemAccount: { id: string }, config: AdminUserConfig) {
    try {
        // Validate password
        const passwordValidation = validatePassword(config.password);
        if (!passwordValidation.valid) {
            throw new Error(`Invalid password for ${config.email}: ${passwordValidation.error}`);
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: config.email }
        });

        if (existingUser) {
            console.log(`⚠️  Admin user ${config.email} already exists, skipping creation`);
            return existingUser;
        }

        // Create admin user
        const hashedPassword = await hash(config.password);

        const admin = await prisma.user.create({
            data: {
                email: config.email,
                password: hashedPassword,
                name: config.name || 'Administrator',
                systemRole: config.systemRole || 'ADMIN',
                rolesString: config.systemRole === 'SUPER_ADMIN' ? 'super_admin,admin' : 'admin',
                primaryAccountId: systemAccount.id,
                status: 'ACTIVE'
            }
        });

        console.log(`✅ Created admin user: ${admin.email} (${config.systemRole})`);

        // Create account membership
        await prisma.accountMembership.upsert({
            where: { userId_accountId: { accountId: systemAccount.id, userId: admin.id } },
            update: {
                role: 'SYSTEM'
            },
            create: {
                accountId: systemAccount.id,
                userId: admin.id,
                role: 'SYSTEM'
            }
        });

        // Create API key if requested
        if (config.createApiKey) {
            const apiKey = generateApiKey();
            const apiKeyId = `admin-api-key-${admin.id}`;
            
            const adminApiKey = await prisma.apiKey.upsert({
                where: { id: apiKeyId },
                update: {
                    key: apiKey,
                    name: `${config.name || 'Admin'} Default API Key`,
                    active: true
                },
                create: {
                    id: apiKeyId,
                    key: apiKey,
                    name: `${config.name || 'Admin'} Default API Key`,
                    description: `Default API key for ${config.email}`,
                    active: true,
                    userId: admin.id,
                    accountId: systemAccount.id
                }
            });

            console.log(`  📝 API Key created: ${adminApiKey.name}`);
            console.log(`  🔑 Key: ${apiKey}`);
            console.log(`  ⚠️  Store this API key securely as it will not be displayed again!`);
        }

        return admin;
    } catch (error) {
        console.error(`❌ Error creating admin user ${config.email}:`, error);
        throw error;
    }
}

async function initSystemAccount() {
    try {
        const account = await prisma.account.upsert({
            where: { slug: SYSTEM_ACCOUNT },
            update: {
                name: SYSTEM_ACCOUNT,
                isSystem: true,
                status: 'ACTIVE'
            },
            create: { 
                name: SYSTEM_ACCOUNT, 
                slug: SYSTEM_ACCOUNT, 
                isSystem: true,
                status: 'ACTIVE'
            }
        });

        console.log(`✅ System account ready: ${account.id}`);
        return account;
    } catch (error) {
        console.error('❌ Error creating system account:', error);
        throw error;
    }
}

async function main() {
    console.log('🌱 Starting system account and admin user seed...\n');

    try {
        // Initialize system account
        const systemAccount = await initSystemAccount();

        // Create admin users
        console.log('\n📝 Creating admin users...');
        for (const adminConfig of defaultAdminUsers) {
            await initAdminUser(systemAccount, adminConfig);
            console.log(''); // Empty line for readability
        }

        console.log('✨ System account and admin users seeded successfully!');
    } catch (error) {
        console.error('\n❌ Seed failed:', error);
        throw error;
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
