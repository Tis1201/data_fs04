import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPinRules() {
  console.log('🌱 Seeding pin rules...');

  try {
    // Check if admin default rules already exist
    const existingAdminRules = await prisma.pinRule.findMany({
      where: { ruleType: 'admin_default' }
    });

    if (existingAdminRules.length > 0) {
      console.log('✅ Admin default rules already exist, skipping seed');
      return;
    }

    // Find an existing admin user or create a system user
    let systemUserId: string;
    
    // First, try to find an existing admin user
    const adminUser = await prisma.user.findFirst({
      where: { systemRole: 'ADMIN' }
    });

    if (adminUser) {
      systemUserId = adminUser.id;
      console.log(`✅ Using existing admin user: ${adminUser.name} (${adminUser.email})`);
    } else {
      // Create a system user if no admin exists
      const systemUser = await prisma.user.create({
        data: {
          id: 'system-admin',
          name: 'System Administrator',
          email: 'system@admin.local',
          systemRole: 'ADMIN',
          isEmailVerified: true
        }
      });
      systemUserId = systemUser.id;
      console.log('✅ Created system admin user');
    }

    // Create default admin rules
    const defaultAdminRules = [
      {
        ruleType: 'admin_default',
        createdBy: systemUserId,
        accountId: null,
        name: 'System Management Apps',
        description: 'Core system management applications required for device administration',
        apps: ['com.android.settings', 'com.android.systemui'],
        targetType: 'all',
        targetValue: [],
        priority: 1,
        isActive: true
      }
    ];

    // Create the admin default rules
    for (const rule of defaultAdminRules) {
      await prisma.pinRule.create({
        data: rule
      });
      console.log(`✅ Created admin default rule: ${rule.name}`);
    }

    console.log('🎉 Pin rules seeded successfully!');
    console.log('📋 Created admin default rules:');
    console.log('   • System Management Apps (Settings, System UI)');

  } catch (error) {
    console.error('❌ Error seeding pin rules:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPinRules()
    .then(() => {
      console.log('✅ Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

export { seedPinRules };
