import prisma from "$lib/server/prisma";
import { hash } from "@node-rs/argon2";
import { logger } from "$lib/server/logger";
import { SYSTEM_ACCOUNT } from "$lib/constants/system";

export async function ensureDefaultAdmin() {
    try {
        const email = 'admin@admin.com';
        const hashedPassword = await hash('public');

        // 1. Ensure System Account exists
        const systemAccount = await prisma.account.upsert({
            where: { slug: SYSTEM_ACCOUNT },
            update: {},
            create: {
                name: SYSTEM_ACCOUNT,
                slug: SYSTEM_ACCOUNT,
                isSystem: true,
                status: 'ACTIVE'
            }
        });

        // 2. Ensure Admin User exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (!existingUser) {
            logger.info('Creating default admin user...');
            const admin = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: 'System Administrator',
                    systemRole: 'ADMIN',
                    rolesString: 'admin',
                    primaryAccountId: systemAccount.id,
                    status: 'ACTIVE'
                }
            });

            // 3. Add to System Account
            await prisma.accountMembership.create({
                data: {
                    accountId: systemAccount.id,
                    userId: admin.id,
                    role: 'SYSTEM'
                }
            });

            logger.info('✅ Default admin user created successfully');
        } else {
            logger.info('ℹ️ Default admin user already exists');
        }

    } catch (error) {
        logger.error('❌ Failed to ensure default admin user', { error });
    }
}
