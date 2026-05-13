import { config as loadEnv } from 'dotenv';
import { beforeAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions } from 'mqtt';
import { getAdminPrisma } from '$lib/server/prisma';

loadEnv({ path: `${process.cwd()}/.env` });

/**
 * End-to-end test for the factory MQTT mint flow.
 *
 * Flow:
 * 1. Use a factory JWT (SAMPLE_DEVICE_FACTORY_TOKEN) to call
 *    /api/device/mqtt/mint/factory on fs04_web.
 * 2. Assert that the endpoint returns brokerUrl, clientId, username and jwt.
 * 3. Use the minted credentials to connect to the MQTT broker over WebSocket.
 */

describe('Factory MQTT mint E2E', () => {
  const WEB_BASE_URL = "http://localhost:5173";
  const FACTORY_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint/factory`;

  const MQTT_DEFAULT_WS_PATH = '/mqtt';

  let brokerUrl: string;
  let token: string;
  let clientId: string;
  let username: string;

  beforeAll(async () => {
    // Try to get a factory token from the database first
    let factoryJwt: string | null = null;
    
    try {
      const prisma = getAdminPrisma();
      const factoryToken = await prisma.factoryToken.findFirst({
        where: {
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          issuedAt: 'desc'
        }
      });

      console.log('[Factory MQTT mint E2E] Found factory token from DB:', factoryToken?.token);
      
      if (factoryToken) {
        factoryJwt = factoryToken.token;
        console.log('[Factory MQTT mint E2E] Using factory token from DB');
      }
    } catch (error) {
      console.log('[Factory MQTT mint E2E] Could not access factory tokens from DB:', error instanceof Error ? error.message : String(error));
    }
    
    
    if (!factoryJwt) {
      console.warn('[Factory MQTT mint E2E] No factory JWT available from DB, skipping test');
      return;
    }

    const res = await fetch(FACTORY_MINT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${factoryJwt}`,
        Accept: 'application/json'
      }
    });

    if (res.status !== 200) {
      const text = await res.text();
      console.error('[Factory MQTT mint E2E] Factory mint failed:', {
        status: res.status,
        body: text,
        url: FACTORY_MINT_URL,
        tokenUsed: factoryJwt?.substring(0, 50) + '...'
      });
      throw new Error(
        `Factory mint failed: status=${res.status}, body=${text.slice(0, 500)}`
      );
    }

    const payload: any = await res.json();

    expect(payload?.success).toBe(true);
    const data = payload?.data ?? {};

    brokerUrl = data.brokerUrl as string;
    token = data.jwt as string;
    clientId = data.clientId as string;
    username = (data.username as string) ?? '';

    expect(typeof brokerUrl).toBe('string');
    expect(brokerUrl.length).toBeGreaterThan(0);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(0);
  }, 20000);

  it('logs minted factory MQTT credentials', () => {
    // Skip if no credentials were minted
    if (!brokerUrl) {
      console.warn('Skipping test - no factory JWT available');
      return;
    }

    // Log the minted credentials for manual inspection during integration testing
    // eslint-disable-next-line no-console
    console.log('Factory MQTT mint E2E credentials', {
      brokerUrl,
      clientId,
      username,
      jwt: token
    });

    // Basic assertions to ensure values were populated by the mint endpoint
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

  it('subscribes to factory sub topics', async () => {
    // Skip if no credentials were minted
    if (!brokerUrl) {
      console.warn('Skipping test - no factory JWT available');
      return;
    }
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
          reject(new Error('Timed out subscribing to factory MQTT topics'));
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

  it('publishes to factory pub topics', async () => {
    // Skip if no credentials were minted
    if (!brokerUrl) {
      console.warn('Skipping test - no factory JWT available');
      return;
    }
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
        fail(new Error('Timed out publishing to factory MQTT topics'));
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
    // Skip if no credentials were minted
    if (!brokerUrl) {
      console.warn('Skipping test - no factory JWT available');
      return;
    }
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

      let done = false;

      const fail = (err: unknown) => {
        if (done) return;
        done = true;
        client.end(true, () => reject(err instanceof Error ? err : new Error(String(err))));
      };

      const timeout = setTimeout(() => {
        fail(new Error('Timed out waiting for loopback message'));
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
        if (done) return;

        if (topic === loopbackTopic) {
          try {
            const text = payload.toString();
            const parsed = JSON.parse(text) as { test?: string };
            if (parsed.test === 'loopback') {
              done = true;
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
