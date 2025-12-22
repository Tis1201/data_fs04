import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions } from 'mqtt';
import { getAdminPrisma } from '$lib/server/prisma';
import { randomBytes } from 'crypto';

/**
 * End-to-end test for the controller MQTT mint flow.
 *
 * Flow:
 * 1. Create a test device and radar controller in the database
 * 2. Use the device's apiKey to call /api/device/controller/mqtt/mint
 * 3. Assert that the endpoint returns scoped controller credentials
 * 4. Use the minted credentials to connect to the MQTT broker
 * 5. Verify we can subscribe/publish to controller-scoped topics
 * 6. Clean up test data
 */

describe('Controller MQTT mint E2E', () => {
    const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
    const CONTROLLER_MINT_URL = `${WEB_BASE_URL}/api/device/controller/mqtt/mint`;

    const MQTT_DEFAULT_WS_PATH = '/mqtt';

    let brokerUrl: string;
    let token: string;
    let clientId: string;
    let username: string;
    let deviceId: string;
    let controllerId: string;
    let accountId: string;
    let userId: string;
    let testApiKey: string;

    beforeAll(async () => {
        const prisma = getAdminPrisma();

        // Find an existing account and user to use for the test
        const existingAccount = await prisma.account.findFirst({
            include: {
                members: {
                    take: 1
                }
            }
        });

        if (!existingAccount || existingAccount.members.length === 0) {
            throw new Error('No account with members found. Create an account before running this test.');
        }

        accountId = existingAccount.id;
        userId = existingAccount.members[0].userId;

        // Create a test device with a unique apiKey
        testApiKey = `test-controller-mint-${randomBytes(8).toString('hex')}`;
        const testDevice = await prisma.device.create({
            data: {
                name: `Test Device for Controller Mint ${Date.now()}`,
                apiKey: testApiKey,
                user: {
                    connect: { id: userId }
                },
                account: {
                    connect: { id: accountId }
                },
                status: 'ACTIVE'
            }
        });

        deviceId = testDevice.id;

        // Create a test radar controller for this device
        const testController = await prisma.controller.create({
            data: {
                name: `Test Radar Controller ${Date.now()}`,
                type: 'radar',
                serialNumber: `RADAR-TEST-${randomBytes(6).toString('hex').toUpperCase()}`,
                status: 'ACTIVE',
                device: {
                    connect: { id: deviceId }
                },
                account: {
                    connect: { id: accountId }
                },
                creator: {
                    connect: { id: userId }
                },
                description: 'E2E test radar controller'
            }
        });

        controllerId = testController.id;

        // Call the controller mint endpoint
        const res = await fetch(CONTROLLER_MINT_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                type: 'radar',
                controllerId: controllerId
            })
        });

        expect(res.status).toBe(200);
        const payload: any = await res.json();

        expect(payload?.success).toBe(true);
        const data = payload?.data ?? {};

        brokerUrl = data.brokerUrl as string;
        token = data.jwt as string;
        clientId = data.clientId as string;
        username = (data.username as string) ?? '';

        const mqttUsername = data.mqttUsername as string | undefined;

        expect(typeof brokerUrl).toBe('string');
        expect(brokerUrl.length).toBeGreaterThan(0);
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
        expect(typeof clientId).toBe('string');
        expect(clientId.length).toBeGreaterThan(0);

        // Controller identity should be device:<deviceId>
        if (mqttUsername) {
            expect(mqttUsername.startsWith('device:')).toBe(true);
        }
    }, 30000);

    afterAll(async () => {
        // Clean up test data
        const prisma = getAdminPrisma();

        // Delete controller (cascade will handle sensors)
        if (controllerId) {
            await prisma.controller.deleteMany({
                where: { id: controllerId }
            });
        }

        // Delete test device
        if (deviceId) {
            await prisma.device.deleteMany({
                where: { id: deviceId }
            });
        }
    }, 10000);

    it('logs minted controller MQTT credentials', () => {
        // eslint-disable-next-line no-console
        console.log('Controller MQTT mint E2E credentials', {
            brokerUrl,
            clientId,
            username,
            jwt: token,
            deviceId,
            controllerId
        });

        expect(typeof brokerUrl).toBe('string');
        expect(brokerUrl.length).toBeGreaterThan(0);
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
        expect(typeof clientId).toBe('string');
        expect(clientId.length).toBeGreaterThan(0);
    });

    it('rejects request without controllerId', async () => {
        const res = await fetch(CONTROLLER_MINT_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                type: 'radar'
                // Missing controllerId - should be rejected
            })
        });

        expect(res.status).toBe(400);
        const payload: any = await res.json();
        expect(payload?.success).toBe(false);
        const errorMsg = payload?.error?.message || payload?.message || '';
        expect(errorMsg).toContain('controllerId');
    });

    it('returns controllerId in response even when explicitly provided', async () => {
        const res = await fetch(CONTROLLER_MINT_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                type: 'radar',
                controllerId: controllerId
            })
        });

        expect(res.status).toBe(200);
        const payload: any = await res.json();
        expect(payload?.success).toBe(true);
        expect(payload?.data?.controllerId).toBe(controllerId);
    });

    it('rejects request for non-existent controller', async () => {
        const res = await fetch(CONTROLLER_MINT_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': testApiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                type: 'radar',
                controllerId: 'non-existent-controller-id'
            })
        });

        expect(res.status).toBe(404);
        const payload: any = await res.json();
        expect(payload?.success).toBe(false);
        // Error is nested in error.message
        const errorMsg = payload?.error?.message || payload?.message || '';
        expect(errorMsg).toContain('not found');
    });

    function buildControllerTopics() {
        const effectiveId = username || clientId;
        const topicPrefix = `${effectiveId}/controller/radar:${controllerId}`;

        return {
            effectiveId,
            requestsTopic: `${topicPrefix}/requests`,
            repliesTopic: `${topicPrefix}/replies`,
            responseTopic: `${topicPrefix}/response`,
            notificationsTopic: `${topicPrefix}/notifications`,
            loopbackTopic: `${topicPrefix}/loopback`,
            dataTopic: `${topicPrefix}/data`
        };
    }

    function buildConnectUrl() {
        const url = new URL(brokerUrl);
        if (!url.pathname || url.pathname === '/') {
            url.pathname = MQTT_DEFAULT_WS_PATH;
        }
        return url.toString();
    }

    it('subscribes to controller sub topics', async () => {
        const { responseTopic, notificationsTopic, loopbackTopic } = buildControllerTopics();
        const connectUrl = buildConnectUrl();

        const options: IClientOptions = {
            protocolVersion: 5,
            clean: true,
            clientId,
            username: username || clientId,
            password: token,
            reconnectPeriod: 0
        };

        await new Promise<void>((resolve, reject) => {
            const client = mqtt.connect(connectUrl, options);

            const timeout = setTimeout(() => {
                client.end(true, () => {
                    reject(new Error('Timed out subscribing to controller MQTT topics'));
                });
            }, 15000);

            client.on('connect', () => {
                client.subscribe([responseTopic, notificationsTopic, loopbackTopic], { qos: 1 }, (err) => {
                    if (err) {
                        clearTimeout(timeout);
                        client.end(true, () => reject(err));
                        return;
                    }

                    clearTimeout(timeout);
                    client.end(true, () => resolve());
                });
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                client.end(true, () => reject(err));
            });
        });
    }, 20000);

    it('publishes to controller pub topics', async () => {
        const { requestsTopic, repliesTopic, dataTopic, loopbackTopic } = buildControllerTopics();
        const connectUrl = buildConnectUrl();

        const options: IClientOptions = {
            protocolVersion: 5,
            clean: true,
            clientId,
            username: username || clientId,
            password: token,
            reconnectPeriod: 0
        };

        await new Promise<void>((resolve, reject) => {
            const client = mqtt.connect(connectUrl, options);

            let remaining = 4;

            const done = () => {
                remaining -= 1;
                if (remaining === 0) {
                    clearTimeout(timeout);
                    client.end(true, () => resolve());
                }
            };

            const fail = (err: unknown) => {
                clearTimeout(timeout);
                client.end(true, () => reject(err instanceof Error ? err : new Error(String(err))));
            };

            const timeout = setTimeout(() => {
                fail(new Error('Timed out publishing to controller MQTT topics'));
            }, 15000);

            client.on('connect', () => {
                client.publish(requestsTopic, JSON.stringify({ test: 'requests' }), { qos: 1 }, (err) => {
                    if (err) {
                        fail(err);
                        return;
                    }
                    done();
                });

                client.publish(repliesTopic, JSON.stringify({ test: 'replies' }), { qos: 1 }, (err) => {
                    if (err) {
                        fail(err);
                        return;
                    }
                    done();
                });

                client.publish(dataTopic, JSON.stringify({ test: 'data' }), { qos: 1 }, (err) => {
                    if (err) {
                        fail(err);
                        return;
                    }
                    done();
                });

                client.publish(loopbackTopic, JSON.stringify({ test: 'loopback-publish' }), { qos: 1 }, (err) => {
                    if (err) {
                        fail(err);
                        return;
                    }
                    done();
                });
            });

            client.on('error', (err) => {
                fail(err);
            });
        });
    }, 20000);

    it('performs loopback roundtrip on controller loopback topic', async () => {
        const { loopbackTopic } = buildControllerTopics();
        const connectUrl = buildConnectUrl();

        const options: IClientOptions = {
            protocolVersion: 5,
            clean: true,
            clientId,
            username: username || clientId,
            password: token,
            reconnectPeriod: 0
        };

        await new Promise<void>((resolve, reject) => {
            const client = mqtt.connect(connectUrl, options);

            let doneFlag = false;

            const fail = (err: unknown) => {
                if (doneFlag) return;
                doneFlag = true;
                client.end(true, () => reject(err instanceof Error ? err : new Error(String(err))));
            };

            const timeout = setTimeout(() => {
                fail(new Error('Timed out waiting for controller loopback message'));
            }, 20000);

            client.on('connect', () => {
                client.subscribe(loopbackTopic, { qos: 1 }, (err) => {
                    if (err) {
                        fail(err);
                        return;
                    }

                    const loopPayload = { test: 'loopback', ts: Date.now(), controller: controllerId };
                    client.publish(loopbackTopic, JSON.stringify(loopPayload), { qos: 1 }, (err) => {
                        if (err) {
                            fail(err);
                        }
                    });
                });
            });

            client.on('message', (topic, payload) => {
                if (doneFlag) return;

                if (topic === loopbackTopic) {
                    try {
                        const text = payload.toString();
                        const parsed = JSON.parse(text) as { test?: string; controller?: string };
                        if (parsed.test === 'loopback' && parsed.controller === controllerId) {
                            doneFlag = true;
                            clearTimeout(timeout);
                            client.end(true, () => resolve());
                        }
                    } catch {
                        // Ignore malformed loopback payloads
                    }
                }
            });

            client.on('error', (err) => {
                fail(err);
            });
        });
    }, 25000);

    it('cannot subscribe to device root topics (scoped ACL)', async () => {
        const connectUrl = buildConnectUrl();
        const deviceRootTopic = `device/device:${deviceId}/notifications`;

        const options: IClientOptions = {
            protocolVersion: 5,
            clean: true,
            clientId,
            username: username || clientId,
            password: token,
            reconnectPeriod: 0
        };

        await new Promise<void>((resolve, reject) => {
            const client = mqtt.connect(connectUrl, options);

            const timeout = setTimeout(() => {
                client.end(true, () => {
                    reject(new Error('Timed out testing ACL restriction'));
                });
            }, 15000);

            client.on('connect', () => {
                // Try to subscribe to device root topic - should fail due to ACL
                client.subscribe(deviceRootTopic, { qos: 1 }, (err, granted) => {
                    clearTimeout(timeout);

                    // EMQX should either return an error or grant with failure code
                    if (err) {
                        // Expected: subscription failed
                        client.end(true, () => resolve());
                        return;
                    }

                    // Check if granted with failure code (qos 128 = failure)
                    if (granted && granted.length > 0 && granted[0].qos === 128) {
                        // Expected: subscription denied
                        client.end(true, () => resolve());
                        return;
                    }

                    // Unexpected: subscription succeeded
                    client.end(true, () =>
                        reject(
                            new Error('Controller was able to subscribe to device root topic - ACL not working correctly')
                        )
                    );
                });
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                // Connection errors are acceptable for ACL tests
                client.end(true, () => resolve());
            });
        });
    }, 20000);
});
