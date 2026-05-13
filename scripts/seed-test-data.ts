import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Generate random hardware ID
function generateHardwareId(): string {
    return `HW-${randomBytes(8).toString('hex').toUpperCase()}`;
}

// Generate random MAC address
function generateMacAddress(): string {
    const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

// Generate random serial number
function generateSerialNumber(prefix: string): string {
    return `${prefix}-${randomBytes(6).toString('hex').toUpperCase()}`;
}

async function seedTestData() {
    console.log('🌱 Seeding test data (devices, controllers, sensors)...\n');

    try {
        // Get all non-system accounts
        const accounts = await prisma.account.findMany({
            where: {
                isSystem: false,
                status: 'ACTIVE'
            },
            include: {
                members: {
                    include: {
                        user: true
                    },
                    where: {
                        role: 'OWNER'
                    },
                    take: 1
                }
            }
        });

        if (accounts.length === 0) {
            console.log('⚠️  No accounts found. Please run seed-users.ts first.');
            return;
        }

        let totalDevices = 0;
        let totalControllers = 0;
        let totalSensors = 0;

        for (const account of accounts) {
            console.log(`📦 Account: ${account.name} (${account.slug})`);

            const owner = account.members[0]?.user;
            if (!owner) {
                console.log(`  ⚠️  No owner found, skipping...`);
                continue;
            }

            // Create companies for this account
            const companies = [];
            for (let i = 1; i <= 2; i++) {
                const company = await prisma.company.upsert({
                    where: {
                        id: `company-${account.slug}-${i}`
                    },
                    update: {},
                    create: {
                        id: `company-${account.slug}-${i}`,
                        name: `${account.name} Company ${i}`,
                        status: 'ACTIVE',
                        accountId: account.id,
                        description: `Test company ${i} for ${account.name}`
                    }
                });
                companies.push(company);
            }
            console.log(`  ✅ Created ${companies.length} companies`);

            // Create device tags
            const deviceTags = [];
            const tagNames = ['Production', 'Testing', 'Development', 'Staging'];
            for (const tagName of tagNames) {
                const tag = await prisma.deviceTag.upsert({
                    where: {
                        id: `tag-${account.slug}-${tagName.toLowerCase()}`
                    },
                    update: {},
                    create: {
                        id: `tag-${account.slug}-${tagName.toLowerCase()}`,
                        name: tagName,
                        description: `${tagName} environment tag`,
                        accountId: account.id
                    }
                });
                deviceTags.push(tag);
            }
            console.log(`  ✅ Created ${deviceTags.length} device tags`);

            // Create devices (3-5 per account)
            const deviceCount = Math.floor(Math.random() * 3) + 3;
            const devices = [];

            for (let i = 1; i <= deviceCount; i++) {
                const hardwareId = generateHardwareId();
                const macAddress = generateMacAddress();
                const device = await prisma.device.create({
                    data: {
                        name: `${account.name} Device ${i}`,
                        description: `Test device ${i} for ${account.name}`,
                        status: i % 3 === 0 ? 'INACTIVE' : 'ACTIVE',
                        hardwareId,
                        macAddress,
                        wifiMac: generateMacAddress(),
                        lanMac: generateMacAddress(),
                        ipAddress: `192.168.1.${100 + i}`,
                        deviceType: 'Android',
                        model: 'Test Model',
                        manufacturer: 'Test Manufacturer',
                        osVersion: '13.0',
                        firmwareVersion: '1.0.0',
                        accountId: account.id,
                        companyId: companies[i % companies.length].id,
                        createdBy: owner.id,
                        connected: i % 2 === 0,
                        connectedAt: i % 2 === 0 ? new Date() : null,
                        claimedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date in last 30 days
                    }
                });

                // Assign random tags to device (many-to-many relationship)
                const selectedTags = deviceTags.slice(0, Math.floor(Math.random() * deviceTags.length) + 1);
                if (selectedTags.length > 0) {
                    await prisma.device.update({
                        where: { id: device.id },
                        data: {
                            tags: {
                                connect: selectedTags.map(tag => ({ id: tag.id }))
                            }
                        }
                    });
                }

                devices.push(device);
                totalDevices++;
            }
            console.log(`  ✅ Created ${devices.length} devices`);

            // Create controllers (radar controllers for some devices)
            const controllers = [];
            for (let i = 0; i < Math.min(devices.length, 3); i++) {
                const device = devices[i];
                const serialNumber = generateSerialNumber('RADAR');
                
                const controller = await prisma.controller.create({
                    data: {
                        name: `Radar Controller ${i + 1}`,
                        type: 'radar',
                        serialNumber,
                        status: device.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
                        deviceId: device.id,
                        accountId: account.id,
                        createdBy: owner.id,
                        description: `Radar controller for ${device.name}`
                    }
                });
                controllers.push(controller);
                totalControllers++;

                // Create sensors for this controller
                const sensorCount = Math.floor(Math.random() * 2) + 1; // 1-2 sensors per controller
                for (let j = 1; j <= sensorCount; j++) {
                    const sensorSerial = generateSerialNumber('SENSOR');
                    await prisma.sensor.create({
                        data: {
                            name: `Sensor ${j} - ${controller.name}`,
                            type: 'radar',
                            serialNumber: sensorSerial,
                            status: controller.status,
                            controllerId: controller.id,
                            accountId: account.id,
                            createdBy: owner.id,
                            description: `Radar sensor ${j} for ${controller.name}`,
                            location: `Location ${j}`,
                            firmware: '1.0.0',
                            config: {
                                range: 100,
                                sensitivity: 0.8,
                                mode: 'standard'
                            },
                            configVersion: 1,
                            syncStatus: 'SYNCED',
                            lastSyncedAt: new Date()
                        }
                    });
                    totalSensors++;
                }
            }
            console.log(`  ✅ Created ${controllers.length} controllers with ${totalSensors} sensors`);

            // Create a device profile
            const profile = await prisma.deviceProfile.create({
                data: {
                    name: `${account.name} Default Profile`,
                    description: `Default device profile for ${account.name}`,
                    isActive: true,
                    level: 'GLOBAL',
                    accountId: account.id,
                    createdBy: owner.id,
                    settings: {
                        create: [
                            {
                                key: 'wifi_enabled',
                                value: 'true',
                                dataType: 'boolean',
                                label: 'WiFi Enabled',
                                category: 'Network',
                                order: 1
                            },
                            {
                                key: 'bluetooth_enabled',
                                value: 'true',
                                dataType: 'boolean',
                                label: 'Bluetooth Enabled',
                                category: 'Network',
                                order: 2
                            },
                            {
                                key: 'screen_timeout',
                                value: '300',
                                dataType: 'number',
                                label: 'Screen Timeout (seconds)',
                                category: 'Display',
                                order: 3
                            }
                        ]
                    }
                }
            });
            console.log(`  ✅ Created device profile: ${profile.name}`);

            // Assign profile to some devices
            const devicesToAssign = devices.slice(0, Math.floor(devices.length / 2));
            for (const device of devicesToAssign) {
                await prisma.deviceProfileAssignment.upsert({
                    where: { deviceId: device.id },
                    update: {},
                    create: {
                        profileId: profile.id,
                        deviceId: device.id,
                        assignedBy: owner.id,
                        status: 'ACTIVE',
                        appliedAt: new Date()
                    }
                });
            }
            console.log(`  ✅ Assigned profile to ${devicesToAssign.length} devices`);

            console.log('');
        }

        console.log('✨ Test data seeded successfully!');
        console.log(`   📊 Total devices: ${totalDevices}`);
        console.log(`   🎮 Total controllers: ${totalControllers}`);
        console.log(`   📡 Total sensors: ${totalSensors}`);
    } catch (error) {
        console.error('❌ Error seeding test data:', error);
        throw error;
    }
}

seedTestData()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

