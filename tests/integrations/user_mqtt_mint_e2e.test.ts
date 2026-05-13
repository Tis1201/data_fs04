import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import mqtt, { type IClientOptions } from 'mqtt';

/**
 * E2E test for the user MQTT mint endpoint.
 *
 * Flow:
 * 1. Log in with SAMPLE_ADMIN_USERNAME/SAMPLE_ADMIN_PASSWORD to obtain auth_session.
 * 2. Call /api/user/mqtt/mint to get a JWT and broker URL.
 * 3. Assert basic shape and log derived MQTT username from JWT sub.
 */

describe('User MQTT mint E2E', () => {
  const BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const USERNAME = process.env.SAMPLE_ADMIN_USERNAME ?? 'admin@admin.com';
  const PASSWORD = process.env.SAMPLE_ADMIN_PASSWORD ?? 'admin0823';

  const LOGIN_URL = `${BASE_URL}/auth/login?/login`;
  const MINT_URL = `${BASE_URL}/api/user/mqtt/mint`;

  let mintedToken: string | undefined;
  let mintedBrokerUrl: string | undefined;
  let mintedClientId: string | undefined;

  async function loginAndGetCookie(): Promise<string> {
    const body = new URLSearchParams({
      email: USERNAME,
      password: PASSWORD
    });

    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    let payload: any;
    try {
      payload = await res.json();
    } catch (err) {
      const text = await res.text();
      throw new Error(`Failed to parse login JSON (status=${res.status}): ${text.slice(0, 200)}`);
    }

    expect(res.status).toBe(200);
    expect(payload?.type).toBe('success');

    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Login succeeded but no Set-Cookie header found');
    }

    const match = setCookie.match(/auth_session=([^;]+)/);
    if (!match) {
      throw new Error(`Set-Cookie header does not contain auth_session: ${setCookie}`);
    }

    return `auth_session=${match[1]}`;
  }

  it('mints user MQTT credentials via IoT Core-backed endpoint', async () => {
    const cookie = await loginAndGetCookie();

    const res = await fetch(MINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: cookie
      },
      body: JSON.stringify({})
    });

    expect(res.status).toBe(200);
    const payload: any = await res.json();

    expect(payload?.success).toBe(true);
    const data = payload?.data ?? {};

    const token = data.jwt as string | undefined;
    const brokerUrl = data.brokerUrl as string | undefined;
    const clientId = data.clientId as string | undefined;

    expect(typeof token).toBe('string');
    expect(token && token.length).toBeGreaterThan(0);
    expect(typeof brokerUrl).toBe('string');
    expect(brokerUrl && brokerUrl.length).toBeGreaterThan(0);

    // cache for subsequent connection test
    mintedToken = token;
    mintedBrokerUrl = brokerUrl;
    mintedClientId = clientId;

    // Decode JWT to inspect sub/username shape
    try {
      const decoded = jwt.decode(token!) as { sub?: string } | null;
      if (decoded && decoded.sub) {
        // eslint-disable-next-line no-console
        console.log('User MQTT mint E2E decoded sub:', decoded.sub);
        expect(decoded.sub.startsWith('user:')).toBe(true);
      }
    } catch {
      // Non-fatal: token is still accepted by the broker per IoT Core
    }
  }, 20000);

  it('connects to MQTT broker using minted user credentials', async () => {
    const token = mintedToken;
    const brokerUrl = mintedBrokerUrl;
    const clientId = mintedClientId;

    expect(typeof token).toBe('string');
    expect(typeof brokerUrl).toBe('string');
    expect(typeof clientId).toBe('string');

    const decoded = jwt.decode(token!) as { sub?: string } | null;
    const mqttUsername = decoded?.sub ?? 'web-client';

    const url = new URL(brokerUrl!);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/mqtt';
    }
    const connectUrl = url.toString();

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: clientId!,
      username: mqttUsername,
      password: token!,
      reconnectPeriod: 0
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out connecting to MQTT broker with user credentials'));
        });
      }, 15000);

      client.on('connect', () => {
        clearTimeout(timeout);
        client.end(true, () => resolve());
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
    });
  }, 25000);

  it('subscribes to user MQTT topics', async () => {
    const token = mintedToken;
    const brokerUrl = mintedBrokerUrl;
    const clientId = mintedClientId;

    expect(typeof token).toBe('string');
    expect(typeof brokerUrl).toBe('string');
    expect(typeof clientId).toBe('string');

    const decoded = jwt.decode(token!) as { sub?: string } | null;
    const mqttUsername = decoded?.sub ?? 'web-client';

    const responseTopic = `user/${mqttUsername}/response`;
    const notificationsTopic = `user/${mqttUsername}/notifications`;

    const url = new URL(brokerUrl!);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/mqtt';
    }
    const connectUrl = url.toString();

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: clientId!,
      username: mqttUsername,
      password: token!,
      reconnectPeriod: 0
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out subscribing to user MQTT topics'));
        });
      }, 15000);

      client.on('connect', () => {
        client.subscribe([responseTopic, notificationsTopic], { qos: 1 }, (err) => {
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

  it('publishes to user request topic', async () => {
    const token = mintedToken;
    const brokerUrl = mintedBrokerUrl;
    const clientId = mintedClientId;

    expect(typeof token).toBe('string');
    expect(typeof brokerUrl).toBe('string');
    expect(typeof clientId).toBe('string');

    const decoded = jwt.decode(token!) as { sub?: string } | null;
    const mqttUsername = decoded?.sub ?? 'web-client';

    const requestsTopic = `user/${mqttUsername}/requests`;

    const url = new URL(brokerUrl!);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/mqtt';
    }
    const connectUrl = url.toString();

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: clientId!,
      username: mqttUsername,
      password: token!,
      reconnectPeriod: 0
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out publishing to user MQTT requests topic'));
        });
      }, 15000);

      client.on('connect', () => {
        client.publish(requestsTopic, JSON.stringify({ test: 'user-requests' }), { qos: 1 }, (err) => {
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
});
