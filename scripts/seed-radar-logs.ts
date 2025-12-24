import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { randomUUID } from 'crypto';

/**
 * Seed script for generating realistic radar log data.
 *
 * This script:
 * 1. Fetches a real account + sensor from Prisma
 * 2. Generates 24 hours of session + path data
 * 3. Inserts into ClickHouse logs_raw (flows through MVs)
 *
 * Usage:
 *   npm run seed:radar-logs
 *   npm run seed:radar-logs -- --hours 48
 *   npm run seed:radar-logs -- --clean
 */

const prisma = new PrismaClient();

interface SeedOptions {
    hours: number;
    clean: boolean;
    accountId?: string;
}

function parseArgs(): SeedOptions {
    const args = process.argv.slice(2);
    const options: SeedOptions = {
        hours: 24,
        clean: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--hours' && args[i + 1]) {
            options.hours = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--clean') {
            options.clean = true;
        } else if (args[i] === '--account' && args[i + 1]) {
            options.accountId = args[i + 1];
            i++;
        }
    }

    return options;
}

async function getClickHouseClient(): Promise<ClickHouseClient> {
    const url = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
    const username = process.env.CLICKHOUSE_USER_NAME || 'admin';
    const password = process.env.CLICKHOUSE_PASSWORD || 'admin0823';

    return createClient({
        url,
        username,
        password,
        database: 'fs_04'
    });
}

function formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

// Generate realistic session patterns (fewer at night, more during business hours)
function generateSessionsForHour(hour: number): number {
    if (hour >= 0 && hour < 6) return Math.floor(Math.random() * 2); // 0-1 sessions at night
    if (hour >= 6 && hour < 9) return Math.floor(Math.random() * 5) + 2; // 2-6 sessions morning rush
    if (hour >= 9 && hour < 12) return Math.floor(Math.random() * 8) + 5; // 5-12 sessions mid-morning
    if (hour >= 12 && hour < 14) return Math.floor(Math.random() * 10) + 8; // 8-17 sessions lunch
    if (hour >= 14 && hour < 18) return Math.floor(Math.random() * 6) + 3; // 3-8 sessions afternoon
    if (hour >= 18 && hour < 21) return Math.floor(Math.random() * 8) + 5; // 5-12 sessions evening
    return Math.floor(Math.random() * 3) + 1; // 1-3 sessions late evening
}

// Generate a realistic walking path
function generatePath(startX: number, startY: number, sessionDurationSec: number): Array<{ x: number; y: number; offsetMs: number }> {
    const points: Array<{ x: number; y: number; offsetMs: number }> = [];
    const samplesPerSecond = 10; // 10Hz
    const totalSamples = Math.floor(sessionDurationSec * samplesPerSecond);

    let x = startX;
    let y = startY;

    for (let i = 0; i < totalSamples; i++) {
        // Random walk with some momentum
        x += (Math.random() - 0.5) * 0.3;
        y += (Math.random() - 0.5) * 0.3;

        // Keep within bounds (0-10 meters)
        x = Math.max(0, Math.min(10, x));
        y = Math.max(0, Math.min(10, y));

        points.push({
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            offsetMs: i * (1000 / samplesPerSecond)
        });
    }

    return points;
}

async function seedRadarLogs(options: SeedOptions) {
    console.log('🌱 Seeding radar logs...');
    console.log(`   Hours: ${options.hours}`);
    console.log(`   Clean: ${options.clean}`);

    const client = await getClickHouseClient();

    try {
        // Find a real account with a sensor
        const account = options.accountId
            ? await prisma.account.findUnique({ where: { id: options.accountId } })
            : await prisma.account.findFirst({
                include: {
                    devices: {
                        include: {
                            controllers: {
                                where: { type: 'radar' },
                                include: { sensors: true }
                            }
                        }
                    }
                }
            });

        if (!account) {
            console.error('❌ No account found. Please create an account first.');
            return;
        }

        console.log(`✅ Using account: ${account.name} (${account.id})`);

        // Find a radar sensor
        let sensorId = 'seed-radar-001';
        let sensorName = 'Seeded Radar Sensor';
        let deviceId = 'seed-device-001';
        let macAddress = '00:11:22:33:44:55';

        const accountWithDevices = account as typeof account & {
            devices?: Array<{
                id: string;
                controllers?: Array<{
                    sensors?: Array<{ id: string; name: string }>;
                }>;
            }>;
        };

        if (accountWithDevices.devices?.[0]) {
            deviceId = accountWithDevices.devices[0].id;
            const sensor = accountWithDevices.devices[0].controllers?.[0]?.sensors?.[0];
            if (sensor) {
                sensorId = sensor.id;
                sensorName = sensor.name;
            }
        }

        console.log(`   Device ID: ${deviceId}`);
        console.log(`   Sensor ID: ${sensorId}`);

        // Clean existing seed data if requested
        if (options.clean) {
            console.log('🧹 Cleaning existing seed data...');
            await client.command({
                query: `ALTER TABLE logs_raw DELETE WHERE c2 = '${account.id}' AND c10 IN ('SENSOR_RADAR_SESSION', 'SENSOR_RADAR_PATH')`
            });
            console.log('✅ Cleaned existing seed data');
        }

        // Generate data for each hour
        const now = new Date();
        const startTime = new Date(now.getTime() - options.hours * 60 * 60 * 1000);

        let totalSessions = 0;
        let totalPathPoints = 0;

        console.log(`📊 Generating data from ${startTime.toISOString()} to ${now.toISOString()}`);

        for (let hourOffset = 0; hourOffset < options.hours; hourOffset++) {
            const hourStart = new Date(startTime.getTime() + hourOffset * 60 * 60 * 1000);
            const hour = hourStart.getUTCHours();
            const sessionsThisHour = generateSessionsForHour(hour);

            for (let s = 0; s < sessionsThisHour; s++) {
                // Random time within the hour
                const sessionStartOffset = Math.random() * 60 * 60 * 1000;
                const sessionStart = new Date(hourStart.getTime() + sessionStartOffset);

                // Session duration: 2-30 seconds
                const sessionDurationSec = 2 + Math.random() * 28;
                const targetId = randomUUID();

                // Insert session log
                const sessionTimestamp = formatTimestamp(sessionStart);
                await client.insert({
                    table: 'logs_raw',
                    values: [{
                        c1: sessionTimestamp,
                        c2: account.id,
                        c3: 'seed-user',
                        c4: deviceId,
                        c5: 'Seed Device',
                        c10: 'SENSOR_RADAR_SESSION',
                        c11: '1.0',
                        c12: sessionTimestamp,
                        c13: '480',
                        c14: 'Asia/Singapore',
                        c15: sensorId,
                        c16: sensorName,
                        c17: macAddress,
                        c18: targetId,
                        c19: String(Math.round(sessionDurationSec * 10) / 10),
                        c20: '{}',
                        c21: String(Math.round(Math.random() * 3 * 100) / 100)
                    }],
                    format: 'JSONEachRow'
                });
                totalSessions++;

                // Generate and insert path points
                const startX = 2 + Math.random() * 6;
                const startY = 2 + Math.random() * 6;
                const pathPoints = generatePath(startX, startY, sessionDurationSec);

                // Batch insert path points (insert every 100 points)
                const batchSize = 100;
                for (let i = 0; i < pathPoints.length; i += batchSize) {
                    const batch = pathPoints.slice(i, i + batchSize);
                    const pathRows = batch.map(point => {
                        const pointTime = new Date(sessionStart.getTime() + point.offsetMs);
                        const pointTimestamp = formatTimestamp(pointTime);
                        return {
                            c1: pointTimestamp,
                            c2: account.id,
                            c3: 'seed-user',
                            c4: deviceId,
                            c5: 'Seed Device',
                            c10: 'SENSOR_RADAR_PATH',
                            c11: '1.0',
                            c12: pointTimestamp,
                            c13: '480',
                            c14: 'Asia/Singapore',
                            c15: sensorId,
                            c16: sensorName,
                            c17: macAddress,
                            c18: targetId,
                            c19: String(point.x),
                            c20: String(point.y)
                        };
                    });

                    await client.insert({
                        table: 'logs_raw',
                        values: pathRows,
                        format: 'JSONEachRow'
                    });
                    totalPathPoints += batch.length;
                }
            }

            // Progress update every 6 hours
            if ((hourOffset + 1) % 6 === 0) {
                console.log(`   Progress: ${Math.round((hourOffset + 1) / options.hours * 100)}%`);
            }
        }

        console.log('');
        console.log('🎉 Seed completed!');
        console.log(`   Sessions: ${totalSessions}`);
        console.log(`   Path points: ${totalPathPoints}`);
        console.log('');
        console.log('📊 Verify with:');
        console.log(`   SELECT count() FROM fs_04.mv_radar_session WHERE account_id = '${account.id}';`);
        console.log(`   SELECT count() FROM fs_04.mv_radar_path WHERE account_id = '${account.id}';`);

    } catch (error) {
        console.error('❌ Error seeding radar logs:', error);
        throw error;
    } finally {
        await client.close();
        await prisma.$disconnect();
    }
}

// Run the seed function
if (import.meta.url === `file://${process.argv[1]}`) {
    const options = parseArgs();
    seedRadarLogs(options)
        .then(() => {
            console.log('✅ Seed completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seed failed:', error);
            process.exit(1);
        });
}

export { seedRadarLogs };
