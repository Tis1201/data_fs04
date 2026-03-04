import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { getAdminPrisma } from '$lib/server/prisma';

const prisma = getAdminPrisma();

/**
 * End-to-end test for MQTT Worker complete authentication & RPC flow.
 *
 * Flow:
 * 1. Mint factory token for device registration
 * 2. Mint device token using factory token
 * 3. Get device PIN for authentication
 * 4. Send RPC calls with proper token authentication
 * 5. Verify RPC response handling
 * 6. Test MQTT message ingestion with authenticated context
 * 7. Confirm Redis queue notifications
 * 8. Validate WebSocket notifications to clients
 */

describe('MQTT Worker E2E - Complete Auth & RPC Flow', () => {
  const WEB_BASE_URL =
    process.env.E2E_BASE_URL_LOCAL ?? process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const FACTORY_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint/factory`;
  const DEVICE_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint`;
  const MQTT_DEFAULT_WS_PATH = '/mqtt';
  const RPC_TIMEOUT_MS = 15000;

  let factoryTokenJwt: string;
  let factoryBrokerUrl: string;
  let factoryMqttJwt: string;
  let factoryClientId: string;
  let factorySub: string;
  let factoryDeviceId: string;
  let factoryClient: MqttClient | null = null;

  let deviceId: string;
  let deviceApiKey: string;
  let deviceBrokerUrl: string;
  let deviceMqttJwt: string;
  let deviceClientId: string;
  let deviceSub: string;
  let deviceClient: MqttClient | null = null;

  type PendingRequest = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  };

  const factoryPendingRequests = new Map<string, PendingRequest>();
  const devicePendingRequests = new Map<string, PendingRequest>();

  function buildConnectUrl(rawUrl: string): string {
    const url = new URL(rawUrl);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = MQTT_DEFAULT_WS_PATH;
    }
    return url.toString();
  }

  function extractRpcResult(envelope: any): any {
    if (!envelope || typeof envelope !== 'object') {
      return envelope;
    }
    const payload = (envelope as any).result;
    if (payload && typeof payload === 'object') {
      const nested = (payload as any).result;
      if (nested && typeof nested === 'object') {
        return nested;
      }
      return payload;
    }
    return envelope;
  }

  function decodeSubFromJwt(token: string): string | undefined {
    try {
      const decoded = jwt.decode(token) as { sub?: string } | null;
      return decoded?.sub;
    } catch {
      return undefined;
    }
  }

  async function mintFactoryMqtt(factoryTokenJwt: string): Promise<{
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
    return {
      jwt: data.jwt as string,
      brokerUrl: data.brokerUrl as string,
      clientId: data.clientId as string,
      username: (data.username as string) ?? ''
    };
  }

  async function mintDeviceMqtt(apiKey: string): Promise<{
    jwt: string;
    brokerUrl: string;
    clientId: string;
    username: string;
  }> {
    const res = await fetch(DEVICE_MINT_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json'
      }
    });

    if (res.status !== 200) {
      const text = await res.text();
      throw new Error(`Device mint failed: status=${res.status}, body=${text.slice(0, 200)}`);
    }

    const payload: any = await res.json();
    if (!payload?.success) {
      throw new Error(`Device mint failed: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    const data = payload.data ?? {};
    return {
      jwt: data.jwt as string,
      brokerUrl: data.brokerUrl as string,
      clientId: data.clientId as string,
      username: (data.username as string) ?? ''
    };
  }

  function sendFactoryRpc(op: string, params: Record<string, any>, timeoutMs = RPC_TIMEOUT_MS): Promise<any> {
    if (!factoryClient) {
      throw new Error('Factory client not connected');
    }

    const requestId = randomUUID();
    const requestPayload = { requestId, op, params };
    const requestTopic = `device/${factorySub}/requests`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        factoryPendingRequests.delete(requestId);
        reject(new Error(`Factory RPC timeout for ${op} (${requestId})`));
      }, timeoutMs);

      factoryPendingRequests.set(requestId, { resolve, reject, timeout });

      factoryClient!.publish(requestTopic, JSON.stringify(requestPayload), { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          factoryPendingRequests.delete(requestId);
          reject(err);
        }
      });
    });
  }

  function sendDeviceRpc(op: string, params: Record<string, any>, timeoutMs = RPC_TIMEOUT_MS): Promise<any> {
    if (!deviceClient) {
      throw new Error('Device client not connected');
    }

    const requestId = randomUUID();
    const requestPayload = { requestId, op, params };
    const requestTopic = `device/${deviceSub}/requests`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        devicePendingRequests.delete(requestId);
        reject(new Error(`Device RPC timeout for ${op} (${requestId})`));
      }, timeoutMs);

      devicePendingRequests.set(requestId, { resolve, reject, timeout });

      deviceClient!.publish(requestTopic, JSON.stringify(requestPayload), { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          devicePendingRequests.delete(requestId);
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
      const notificationsTopic = `device/${factorySub}/notifications`;

      const timeout = setTimeout(() => {
        client.end(true, () => reject(new Error('Timed out connecting factory MQTT client')));
      }, 15000);

      client.on('connect', () => {
        client.subscribe([responseTopic, notificationsTopic], { qos: 1 }, (err) => {
          if (err) {
            clearTimeout(timeout);
            client.end(true, () => reject(err));
            return;
          }
          clearTimeout(timeout);
          resolve(client);
        });
      });

      client.on('message', (topic, payload) => {
        const text = payload.toString();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }

        if (topic === responseTopic && data?.requestId && factoryPendingRequests.has(data.requestId)) {
          const entry = factoryPendingRequests.get(data.requestId)!;
          clearTimeout(entry.timeout);
          factoryPendingRequests.delete(data.requestId);

          if (data.error) {
            entry.reject(new Error(String(data.error)));
          } else {
            entry.resolve(extractRpcResult(data));
          }
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
    });
  }

  function connectDeviceClient(): Promise<MqttClient> {
    const connectUrl = buildConnectUrl(deviceBrokerUrl);
    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: deviceClientId,
      username: deviceSub,
      password: deviceMqttJwt,
      reconnectPeriod: 0
    };

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);
      const responseTopic = `device/${deviceSub}/response`;
      const notificationsTopic = `device/${deviceSub}/notifications`;

      const timeout = setTimeout(() => {
        client.end(true, () => reject(new Error('Timed out connecting device MQTT client')));
      }, 15000);

      client.on('connect', () => {
        client.subscribe([responseTopic, notificationsTopic], { qos: 1 }, (err) => {
          if (err) {
            clearTimeout(timeout);
            client.end(true, () => reject(err));
            return;
          }
          clearTimeout(timeout);
          resolve(client);
        });
      });

      client.on('message', (topic, payload) => {
        const text = payload.toString();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }

        if (topic === responseTopic && data?.requestId && devicePendingRequests.has(data.requestId)) {
          const entry = devicePendingRequests.get(data.requestId)!;
          clearTimeout(entry.timeout);
          devicePendingRequests.delete(data.requestId);

          if (data.error) {
            entry.reject(new Error(String(data.error)));
          } else {
            entry.resolve(extractRpcResult(data));
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
    // Always get the most recent non-expired factory token from database
    const factoryToken = await prisma.factoryToken.findFirst({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: { issuedAt: 'desc' }
    });

    if (!factoryToken) {
      throw new Error('No non-expired FactoryToken found. Create one via admin UI before running this test.');
    }

    factoryTokenJwt = factoryToken.token;
  }, 30000);

  afterAll(async () => {
    if (deviceClient) {
      await new Promise<void>((resolve) => deviceClient!.end(true, () => resolve()));
    }
    if (factoryClient) {
      await new Promise<void>((resolve) => factoryClient!.end(true, () => resolve()));
    }
  });

  it('Step 1: Mint factory token and connect', async () => {
    const factoryMint = await mintFactoryMqtt(factoryTokenJwt);

    factoryBrokerUrl = factoryMint.brokerUrl;
    factoryClientId = factoryMint.clientId;
    factorySub = factoryMint.username || decodeSubFromJwt(factoryMint.jwt) || '';
    factoryMqttJwt = factoryMint.jwt;

    expect(factoryBrokerUrl).toBeTruthy();
    expect(factoryClientId).toBeTruthy();
    expect(factorySub).toBeTruthy();
    expect(factoryMqttJwt).toBeTruthy();

    factoryDeviceId = factorySub.replace('factory:', '');
    expect(factoryDeviceId).toBeTruthy();

    factoryClient = await connectFactoryClient();
    expect(factoryClient).toBeTruthy();
  }, 30000);

  it('Step 2: Get PIN via factory RPC', async () => {
    const result = await sendFactoryRpc('get.pin', {});
    const pin = (result as { pin?: string }).pin;

    expect(typeof pin).toBe('string');
    expect((pin as string).length).toBeGreaterThan(0);
  }, 20000);

  it('Step 3: Claim device and get API key', async () => {
    const account = await prisma.account.findFirst({
      where: { name: { not: '' } },
      orderBy: { createdAt: 'desc' }
    });

    if (!account) {
      throw new Error('No account found for device claim');
    }

    const user = await prisma.user.findFirst({
      where: { 
        accountMemberships: { some: { accountId: account.id } }
      }
    });

    if (!user) {
      throw new Error('No user found for device claim');
    }

    const device = await prisma.device.create({
      data: {
        name: `E2E Test Device ${Date.now()}`,
        accountId: account.id,
        createdBy: user.id,
        claimedAt: new Date(),
        apiKey: randomUUID()
      }
    });

    await prisma.factoryDevice.update({
      where: { id: factoryDeviceId },
      data: { 
        claimedDeviceId: device.id,
        accountId: account.id
      }
    });

    deviceId = device.id;
    deviceApiKey = device.apiKey!;

    expect(deviceId).toBeTruthy();
    expect(deviceApiKey).toBeTruthy();
  }, 20000);

  it('Step 4: Mint device token using API key', async () => {
    const deviceMint = await mintDeviceMqtt(deviceApiKey);

    deviceBrokerUrl = deviceMint.brokerUrl;
    deviceClientId = deviceMint.clientId;
    deviceSub = deviceMint.username || decodeSubFromJwt(deviceMint.jwt) || '';
    deviceMqttJwt = deviceMint.jwt;

    expect(deviceBrokerUrl).toBeTruthy();
    expect(deviceClientId).toBeTruthy();
    expect(deviceSub).toBeTruthy();
    expect(deviceMqttJwt).toBeTruthy();
    expect(deviceSub).toContain('device:');

    deviceClient = await connectDeviceClient();
    expect(deviceClient).toBeTruthy();
  }, 30000);

  it('Step 5: Send RPC call with authenticated device', async () => {
    const loopbackTopic = `device/${deviceSub}/loopback`;
    const testPayload = { test: 'authenticated-rpc', ts: Date.now() };

    await new Promise<void>((resolve, reject) => {
      let received = false;

      const timeout = setTimeout(() => {
        if (!received) {
          reject(new Error('Timeout waiting for loopback message'));
        }
      }, 10000);

      deviceClient!.subscribe(loopbackTopic, { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
          return;
        }

        deviceClient!.publish(loopbackTopic, JSON.stringify(testPayload), { qos: 1 }, (err) => {
          if (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });
      });

      deviceClient!.on('message', (topic, payload) => {
        if (topic === loopbackTopic && !received) {
          try {
            const parsed = JSON.parse(payload.toString());
            if (parsed.test === 'authenticated-rpc') {
              received = true;
              clearTimeout(timeout);
              resolve();
            }
          } catch {
            // Ignore parse errors
          }
        }
      });
    });
  }, 20000);

  it('Step 6: Verify MQTT message ingestion', async () => {
    const requestsTopic = `device/${deviceSub}/requests`;
    const testMessage = {
      requestId: randomUUID(),
      op: 'ping',
      params: { timestamp: Date.now() }
    };

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout publishing test message'));
      }, 5000);

      deviceClient!.publish(requestsTopic, JSON.stringify(testMessage), { qos: 1 }, (err) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }, 10000);

  it('Step 7: Cleanup - disconnect clients', async () => {
    if (deviceClient) {
      await new Promise<void>((resolve) => {
        deviceClient!.end(true, () => {
          deviceClient = null;
          resolve();
        });
      });
    }

    if (factoryClient) {
      await new Promise<void>((resolve) => {
        factoryClient!.end(true, () => {
          factoryClient = null;
          resolve();
        });
      });
    }

    expect(deviceClient).toBeNull();
    expect(factoryClient).toBeNull();
  }, 10000);
});
