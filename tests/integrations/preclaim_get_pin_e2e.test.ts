import 'dotenv/config';

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { getAdminPrisma } from '$lib/server/prisma';
import { ClaimStatus, SetStatus } from '@prisma/client';
import { handleGetPin } from '$lib/server/mqtt/handlers/device/handle_get_pin';

const prisma = getAdminPrisma();

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
  const LOGIN_URL = `${WEB_BASE_URL}/auth/login?/login`;
  const USER_MINT_URL = `${WEB_BASE_URL}/api/user/mqtt/mint`;

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

  // User-side MQTT (recipient of claimed notification)
  let userBrokerUrl: string;
  let userJwt: string;
  let userClientId: string;
  let userSub: string; // e.g. user:<userId>:<accountId>
  let userClient: MqttClient | null = null;

  type PendingRequest = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  };

  const factoryPendingRequests = new Map<string, PendingRequest>();

  type NotificationTicketClaims = {
    type?: string;
    sub?: string;
    recipient?: string;
    flowId?: string;
    params?: Record<string, unknown>;
  };

  type PendingNotification = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  };

  const userPendingNotifications = new Map<string, PendingNotification>();
  const receivedNotifications = new Map<
    string,
    { flowId: string; type?: string; params?: Record<string, unknown> }
  >();

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

  function decodeNotificationTicket(ticket: string): NotificationTicketClaims | null {
    try {
      const decoded = jwt.decode(ticket);
      if (!decoded || typeof decoded !== 'object') {
        return null;
      }
      return decoded as NotificationTicketClaims;
    } catch {
      return null;
    }
  }

  async function loginAndGetCookie(): Promise<string> {
    const USERNAME = process.env.SAMPLE_ADMIN_USERNAME ?? 'admin@admin.com';
    const PASSWORD = process.env.SAMPLE_ADMIN_PASSWORD ?? 'admin0823';

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

    if (res.status !== 200 || payload?.type !== 'success') {
      throw new Error(`Login failed: status=${res.status}, body=${JSON.stringify(payload).slice(0, 200)}`);
    }

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

  async function mintUserMqtt(cookie: string): Promise<{
    jwt: string;
    brokerUrl: string;
    clientId: string;
    username: string;
  }> {
    const res = await fetch(USER_MINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: cookie
      },
      body: JSON.stringify({})
    });

    if (res.status !== 200) {
      const text = await res.text();
      throw new Error(`User mint failed: status=${res.status}, body=${text.slice(0, 200)}`);
    }

    const payload: any = await res.json();
    if (!payload?.success) {
      throw new Error(`User mint failed: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    const data = payload.data ?? {};
    const jwtToken = data.jwt as string | undefined;
    const brokerUrl = data.brokerUrl as string | undefined;
    const clientId = data.clientId as string | undefined;
    const username = data.username as string | undefined;

    if (!jwtToken || !brokerUrl || !clientId || !username) {
      throw new Error(`User mint response missing fields: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    return { jwt: jwtToken, brokerUrl, clientId, username };
  }

  function waitForUserNotification(flowId: string, timeoutMs = 10_000): Promise<any> {
    // If we already received a notification for this flowId, return it immediately.
    if (receivedNotifications.has(flowId)) {
      return Promise.resolve(receivedNotifications.get(flowId));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        userPendingNotifications.delete(flowId);
        reject(new Error(`No user notification for flowId ${flowId} within ${timeoutMs}ms`));
      }, timeoutMs);

      userPendingNotifications.set(flowId, { resolve, reject, timeout });
    });
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

  function attachUserHandlers(client: MqttClient): void {
    const notificationsTopic = `user/${userSub}/notifications`;

    client.on('message', (topic, payload) => {
      if (topic !== notificationsTopic) return;

      const text = payload.toString();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }

      const ticket = data.ticket as string | undefined;
      if (!ticket) {
        return;
      }

      const claims = decodeNotificationTicket(ticket);
      if (!claims || !claims.flowId) {
        return;
      }

      const flowId = claims.flowId;

      const entryValue = {
        flowId,
        type: claims.type,
        params: claims.params ?? {}
      };
      receivedNotifications.set(flowId, entryValue);

      if (userPendingNotifications.has(flowId)) {
        const entry = userPendingNotifications.get(flowId)!;
        clearTimeout(entry.timeout);
        userPendingNotifications.delete(flowId);
        entry.resolve(entryValue);
      }
    });
  }

  function connectUserClient(): Promise<MqttClient> {
    const connectUrl = buildConnectUrl(userBrokerUrl);

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: userClientId,
      username: userSub,
      password: userJwt,
      reconnectPeriod: 0
    };

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      attachUserHandlers(client);

      const notificationsTopic = `user/${userSub}/notifications`;

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out connecting user MQTT client'));
        });
      }, 15_000);

      client.on('connect', () => {
        client.subscribe([notificationsTopic], { qos: 1 }, (err) => {
          if (err) {
            clearTimeout(timeout);
            client.end(true, () => reject(err));
            return;
          }

          clearTimeout(timeout);
          resolve(client);
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
    });
  }

  beforeAll(async () => {
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

    // 3) Login as SAMPLE_ADMIN and mint user MQTT credentials (recipient of claimed notification)
    const cookie = await loginAndGetCookie();
    const userMint = await mintUserMqtt(cookie);

    userBrokerUrl = userMint.brokerUrl;
    userJwt = userMint.jwt;
    userClientId = userMint.clientId;
    userSub = userMint.username;

    const [subjectType, userId, accountId] = userSub.split(':');
    if (subjectType !== 'user' || !userId || !accountId) {
      throw new Error(`Invalid user subject from mint: ${userSub}`);
    }

    const [preclaimUser, account] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.account.findUnique({ where: { id: accountId } })
    ]);

    if (!preclaimUser || !account) {
      throw new Error('Preclaim user or account not found for user MQTT mint');
    }

    // 4) Create (or append to) a preclaim set & device for this hardware fingerprint, tied to this user/account
    const preclaimSet = await prisma.preclaimSet.create({
      data: {
        name: `preclaim-e2e-${Date.now()}`,
        description: 'Preclaim E2E test set',
        status: SetStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdBy: preclaimUser.id,
        accountId: account.id
      }
    });

    const preclaimDevice = await prisma.preclaimDevice.create({
      data: {
        macId: hardwareFingerprint,
        name: 'Preclaim E2E Device',
        status: ClaimStatus.PENDING,
        accountId: account.id,
        setId: preclaimSet.id,
        claimedBy: preclaimUser.id
      }
    });

    preclaimDeviceId = preclaimDevice.id;
  }, 30_000);

  afterAll(async () => {
    if (userClient) {
      await new Promise<void>((resolve) => {
        userClient!.end(true, () => resolve());
      });
    }
    if (factoryClient) {
      await new Promise<void>((resolve) => {
        factoryClient!.end(true, () => resolve());
      });
    }
  });

  it('returns a PIN for get.pin when a matching preclaim exists', async () => {
    userClient = await connectUserClient();
    factoryClient = await connectFactoryClient();

    const result = await sendFactoryRpc(factoryClient, 'get.pin', {}, 15_000);
    const pin = (result as { pin?: string }).pin;

    expect(typeof pin).toBe('string');
    expect((pin as string).length).toBeGreaterThan(0);

    // Verify that the preclaim row was fulfilled and a claimed device was created and linked.
    const refreshed = await prisma.preclaimDevice.findUnique({
      where: { id: preclaimDeviceId },
      include: { set: true }
    });

    expect(refreshed).not.toBeNull();
    expect(refreshed?.macId).toBe(hardwareFingerprint);
    expect(refreshed?.status).toBe(ClaimStatus.FULFILLED);
    expect(refreshed?.claimedAt).not.toBeNull();
    expect(refreshed?.deviceId).not.toBeNull();
    expect(refreshed?.set.status).toBe(SetStatus.ACTIVE);

    const claimedDevice = await prisma.device.findUnique({
      where: { id: refreshed!.deviceId! },
      select: {
        id: true,
        accountId: true,
        createdBy: true,
        claimedAt: true,
        apiKey: true
      }
    });

    expect(claimedDevice).not.toBeNull();
    expect(claimedDevice?.accountId).toBe(refreshed?.accountId);
    expect(claimedDevice?.createdBy).toBe(refreshed?.claimedBy);
    expect(claimedDevice?.claimedAt).not.toBeNull();
    // API key should be generated and stored on the Device record
    expect(claimedDevice?.apiKey).toBeTypeOf('string');

    const factory = await prisma.factoryDevice.findUnique({
      where: { id: factoryDeviceId }
    });

    expect(factory).not.toBeNull();
    expect(factory?.claimedDeviceId).toBe(claimedDevice?.id);
    expect(factory?.accountId).toBe(claimedDevice?.accountId);

    // Verify that a claimed notification was published to the user MQTT topic
    // (we do not expose the apiKey in this user-facing notification).
    const notification = await waitForUserNotification(claimedDevice!.id, 10_000);
    const params = (notification as { params?: Record<string, unknown> }).params ?? {};

    expect((notification as { type?: string }).type).toBe('claim');
    expect(params.deviceId).toBe(claimedDevice!.id);
    expect(params.accountId).toBe(claimedDevice!.accountId);
  }, 60_000);
});
