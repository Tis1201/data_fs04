import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ClearOptions {
    keepJwtKeys?: boolean;
    keepFactoryTokens?: boolean;
    keepSystemAccount?: boolean;
    dryRun?: boolean;
}

/**
 * Clear database with safety checks
 * 
 * WARNING: This will delete all data except what you choose to keep!
 * 
 * Options:
 * - keepJwtKeys: Keep JWT signing keys (FACTORY, RUNTIME, INVITATION)
 * - keepFactoryTokens: Keep factory tokens (may be in use by devices)
 * - keepSystemAccount: Keep system account and admin users
 * - dryRun: Show what would be deleted without actually deleting
 */
async function clearDatabase(options: ClearOptions = {}) {
    const {
        keepJwtKeys = false,
        keepFactoryTokens = false,
        keepSystemAccount = false,
        dryRun = false
    } = options;

    if (dryRun) {
        console.log('⚠️  DRY RUN MODE - No data will be deleted\n');
    } else {
        console.log('⚠️  WARNING: This will DELETE data from the database!');
        console.log('⚠️  Make sure you have backups if needed!\n');
    }

    try {
        // Get counts before deletion
        const counts = {
            accounts: await prisma.account.count(),
            users: await prisma.user.count(),
            devices: await prisma.device.count(),
            controllers: await prisma.controller.count(),
            sensors: await prisma.sensor.count(),
            jwtKeys: await prisma.jwtSigningKey.count(),
            factoryTokens: await prisma.factoryToken.count(),
            licenses: await prisma.license.count(),
            groups: await prisma.group.count(),
            permissions: await prisma.permission.count()
        };

        console.log('📊 Current database counts:');
        console.log(`   Accounts: ${counts.accounts}`);
        console.log(`   Users: ${counts.users}`);
        console.log(`   Devices: ${counts.devices}`);
        console.log(`   Controllers: ${counts.controllers}`);
        console.log(`   Sensors: ${counts.sensors}`);
        console.log(`   JWT Signing Keys: ${counts.jwtKeys}`);
        console.log(`   Factory Tokens: ${counts.factoryTokens}`);
        console.log(`   Licenses: ${counts.licenses}`);
        console.log(`   Groups: ${counts.groups}`);
        console.log(`   Permissions: ${counts.permissions}`);
        console.log('');

        if (dryRun) {
            console.log('🔍 DRY RUN - Would delete:');
            console.log('   ✅ All accounts' + (keepSystemAccount ? ' (except SYSTEM_ACCOUNT)' : ''));
            console.log('   ✅ All users' + (keepSystemAccount ? ' (except system admins)' : ''));
            console.log('   ✅ All devices, controllers, sensors');
            console.log('   ✅ All groups and permissions');
            console.log('   ✅ All licenses');
            if (!keepJwtKeys) console.log('   ✅ All JWT signing keys');
            else console.log('   ⏭️  JWT signing keys (KEPT)');
            if (!keepFactoryTokens) console.log('   ✅ All factory tokens');
            else console.log('   ⏭️  Factory tokens (KEPT)');
            console.log('\n💡 Run without --dry-run to actually delete');
            return;
        }

        // Start transaction for safety
        await prisma.$transaction(async (tx) => {
            console.log('🗑️  Starting database cleanup...\n');

            // 1. Delete dependent data first (due to foreign key constraints)
            
            // Delete audit logs
            const auditLogs = await tx.auditLog.deleteMany({});
            console.log(`   ✅ Deleted ${auditLogs.count} audit logs`);

            // Delete token usage logs
            const tokenLogs = await tx.tokenUsageLog.deleteMany({});
            console.log(`   ✅ Deleted ${tokenLogs.count} token usage logs`);

            // Delete refresh tokens
            const refreshTokens = await tx.refreshToken.deleteMany({});
            console.log(`   ✅ Deleted ${refreshTokens.count} refresh tokens`);

            // Delete device action logs
            const actionLogs = await tx.deviceActionLog.deleteMany({});
            console.log(`   ✅ Deleted ${actionLogs.count} device action logs`);

            // Delete bundle-related data
            const bundleProgress = await tx.bundleDeviceProgress.deleteMany({});
            console.log(`   ✅ Deleted ${bundleProgress.count} bundle device progress records`);

            const bundleDevices = await tx.bundleDevice.deleteMany({});
            console.log(`   ✅ Deleted ${bundleDevices.count} bundle devices`);

            const bundleWaves = await tx.bundleWave.deleteMany({});
            console.log(`   ✅ Deleted ${bundleWaves.count} bundle waves`);

            const bundleApps = await tx.bundleApp.deleteMany({});
            console.log(`   ✅ Deleted ${bundleApps.count} bundle apps`);

            const bundles = await tx.bundle.deleteMany({});
            console.log(`   ✅ Deleted ${bundles.count} bundles`);

            // Delete bundle install sessions
            const installSessions = await tx.bundleInstallSession.deleteMany({});
            console.log(`   ✅ Deleted ${installSessions.count} bundle install sessions`);

            // Delete sensors
            const sensors = await tx.sensor.deleteMany({});
            console.log(`   ✅ Deleted ${sensors.count} sensors`);

            // Delete controllers
            const controllers = await tx.controller.deleteMany({});
            console.log(`   ✅ Deleted ${controllers.count} controllers`);

            // Delete device profile assignments and overrides
            const profileOverrides = await tx.deviceProfileOverrideSetting.deleteMany({});
            console.log(`   ✅ Deleted ${profileOverrides.count} profile override settings`);

            const profileOverridesMain = await tx.deviceProfileOverride.deleteMany({});
            console.log(`   ✅ Deleted ${profileOverridesMain.count} profile overrides`);

            const profileAssignments = await tx.deviceProfileAssignment.deleteMany({});
            console.log(`   ✅ Deleted ${profileAssignments.count} profile assignments`);

            const profileSettings = await tx.deviceProfileSetting.deleteMany({});
            console.log(`   ✅ Deleted ${profileSettings.count} profile settings`);

            const profiles = await tx.deviceProfile.deleteMany({});
            console.log(`   ✅ Deleted ${profiles.count} device profiles`);

            // Delete preclaim devices
            const preclaimDevices = await tx.preclaimDevice.deleteMany({});
            console.log(`   ✅ Deleted ${preclaimDevices.count} preclaim devices`);

            const preclaimSets = await tx.preclaimSet.deleteMany({});
            console.log(`   ✅ Deleted ${preclaimSets.count} preclaim sets`);

            // Delete device tags (many-to-many will be handled automatically)
            const deviceTags = await tx.deviceTag.deleteMany({});
            console.log(`   ✅ Deleted ${deviceTags.count} device tags`);

            // Delete devices
            const devices = await tx.device.deleteMany({});
            console.log(`   ✅ Deleted ${devices.count} devices`);

            // Delete factory devices
            const factoryDevices = await tx.factoryDevice.deleteMany({});
            console.log(`   ✅ Deleted ${factoryDevices.count} factory devices`);

            // Delete licenses (if not keeping JWT keys, as they reference keys)
            if (!keepJwtKeys) {
                const licenseRenewals = await tx.licenseRenewal.deleteMany({});
                console.log(`   ✅ Deleted ${licenseRenewals.count} license renewals`);

                const entitlements = await tx.entitlement.deleteMany({});
                console.log(`   ✅ Deleted ${entitlements.count} entitlements`);

                const licenses = await tx.license.deleteMany({});
                console.log(`   ✅ Deleted ${licenses.count} licenses`);
            } else {
                console.log(`   ⏭️  Licenses (KEPT - related to JWT keys)`);
            }

            // Delete factory tokens (if not keeping)
            if (!keepFactoryTokens) {
                const factoryTokens = await tx.factoryToken.deleteMany({});
                console.log(`   ✅ Deleted ${factoryTokens.count} factory tokens`);
            } else {
                console.log(`   ⏭️  Factory tokens (KEPT)`);
            }

            // Delete JWT signing keys (if not keeping)
            if (!keepJwtKeys) {
                const jwtKeys = await tx.jwtSigningKey.deleteMany({});
                console.log(`   ✅ Deleted ${jwtKeys.count} JWT signing keys`);
            } else {
                console.log(`   ⏭️  JWT signing keys (KEPT)`);
            }

            // Delete permissions and groups
            const permissions = await tx.permission.deleteMany({});
            console.log(`   ✅ Deleted ${permissions.count} permissions`);

            const groupMemberships = await tx.groupMembership.deleteMany({});
            console.log(`   ✅ Deleted ${groupMemberships.count} group memberships`);

            const groups = await tx.group.deleteMany({});
            console.log(`   ✅ Deleted ${groups.count} groups`);

            // Delete account memberships
            const accountMemberships = await tx.accountMembership.deleteMany({});
            console.log(`   ✅ Deleted ${accountMemberships.count} account memberships`);

            // Delete account assignments
            const accountAssignments = await tx.accountAssignment.deleteMany({});
            console.log(`   ✅ Deleted ${accountAssignments.count} account assignments`);

            // Delete companies
            const companies = await tx.company.deleteMany({});
            console.log(`   ✅ Deleted ${companies.count} companies`);

            // Delete resources
            const resources = await tx.resource.deleteMany({});
            console.log(`   ✅ Deleted ${resources.count} resources`);

            // Delete API keys
            const apiKeys = await tx.apiKey.deleteMany({});
            console.log(`   ✅ Deleted ${apiKeys.count} API keys`);

            // Delete subscriptions (before accounts and plans)
            // Note: Subscription has foreign key to Account, so delete before accounts
            try {
                const subscriptions = await tx.subscription.deleteMany({});
                console.log(`   ✅ Deleted ${subscriptions.count} subscriptions`);
            } catch (error: any) {
                if (error.message?.includes('subscription') || error.message?.includes('undefined')) {
                    console.log(`   ⚠️  Subscription model not available, skipping...`);
                } else {
                    console.log(`   ⚠️  Could not delete subscriptions: ${error.message}`);
                }
            }

            // Delete cron jobs
            try {
                const cronJobExecutions = await tx.cronJobExecution.deleteMany({});
                console.log(`   ✅ Deleted ${cronJobExecutions.count} cron job executions`);

                const cronJobs = await tx.cronJob.deleteMany({});
                console.log(`   ✅ Deleted ${cronJobs.count} cron jobs`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete cron jobs: ${error.message}`);
            }

            // Delete pin rules
            const userAppActions = await tx.userAppAction.deleteMany({});
            console.log(`   ✅ Deleted ${userAppActions.count} user app actions`);

            const pinRules = await tx.pinRule.deleteMany({});
            console.log(`   ✅ Deleted ${pinRules.count} pin rules`);

            // Delete other related data
            const listenerWebhooks = await tx.listenerWebhookEndpoint.deleteMany({});
            console.log(`   ✅ Deleted ${listenerWebhooks.count} listener webhook endpoints`);

            const listenerWhatsApp = await tx.listenerWhatsAppAccount.deleteMany({});
            console.log(`   ✅ Deleted ${listenerWhatsApp.count} listener WhatsApp accounts`);

            const listeners = await tx.listenerEndpoint.deleteMany({});
            console.log(`   ✅ Deleted ${listeners.count} listener endpoints`);

            try {
                const webhookMetrics = await tx.webhookHourlyMetric.deleteMany({});
                console.log(`   ✅ Deleted ${webhookMetrics.count} webhook hourly metrics`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete webhook metrics: ${error.message}`);
            }

            try {
                const webhooks = await tx.webhookEndPoint.deleteMany({});
                console.log(`   ✅ Deleted ${webhooks.count} webhook endpoints`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete webhook endpoints: ${error.message}`);
            }

            // Delete WhatsApp accounts (correct naming: whatsAppAccount)
            try {
                const whatsappAccounts = await tx.whatsAppAccount.deleteMany({});
                console.log(`   ✅ Deleted ${whatsappAccounts.count} WhatsApp accounts`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete WhatsApp accounts: ${error.message}`);
            }

            // Delete WhatsApp auth data (correct naming: whatsAppAuthData)
            try {
                const whatsappAuth = await tx.whatsAppAuthData.deleteMany({});
                console.log(`   ✅ Deleted ${whatsappAuth.count} WhatsApp auth data`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete WhatsApp auth data: ${error.message}`);
            }

            const invitationTokens = await tx.invitationToken.deleteMany({});
            console.log(`   ✅ Deleted ${invitationTokens.count} invitation tokens`);

            const sessions = await tx.session.deleteMany({});
            console.log(`   ✅ Deleted ${sessions.count} sessions`);

            const keys = await tx.key.deleteMany({});
            console.log(`   ✅ Deleted ${keys.count} keys`);

            // Delete users (except system admins if keeping system account)
            if (keepSystemAccount) {
                const systemAccount = await tx.account.findFirst({
                    where: { slug: 'SYSTEM_ACCOUNT' }
                });
                if (systemAccount) {
                    const systemMembers = await tx.accountMembership.findMany({
                        where: { accountId: systemAccount.id },
                        select: { userId: true }
                    });
                    const systemUserIds = systemMembers.map(m => m.userId);
                    const deletedUsers = await tx.user.deleteMany({
                        where: {
                            id: { notIn: systemUserIds }
                        }
                    });
                    console.log(`   ✅ Deleted ${deletedUsers.count} users (kept ${systemUserIds.length} system users)`);
                }
            } else {
                const users = await tx.user.deleteMany({});
                console.log(`   ✅ Deleted ${users.count} users`);
            }

            // Delete accounts (except system account if keeping)
            if (keepSystemAccount) {
                const deletedAccounts = await tx.account.deleteMany({
                    where: { slug: { not: 'SYSTEM_ACCOUNT' } }
                });
                console.log(`   ✅ Deleted ${deletedAccounts.count} accounts (kept SYSTEM_ACCOUNT)`);
            } else {
                const accounts = await tx.account.deleteMany({});
                console.log(`   ✅ Deleted ${accounts.count} accounts`);
            }

            // Delete other tables
            try {
                const failedLogins = await tx.failedLoginLog.deleteMany({});
                console.log(`   ✅ Deleted ${failedLogins.count} failed login logs`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete failed login logs: ${error.message}`);
            }

            try {
                const userSessionLogs = await tx.userSessionLog.deleteMany({});
                console.log(`   ✅ Deleted ${userSessionLogs.count} user session logs`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete user session logs: ${error.message}`);
            }

            try {
                const deviceAppSummaries = await tx.deviceAppSummary.deleteMany({});
                console.log(`   ✅ Deleted ${deviceAppSummaries.count} device app summaries`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete device app summaries: ${error.message}`);
            }

            // Delete plans (after subscriptions)
            try {
                const plans = await tx.plan.deleteMany({});
                console.log(`   ✅ Deleted ${plans.count} plans`);
            } catch (error: any) {
                console.log(`   ⚠️  Could not delete plans: ${error.message}`);
            }

            // Skip webhook events and MQTT connections if tables don't exist
            // These are checked outside transaction to avoid abort
        }, {
            timeout: 60000, // 60 second timeout
            isolationLevel: 'ReadCommitted'
        });

        // Delete optional tables outside transaction to avoid abort
        try {
            const webhookEvents = await prisma.webhookEvent.deleteMany({});
            console.log(`   ✅ Deleted ${webhookEvents.count} webhook events`);
        } catch (error: any) {
            const errorMsg = error.message || '';
            if (errorMsg.includes('does not exist')) {
                console.log(`   ⏭️  Webhook events table not found, skipping...`);
            } else {
                console.log(`   ⚠️  Could not delete webhook events: ${errorMsg}`);
            }
        }

        try {
            const mqttConnections = await prisma.mqttConnection.deleteMany({});
            console.log(`   ✅ Deleted ${mqttConnections.count} MQTT connections`);
        } catch (error: any) {
            const errorMsg = error.message || '';
            if (errorMsg.includes('does not exist')) {
                console.log(`   ⏭️  MQTT connections table not found, skipping...`);
            } else {
                console.log(`   ⚠️  Could not delete MQTT connections: ${errorMsg}`);
            }
        }

        console.log('\n✨ Database cleared successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Run: tsx scripts/seed-all.ts');
        console.log('   2. Or run individual seed scripts as needed');
        
        if (keepJwtKeys) {
            console.log('\n⚠️  Note: JWT signing keys were kept. Make sure they are still valid for your use case.');
        }
        if (keepFactoryTokens) {
            console.log('\n⚠️  Note: Factory tokens were kept. They may reference deleted devices.');
        }
    } catch (error) {
        console.error('\n❌ Error clearing database:', error);
        throw error;
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/clear-db.ts [options]

⚠️  WARNING: This will DELETE data from your database!

Options:
  --keep-jwt-keys       Keep JWT signing keys (FACTORY, RUNTIME, INVITATION)
  --keep-factory-tokens Keep factory tokens (may reference deleted devices)
  --keep-system-account  Keep SYSTEM_ACCOUNT and admin users
  --dry-run             Show what would be deleted without actually deleting
  --help, -h            Show this help message

Examples:
  # Full clear (delete everything)
  tsx scripts/clear-db.ts

  # Keep JWT keys and system account
  tsx scripts/clear-db.ts --keep-jwt-keys --keep-system-account

  # Dry run to see what would be deleted
  tsx scripts/clear-db.ts --dry-run

Safety:
  - Always backup your database before running this script
  - Use --dry-run first to see what will be deleted
  - JWT keys are critical for token verification - only delete if you're sure
  - Factory tokens may be in use by devices - keep them if devices are active
`);
    process.exit(0);
}

const options: ClearOptions = {
    keepJwtKeys: args.includes('--keep-jwt-keys'),
    keepFactoryTokens: args.includes('--keep-factory-tokens'),
    keepSystemAccount: args.includes('--keep-system-account'),
    dryRun: args.includes('--dry-run')
};

// Safety check for non-dry-run
if (!options.dryRun) {
    console.log('⚠️  ⚠️  ⚠️  WARNING ⚠️  ⚠️  ⚠️');
    console.log('This will DELETE data from your database!');
    console.log('Make sure you have backups if needed!\n');
    
    // Give user a moment to cancel
    await new Promise(resolve => setTimeout(resolve, 2000));
}

clearDatabase(options)
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

