import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions } from 'mqtt';
import jwt from 'jsonwebtoken';

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
  const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const FACTORY_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint/factory`;

  const MQTT_DEFAULT_WS_PATH = '/mqtt';

  let brokerUrl: string;
  let token: string;
  let clientId: string;
  let username: string;

  beforeAll(async () => {
    const factoryJwt = process.env.SAMPLE_DEVICE_FACTORY_TOKEN;
    if (!factoryJwt) {
      throw new Error('SAMPLE_DEVICE_FACTORY_TOKEN env var is required for factory mint E2E test');
    }

    const res = await fetch(FACTORY_MINT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${factoryJwt}`,
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

    expect(typeof brokerUrl).toBe('string');
    expect(brokerUrl.length).toBeGreaterThan(0);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(0);
  }, 20000);

  it('connects to MQTT broker using minted factory credentials', async () => {
    const url = new URL(brokerUrl);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = MQTT_DEFAULT_WS_PATH;
    }

    const connectUrl = url.toString();

    // For factory devices we use the minted username (sub) as MQTT username
    // and the minted JWT as password.
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
          reject(new Error('Timed out connecting to MQTT broker with factory credentials'));
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
  }, 30000);
});
