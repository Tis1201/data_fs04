import 'dotenv/config';

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { getAdminPrisma } from '$lib/server/prisma';
import { ClaimStatus, SetStatus } from '@prisma/client';
import { handleGetPin } from '$lib/server/mqtt/handlers/device/handle_get_pin';

/**
 * End-to-end test for pre-claim detection during factory get.pin over MQTT.
 *
 * Flow:
 * 1. Decode an existing FactoryToken JWT to obtain the hardware fingerprint (MAC / serial).
 * 2. Create a PreclaimSet and PreclaimDevice for that hardware fingerprint and an existing account.
 * 3. Mint factory MQTT credentials via /api/device/mqtt/mint/factory using the same FactoryToken.
 * 4. Connect a factory MQTT client and invoke get.pin over MQTT.
 * 5. Assert that get.pin returns a PIN and that the preclaim row remains valid (PENDING, unclaimed).
 *
 * This verifies that the preclaim lookup path in handleGetPin is wired to the
 * same hardware fingerprint that the factory mint endpoint stores on
 * FactoryDevice, without yet asserting any auto-claim side effects.
 */

describe('Preclaim get.pin E2E (factory + preclaim mapping)', () => {
  const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const FACTORY_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint/factory`;

  const MQTT_DEFAULT_WS_PATH = '/mqtt';

  let factoryBrokerUrl: string;
  let factoryTokenJwt: string;
  let factoryMqttJwt: string;
  let factoryClientId: string;
  let factorySub: string; // e.g. factory:<factoryDeviceId>
  let factoryDeviceId: string;

  let hardwareFingerprint: string;
  let preclaimDeviceId: string;

  let factoryClient: MqttClient | null = null;

  type PendingRequest = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  };

  const factoryPendingRequests = new Map<string, PendingRequest>();

  function buildConnectUrl(rawUrl: string): string {
    const url = new URL(rawUrl);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = MQTT_DEFAULT_WS_PATH;
    }
    return url.toString();
  }

  function decodeSubFromJwt(token: string): string | undefined {
    try {
      const decoded = jwt.decode(token) as { sub?: string } | null;
      return decoded?.sub;
    } catch {
      return undefined;
    }
  }

  async function mintFactoryMqttWithToken(factoryTokenJwt: string): Promise<{
    jwt: string;
    brokerUrl: string;
    clientId: string;
    username: string;
  }> {
    const res = await fetch(FACTORY_MINT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${factoryTokenJwt}`,
        Accept: 'application/json'
      }
    });

    if (res.status !== 200) {
      const text = await res.text();
      throw new Error(`Factory mint failed: status=${res.status}, body=${text.slice(0, 200)}`);
    }

    const payload: any = await res.json();
    if (!payload?.success) {
      throw new Error(`Factory mint failed: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    const data = payload.data ?? {};
    const jwtToken = data.jwt as string | undefined;
    const brokerUrl = data.brokerUrl as string | undefined;
    const clientId = data.clientId as string | undefined;
    const username = (data.username as string | undefined) ?? '';

    if (!jwtToken || !brokerUrl || !clientId) {
      throw new Error(`Factory mint response missing fields: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    return { jwt: jwtToken, brokerUrl, clientId, username };
  }

  function sendFactoryRpc(client: MqttClient, op: string, params: Record<string, any>, timeoutMs = 10_000): Promise<any> {
    const requestId = randomUUID();
    const requestPayload = { requestId, op, params };
    const requestTopic = `device/${factorySub}/requests`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        factoryPendingRequests.delete(requestId);
        reject(new Error(`Factory RPC timeout for ${op} (${requestId})`));
      }, timeoutMs);

      factoryPendingRequests.set(requestId, { resolve, reject, timeout });

      client.publish(requestTopic, JSON.stringify(requestPayload), { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          factoryPendingRequests.delete(requestId);
          reject(err);
        }
      });
    });
  }

  function connectFactoryClient(): Promise<MqttClient> {
    const connectUrl = buildConnectUrl(factoryBrokerUrl);

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: factoryClientId,
      username: factorySub,
      password: factoryMqttJwt,
      reconnectPeriod: 0
    };

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      const responseTopic = `device/${factorySub}/response`;

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out connecting factory MQTT client'));
        });
      }, 15_000);

      client.on('connect', () => {
        client.subscribe([responseTopic], { qos: 1 }, (err) => {
          if (err) {
            clearTimeout(timeout);
            client.end(true, () => reject(err));
            return;
          }

          // eslint-disable-next-line no-console
          console.log('[PreclaimGetPinE2E] Connected factory MQTT client', {
            factorySub,
            factoryClientId,
            responseTopic,
            requestTopic: `device/${factorySub}/requests`
          });

          clearTimeout(timeout);
          resolve(client);
        });
      });

      client.on('message', (topic, payload) => {
        if (topic !== responseTopic) return;

        const text = payload.toString();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }

        // eslint-disable-next-line no-console
        console.log('[PreclaimGetPinE2E] Received factory MQTT message', { topic, data });

        if (data?.requestId && factoryPendingRequests.has(data.requestId)) {
          const entry = factoryPendingRequests.get(data.requestId)!;
          clearTimeout(entry.timeout);
          factoryPendingRequests.delete(data.requestId);

          if (data.error) {
            entry.reject(new Error(String(data.error)));
          } else {
            entry.resolve(data.result ?? data);
          }
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
    });
  }

  beforeAll(async () => {
    const prisma = getAdminPrisma();

    // 1) Find a usable factory token
    const factoryToken = await prisma.factoryToken.findFirst({
      where: {
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        issuedAt: 'desc'
      }
    });

    if (!factoryToken) {
      throw new Error('No active FactoryToken found. Create one via the admin UI before running this test.');
    }

    factoryTokenJwt = factoryToken.token;
    // Choose a per-run normalized MAC-style hardware fingerprint to avoid
    // unique constraint conflicts on FactoryDevice.hardwareFingerprint.
    hardwareFingerprint = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

    // 2) Mint factory MQTT credentials with the token (this will create a FactoryDevice row).
    const factoryMint = await mintFactoryMqttWithToken(factoryTokenJwt);

    factoryBrokerUrl = factoryMint.brokerUrl;
    factoryClientId = factoryMint.clientId;
    factorySub = factoryMint.username || decodeSubFromJwt(factoryMint.jwt) || '';

    // Use the minted MQTT JWT as the MQTT password
    factoryMqttJwt = factoryMint.jwt;

    if (!factorySub) {
      throw new Error('Failed to derive MQTT subject for factory client from mint response');
    }

    // Derive factoryDeviceId from the MQTT subject (factory:<factoryDeviceId>) and
    // update its hardwareFingerprint so handleGetPin can use it to look up preclaims.
    factoryDeviceId = factorySub.replace('factory:', '');
    if (!factoryDeviceId) {
      throw new Error('Failed to extract factoryDeviceId from factorySub');
    }

    await prisma.factoryDevice.update({
      where: { id: factoryDeviceId },
      data: { hardwareFingerprint }
    });

    // 3) Choose an existing account for the preclaim set
    const account = await prisma.account.findFirst();
    if (!account) {
      throw new Error('No Account found; ensure seed data or create an account before running this test.');
    }

    // 4) Create (or append to) a preclaim set & device for this hardware fingerprint
    const preclaimSet = await prisma.preclaimSet.create({
      data: {
        name: `preclaim-e2e-${Date.now()}`,
        description: 'Preclaim E2E test set',
        status: SetStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdBy: 'preclaim-e2e',
        accountId: account.id
      }
    });

    const preclaimDevice = await prisma.preclaimDevice.create({
      data: {
        macId: hardwareFingerprint,
        name: 'Preclaim E2E Device',
        status: ClaimStatus.PENDING,
        accountId: account.id,
        setId: preclaimSet.id
      }
    });

    preclaimDeviceId = preclaimDevice.id;
  }, 30_000);

  afterAll(async () => {
    if (factoryClient) {
      await new Promise<void>((resolve) => {
        factoryClient!.end(true, () => resolve());
      });
    }
  });

  it('returns a PIN for get.pin when a matching preclaim exists', async () => {
    const prisma = getAdminPrisma();

    const topic = `device/${factorySub}/requests`;
    const result = await handleGetPin({ topic, prisma: prisma as any });
    const pin = result.pin;

    expect(typeof pin).toBe('string');
    expect((pin as string).length).toBeGreaterThan(0);

    // Verify that the preclaim row is still present and valid (PENDING, unclaimed).
    const refreshed = await prisma.preclaimDevice.findUnique({
      where: { id: preclaimDeviceId },
      include: { set: true }
    });

    expect(refreshed).not.toBeNull();
    expect(refreshed?.macId).toBe(hardwareFingerprint);
    expect(refreshed?.status).toBe(ClaimStatus.PENDING);
    expect(refreshed?.claimedAt).toBeNull();
    expect(refreshed?.set.status).toBe(SetStatus.ACTIVE);
  }, 60_000);
});
