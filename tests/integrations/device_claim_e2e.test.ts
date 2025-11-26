import 'dotenv/config';

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { getAdminPrisma } from '$lib/server/prisma';

/**
 * End-to-end test for full device-claim flow using Node MQTT for both
 * factory device and user roles.
 *
 * Flow (mirrors DEVICE_CLAIM.md):
 *
 * 1. Mint factory MQTT credentials via /api/device/mqtt/mint/factory using a
 *    DB-backed FactoryToken.
 * 2. Mint user MQTT credentials via /api/user/mqtt/mint using
 *    SAMPLE_ADMIN_USERNAME/SAMPLE_ADMIN_PASSWORD.
 * 3. Connect factory client as factory:<factoryDeviceId> and subscribe to
 *    device/<sub>/response and device/<sub>/notifications.
 * 4. Connect user client as user:<userId>:<accountId> and subscribe to
 *    user/<sub>/response and user/<sub>/notifications.
 * 5. Factory sends `get.pin` RPC and receives a PIN on /response.
 * 6. User sends `device.claim` RPC with the PIN on user/<sub>/requests.
 * 7. Worker validates PIN, sends a `claim` notification to the factory
 *    device, which responds with `device.claim.confirm`.
 * 8. Worker provisions a real device, replies to the factory, and emits a
 *    `reply:claim` notification to the user.
 * 9. Test asserts that both sides observe a consistent deviceId and
 *    factoryDeviceId in their respective results/notifications.
 */

describe('Device claim E2E (user claims factory device over MQTT)', () => {
  const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const FACTORY_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint/factory`;
  const LOGIN_URL = `${WEB_BASE_URL}/auth/login?/login`;
  const USER_MINT_URL = `${WEB_BASE_URL}/api/user/mqtt/mint`;

  const MQTT_DEFAULT_WS_PATH = '/mqtt';

  // Factory-side minted credentials
  let factoryBrokerUrl: string;
  let factoryJwt: string;
  let factoryClientId: string;
  let factorySub: string; // e.g. factory:<factoryDeviceId>

  // User-side minted credentials
  let userBrokerUrl: string;
  let userJwt: string;
  let userClientId: string;
  let userSub: string; // e.g. user:<userId>:<accountId>

  let factoryClient: MqttClient | null = null;
  let userClient: MqttClient | null = null;

  type PendingRequest = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  };

  type PendingNotification = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  };

  const factoryPendingRequests = new Map<string, PendingRequest>();
  const userPendingRequests = new Map<string, PendingRequest>();
  const userPendingNotifications = new Map<string, PendingNotification>();

  type NotificationTicketClaims = {
    type?: string;
    sub?: string;
    recipient?: string;
    flowId?: string;
    params?: Record<string, unknown>;
  };

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

  function extractFactoryRpcResult(envelope: any): any {
    if (!envelope || typeof envelope !== 'object') {
      return envelope;
    }
    const payload = envelope.result;
    if (payload && typeof payload === 'object') {
      const nested = (payload as any).result;
      if (nested && typeof nested === 'object') {
        return nested;
      }
      return payload;
    }
    return envelope;
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

  async function mintFactoryMqtt(): Promise<{
    jwt: string;
    brokerUrl: string;
    clientId: string;
    username: string;
  }> {
    const prisma = getAdminPrisma();

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

    const res = await fetch(FACTORY_MINT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${factoryToken.token}`,
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
    const username = (data.username as string | undefined) ?? decodeSubFromJwt(jwtToken ?? '');

    if (!jwtToken || !brokerUrl || !clientId || !username) {
      throw new Error(`Factory mint response missing fields: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    return { jwt: jwtToken, brokerUrl, clientId, username };
  }

  function waitForUserNotification(flowId: string, timeoutMs = 10_000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        userPendingNotifications.delete(flowId);
        reject(new Error(`No notification for flowId ${flowId} within ${timeoutMs}ms`));
      }, timeoutMs);

      userPendingNotifications.set(flowId, { resolve, reject, timeout });
    });
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

  function sendUserRpc(client: MqttClient, op: string, params: Record<string, any>, timeoutMs = 10_000): Promise<any> {
    const requestId = randomUUID();
    const requestPayload = { requestId, op, params };
    const requestTopic = `user/${userSub}/requests`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        userPendingRequests.delete(requestId);
        reject(new Error(`User RPC timeout for ${op} (${requestId})`));
      }, timeoutMs);

      userPendingRequests.set(requestId, { resolve, reject, timeout });

      client.publish(requestTopic, JSON.stringify(requestPayload), { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          userPendingRequests.delete(requestId);
          reject(err);
        }
      });
    });
  }

  let factoryClaimConfirmResolve: ((value: any) => void) | null = null;
  let factoryClaimConfirmReject: ((reason?: any) => void) | null = null;

  function attachFactoryHandlers(client: MqttClient): void {
    const responseTopic = `device/${factorySub}/response`;
    const notificationsTopic = `device/${factorySub}/notifications`;

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
          entry.resolve(extractFactoryRpcResult(data));
        }
        return;
      }

      if (topic === notificationsTopic && data?.ticket) {
        const claims = decodeNotificationTicket(data.ticket as string);
        if (!claims || claims.type !== 'claim') {
          return;
        }

        if (factoryClaimConfirmResolve) {
          const resolve = factoryClaimConfirmResolve;
          const reject = factoryClaimConfirmReject;

          // Ensure we only handle the first matching claim notification
          factoryClaimConfirmResolve = null;
          factoryClaimConfirmReject = null;

          (async () => {
            try {
              const confirmResult = await sendFactoryRpc(client, 'device.claim.confirm', { ticket: data.ticket });
              resolve?.(confirmResult);
            } catch (err) {
              reject?.(err);
            }
          })().catch((err) => {
            reject?.(err);
          });
        }
      }
    });
  }

  function attachUserHandlers(client: MqttClient): void {
    const responseTopic = `user/${userSub}/response`;
    const notificationsTopic = `user/${userSub}/notifications`;

    client.on('message', (topic, payload) => {
      const text = payload.toString();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }

      if (topic === responseTopic && data?.requestId && userPendingRequests.has(data.requestId)) {
        const entry = userPendingRequests.get(data.requestId)!;
        clearTimeout(entry.timeout);
        userPendingRequests.delete(data.requestId);

        if (data.error) {
          entry.reject(new Error(String(data.error)));
        } else {
          entry.resolve(data.result);
        }
        return;
      }

      if (topic === notificationsTopic && data?.ticket) {
        const claims = decodeNotificationTicket(data.ticket as string);
        if (!claims || !claims.flowId) {
          return;
        }

        const flowId = claims.flowId;
        if (!userPendingNotifications.has(flowId)) {
          return;
        }

        const entry = userPendingNotifications.get(flowId)!;
        clearTimeout(entry.timeout);
        userPendingNotifications.delete(flowId);

        entry.resolve({
          flowId,
          type: claims.type,
          params: claims.params ?? {}
        });
      }
    });
  }

  function connectFactoryClient(): Promise<MqttClient> {
    const connectUrl = buildConnectUrl(factoryBrokerUrl);

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: factoryClientId,
      username: factorySub,
      password: factoryJwt,
      reconnectPeriod: 0
    };

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      attachFactoryHandlers(client);

      const responseTopic = `device/${factorySub}/response`;
      const notificationsTopic = `device/${factorySub}/notifications`;

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out connecting factory MQTT client'));
        });
      }, 15_000);

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

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
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

      const responseTopic = `user/${userSub}/response`;
      const notificationsTopic = `user/${userSub}/notifications`;

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out connecting user MQTT client'));
        });
      }, 15_000);

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

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
    });
  }

  beforeAll(async () => {
    const [factoryMint, userMint] = await Promise.all([
      mintFactoryMqtt(),
      (async () => {
        const cookie = await loginAndGetCookie();
        return mintUserMqtt(cookie);
      })()
    ]);

    factoryBrokerUrl = factoryMint.brokerUrl;
    factoryJwt = factoryMint.jwt;
    factoryClientId = factoryMint.clientId;
    factorySub = factoryMint.username ?? decodeSubFromJwt(factoryMint.jwt) ?? '';

    userBrokerUrl = userMint.brokerUrl;
    userJwt = userMint.jwt;
    userClientId = userMint.clientId;
    userSub = userMint.username ?? decodeSubFromJwt(userMint.jwt) ?? '';

    // eslint-disable-next-line no-console
    console.log('[DeviceClaimE2E] Minted MQTT subjects and clientIds', {
      factorySub,
      userSub,
      factoryClientId,
      userClientId
    });

    if (!factorySub || !userSub) {
      throw new Error('Failed to derive MQTT subjects for factory or user');
    }
  }, 30_000);

  afterAll(async () => {
    if (factoryClient) {
      await new Promise<void>((resolve) => {
        factoryClient!.end(true, () => resolve());
      });
    }
    if (userClient) {
      await new Promise<void>((resolve) => {
        userClient!.end(true, () => resolve());
      });
    }
  });

  it('allows a user to claim a factory device over MQTT', async () => {
    factoryClient = await connectFactoryClient();
    userClient = await connectUserClient();

    // eslint-disable-next-line no-console
    console.log('[DeviceClaimE2E] Connected factory & user MQTT clients', {
      factorySub,
      userSub
    });

    const factoryPinResult = await sendFactoryRpc(factoryClient, 'get.pin', {}, 15_000);
    const pin = (factoryPinResult as { pin?: string }).pin;
    expect(typeof pin).toBe('string');
    expect((pin as string).length).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log('[DeviceClaimE2E] Received PIN from get.pin', { pin });

    const factoryClaimConfirmPromise = new Promise<{
      status: string;
      deviceId: string;
      apiKey: string;
      accountId: string | null;
    }>((resolve, reject) => {
      factoryClaimConfirmResolve = resolve;
      factoryClaimConfirmReject = reject;
    });

    const claimRpcResult = await sendUserRpc(userClient, 'device.claim', { pin }, 15_000);
    const claimFlowId = (claimRpcResult as { flowId?: string }).flowId;
    const claimInnerResult = (claimRpcResult as { result?: { factoryDeviceId?: string } }).result;
    const claimedFactoryDeviceId = claimInnerResult?.factoryDeviceId;

    expect(typeof claimedFactoryDeviceId).toBe('string');
    expect((claimedFactoryDeviceId as string).length).toBeGreaterThan(0);
    expect(typeof claimFlowId).toBe('string');

    // eslint-disable-next-line no-console
    console.log('[DeviceClaimE2E] Claim RPC result', {
      claimFlowId,
      claimedFactoryDeviceId
    });

    const userNotificationPromise = waitForUserNotification(claimFlowId as string, 15_000);

    const [factoryConfirm, userNotification] = await Promise.all([
      factoryClaimConfirmPromise,
      userNotificationPromise
    ]);

    expect(factoryConfirm.status).toBe('ok');
    expect(typeof factoryConfirm.deviceId).toBe('string');
    expect(factoryConfirm.deviceId.length).toBeGreaterThan(0);
    expect(typeof factoryConfirm.apiKey).toBe('string');
    expect(factoryConfirm.apiKey.length).toBeGreaterThan(0);

    const notificationParams = (userNotification as { params?: Record<string, unknown> }).params ?? {};
    const notifiedDeviceId = notificationParams.deviceId as string | undefined;
    const notifiedFactoryDeviceId = notificationParams.factoryDeviceId as string | undefined;
    const notifiedAccountId = (notificationParams.accountId as string | null | undefined) ?? null;

    // eslint-disable-next-line no-console
    console.log('[DeviceClaimE2E] Factory confirm summary', {
      deviceId: factoryConfirm.deviceId,
      accountId: factoryConfirm.accountId
    });

    // eslint-disable-next-line no-console
    console.log('[DeviceClaimE2E] User notification summary', {
      notifiedDeviceId,
      notifiedFactoryDeviceId,
      notifiedAccountId
    });

    expect(notifiedDeviceId).toBe(factoryConfirm.deviceId);
    expect(notifiedFactoryDeviceId).toBe(claimedFactoryDeviceId);
    expect(notifiedAccountId).toBe(factoryConfirm.accountId ?? null);
  }, 60_000);
});
