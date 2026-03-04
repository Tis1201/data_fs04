import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions } from 'mqtt';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * End-to-end test for the device MQTT mint flow.
 *
 * Flow:
 * 1. Use an existing claimed device's apiKey (via Prisma) to call
 *    /api/device/mqtt/mint on fs04_web.
 * 2. Assert that the endpoint returns brokerUrl, clientId, username, jwt and
 *    legacy mqttUsername starting with `device:`.
 * 3. Use the minted credentials to connect to the MQTT broker over WebSocket.
 * 4. Verify we can subscribe to the device topics and publish to the pub topics.
 */

describe('Device MQTT mint E2E', () => {
  const WEB_BASE_URL =
    process.env.E2E_BASE_URL_LOCAL ?? process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const DEVICE_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint`;

  const MQTT_DEFAULT_WS_PATH = '/mqtt';

  let brokerUrl: string;
  let token: string;
  let clientId: string;
  let username: string;
  let deviceId: string;

  beforeAll(async () => {
    const prisma = getAdminPrisma();

    const device = await prisma.device.findFirst({
      where: {
        apiKey: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!device?.apiKey) {
      throw new Error(
        'No device with apiKey found. Run the device claim E2E or create a claimed device before running this test.'
      );
    }

    deviceId = device.id;

    const res = await fetch(DEVICE_MINT_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': device.apiKey,
        Accept: 'application/json'
      }
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

    // Device identity should be device:<deviceId>
    if (mqttUsername) {
      expect(mqttUsername.startsWith('device:')).toBe(true);
    }
  }, 20000);

  it('logs minted device MQTT credentials', () => {
    // eslint-disable-next-line no-console
    console.log('Device MQTT mint E2E credentials', {
      brokerUrl,
      clientId,
      username,
      jwt: token,
      deviceId
    });

    expect(typeof brokerUrl).toBe('string');
    expect(brokerUrl.length).toBeGreaterThan(0);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(0);
  });

  function buildTopics() {
    const effectiveId = username || clientId;
    return {
      effectiveId,
      requestsTopic: `device/${effectiveId}/requests`,
      repliesTopic: `device/${effectiveId}/replies`,
      responseTopic: `device/${effectiveId}/response`,
      notificationsTopic: `device/${effectiveId}/notifications`,
      loopbackTopic: `device/${effectiveId}/loopback`
    };
  }

  function buildConnectUrl() {
    const url = new URL(brokerUrl);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = MQTT_DEFAULT_WS_PATH;
    }
    return url.toString();
  }

  it('subscribes to device sub topics', async () => {
    const { responseTopic, notificationsTopic, loopbackTopic } = buildTopics();
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
          reject(new Error('Timed out subscribing to device MQTT topics'));
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

  it('publishes to device pub topics', async () => {
    const { requestsTopic, loopbackTopic } = buildTopics();
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

      let remaining = 2;

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
        fail(new Error('Timed out publishing to device MQTT topics'));
      }, 15000);

      client.on('connect', () => {
        client.publish(requestsTopic, JSON.stringify({ test: 'requests' }), { qos: 1 }, (err) => {
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

  it('performs loopback roundtrip on loopback topic', async () => {
    const { loopbackTopic } = buildTopics();
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
        fail(new Error('Timed out waiting for device loopback message'));
      }, 20000);

      client.on('connect', () => {
        client.subscribe(loopbackTopic, { qos: 1 }, (err) => {
          if (err) {
            fail(err);
            return;
          }

          const loopPayload = { test: 'loopback', ts: Date.now() };
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
            const parsed = JSON.parse(text) as { test?: string };
            if (parsed.test === 'loopback') {
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
});
