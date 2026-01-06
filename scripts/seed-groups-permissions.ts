import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define modules and their available actions
const MODULES = {
    DASHBOARD: ['VIEW'],
    USERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    DEVICES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    DEVICE_TAGS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    DEVICE_PROFILES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    RESOURCES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    BUNDLES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    PRECLAIMS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    PIN_RULES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    CONTROLLERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    RADAR: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
    ANALYTICS: ['VIEW'],
    ACCOUNT_SETTINGS: ['VIEW', 'EDIT'],
    GROUPS: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
} as const;

// Default groups configuration
type GroupPermissions = {
    all?: boolean;
} & Partial<Record<keyof typeof MODULES, string[]>>;

const DEFAULT_GROUPS: Array<{
    name: string;
    description: string;
    permissions: GroupPermissions;
}> = [
    {
        name: 'Administrators',
        description: 'Full access to all features and settings',
        permissions: {
            // All permissions enabled
            all: true
        }
    },
    {
        name: 'Managers',
        description: 'Can manage users, devices, and most features except system settings',
        permissions: {
            DASHBOARD: ['VIEW'],
            USERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            DEVICES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            DEVICE_TAGS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            DEVICE_PROFILES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            RESOURCES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            BUNDLES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            PRECLAIMS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            PIN_RULES: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            CONTROLLERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            RADAR: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
            ANALYTICS: ['VIEW'],
            ACCOUNT_SETTINGS: ['VIEW', 'EDIT'],
            GROUPS: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
        }
    },
    {
        name: 'Operators',
        description: 'Can view and operate devices and controllers',
        permissions: {
            DASHBOARD: ['VIEW'],
            DEVICES: ['VIEW', 'EDIT'],
            DEVICE_TAGS: ['VIEW'],
            DEVICE_PROFILES: ['VIEW'],
            RESOURCES: ['VIEW'],
            BUNDLES: ['VIEW'],
            PRECLAIMS: ['VIEW'],
            PIN_RULES: ['VIEW'],
            CONTROLLERS: ['VIEW', 'EDIT'],
            RADAR: ['VIEW', 'EDIT'],
            ANALYTICS: ['VIEW']
        }
    },
    {
        name: 'Viewers',
        description: 'Read-only access to view data and reports',
        permissions: {
            DASHBOARD: ['VIEW'],
            DEVICES: ['VIEW'],
            DEVICE_TAGS: ['VIEW'],
            DEVICE_PROFILES: ['VIEW'],
            RESOURCES: ['VIEW'],
            BUNDLES: ['VIEW'],
            PRECLAIMS: ['VIEW'],
            PIN_RULES: ['VIEW'],
            CONTROLLERS: ['VIEW'],
            RADAR: ['VIEW'],
            ANALYTICS: ['VIEW']
        }
    }
];

async function createGroup(accountId: string, groupConfig: { name: string; description: string; permissions: GroupPermissions }) {
    // Check if group already exists
    const existingGroup = await prisma.group.findUnique({
        where: {
            accountId_name: {
                accountId,
                name: groupConfig.name
            }
        }
    });

    if (existingGroup) {
        console.log(`  ⚠️  Group '${groupConfig.name}' already exists, updating...`);
    }

    const group = await prisma.group.upsert({
        where: {
            accountId_name: {
                accountId,
                name: groupConfig.name
            }
        },
        update: {
            description: groupConfig.description
        },
        create: {
            name: groupConfig.name,
            description: groupConfig.description,
            accountId
        }
    });

    // Delete existing permissions for this group
    await prisma.permission.deleteMany({
        where: { groupId: group.id }
    });

    // Create permissions
    if (groupConfig.permissions.all === true) {
        // Create all permissions for all modules
        for (const [module, actions] of Object.entries(MODULES)) {
            for (const action of actions) {
                await prisma.permission.create({
                    data: {
                        groupId: group.id,
                        module,
                        action,
                        allowed: true
                    }
                });
            }
        }
    } else {
        // Create permissions based on configuration
        for (const [module, actions] of Object.entries(groupConfig.permissions)) {
            // Skip 'all' property
            if (module === 'all') continue;
            
            // Check if this module exists in MODULES
            if (module in MODULES && Array.isArray(actions)) {
                for (const action of actions) {
                    // Verify action is valid for this module
                    const moduleActions = MODULES[module as keyof typeof MODULES];
                    if (moduleActions.includes(action as any)) {
                        await prisma.permission.create({
                            data: {
                                groupId: group.id,
                                module,
                                action,
                                allowed: true
                            }
                        });
                    }
                }
            }
        }
    }

    return group;
}

async function assignUsersToGroups(accountId: string) {
    // Get account memberships
    const memberships = await prisma.accountMembership.findMany({
        where: { accountId },
        include: { user: true }
    });

    // Get groups for this account
    const groups = await prisma.group.findMany({
        where: { accountId }
    });

    const adminGroup = groups.find(g => g.name === 'Administrators');
    const managerGroup = groups.find(g => g.name === 'Managers');
    const operatorGroup = groups.find(g => g.name === 'Operators');
    const viewerGroup = groups.find(g => g.name === 'Viewers');

    for (const membership of memberships) {
        let targetGroup: typeof groups[0] | undefined;

        // Assign group based on account role
        switch (membership.role) {
            case 'OWNER':
                targetGroup = adminGroup;
                break;
            case 'ADMIN':
                targetGroup = managerGroup || adminGroup;
                break;
            case 'MEMBER':
                // Default members to viewers, but can be customized
                targetGroup = viewerGroup;
                break;
        }

        if (targetGroup) {
            // Check if group membership already exists
            const existingGroupMembership = await prisma.groupMembership.findUnique({
                where: {
                    groupId_membershipId: {
                        groupId: targetGroup.id,
                        membershipId: membership.id
                    }
                }
            });

            if (!existingGroupMembership) {
                await prisma.groupMembership.create({
                    data: {
                        groupId: targetGroup.id,
                        membershipId: membership.id
                    }
                });
                console.log(`    ✅ Assigned ${membership.user.email} (${membership.role}) to ${targetGroup.name}`);
            }
        }
    }
}

async function seedGroupsAndPermissions() {
    console.log('🌱 Seeding groups and permissions...\n');

    try {
        // Get all non-system accounts
        const accounts = await prisma.account.findMany({
            where: {
                isSystem: false,
                status: 'ACTIVE'
            }
        });

        if (accounts.length === 0) {
            console.log('⚠️  No accounts found. Please run seed-users.ts first.');
            return;
        }

        console.log(`📦 Processing ${accounts.length} account(s)...\n`);

        for (const account of accounts) {
            console.log(`📋 Account: ${account.name} (${account.slug})`);

            // Create default groups
            console.log(`  👥 Creating default groups...`);
            for (const groupConfig of DEFAULT_GROUPS) {
                const group = await createGroup(account.id, groupConfig);
                console.log(`    ✅ Group '${group.name}' created with permissions`);
            }

            // Assign users to groups based on their account roles
            console.log(`  🔗 Assigning users to groups...`);
            await assignUsersToGroups(account.id);

            console.log('');
        }

        console.log('✨ Groups and permissions seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding groups and permissions:', error);
        throw error;
    }
}

seedGroupsAndPermissions()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

