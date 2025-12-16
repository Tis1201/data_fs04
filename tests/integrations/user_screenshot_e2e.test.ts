import 'dotenv/config';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

import { getAdminPrisma } from '$lib/server/prisma';

/**
 * End-to-end test for user-initiated screenshot over MQTT.
 *
 * Flow:
 * 1. Login as SAMPLE_ADMIN and mint user MQTT credentials via /api/user/mqtt/mint.
 * 2. Use Prisma to find a device the user has access to (account member) with a non-null apiKey.
 * 3. Mint device MQTT credentials via /api/device/mqtt/mint using the device apiKey.
 * 4. Connect user client (user:<userId>:<accountId>) and device client (device:<deviceId>) to broker.
 * 5. User sends `device.screenshot` RPC over MQTT.
 * 6. Worker sends a signed-ticket notification to the device; device replies on
 *    device/<deviceId>/replies with { ticket, result: { data, ... } }.
 * 7. Worker relays a reply-style notification to the user; test asserts that
 *    screenshot data is present in the notification params.
 */

describe('User screenshot E2E (user requests screenshot over MQTT)', () => {
  const WEB_BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
  const LOGIN_URL = `${WEB_BASE_URL}/auth/login?/login`;
  const USER_MINT_URL = `${WEB_BASE_URL}/api/user/mqtt/mint`;
  const DEVICE_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint`;

  const MQTT_DEFAULT_WS_PATH = '/mqtt';

  // User-side minted credentials
  let userBrokerUrl: string;
  let userJwt: string;
  let userClientId: string;
  let userSub: string; // e.g. user:<userId>:<accountId>

  // Device-side minted credentials
  let deviceBrokerUrl: string;
  let deviceJwt: string;
  let deviceClientId: string;
  let deviceSub: string; // e.g. device:<deviceId>
  let deviceId: string;

  let userClient: MqttClient | null = null;
  let deviceClient: MqttClient | null = null;

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

  async function findDeviceForUser(): Promise<{ id: string; apiKey: string }> {
    const prisma = getAdminPrisma();

    const [subjectType, userId] = userSub.split(':');
    if (subjectType !== 'user' || !userId) {
      throw new Error(`Invalid user subject: ${userSub}`);
    }

    const device = await prisma.device.findFirst({
      where: {
        apiKey: {
          not: null
        },
        account: {
          members: {
            some: { userId }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        apiKey: true
      }
    });

    if (!device?.apiKey) {
      throw new Error(
        'No claimed device with apiKey found for this user. Run the device claim E2E or create a device in the admin UI before running this test.'
      );
    }

    return { id: device.id, apiKey: device.apiKey };
  }

  async function mintDeviceMqtt(apiKey: string): Promise<{
    jwt: string;
    brokerUrl: string;
    clientId: string;
    username: string;
    mqttUsername?: string;
  }> {
    const res = await fetch(DEVICE_MINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({})
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
    const jwtToken = data.jwt as string | undefined;
    const brokerUrl = data.brokerUrl as string | undefined;
    const clientId = data.clientId as string | undefined;
    const username = data.username as string | undefined;
    const mqttUsername = data.mqttUsername as string | undefined;

    if (!jwtToken || !brokerUrl || !clientId) {
      throw new Error(`Device mint response missing fields: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    return {
      jwt: jwtToken,
      brokerUrl,
      clientId,
      username: username ?? '',
      mqttUsername
    };
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

  function attachDeviceHandlers(client: MqttClient): void {
    const notificationsTopic = `device/${deviceSub}/notifications`;
    // Replies must be sent on the same subject used for mint ACLs (deviceSub)
    // so IoT Core allows publish and the worker's reply handler can see them.
    const repliesTopic = `device/${deviceSub}/replies`;

    client.on('message', (topic, payload) => {
      if (topic !== notificationsTopic) {
        return;
      }

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
      if (!claims || claims.type !== 'device.screenshot') {
        return;
      }

      const replyEnvelope = {
        ticket,
        status: 'OK',
        error: '',
        result: {
          type: 'device.screenshot.response',
          data: '<base64-image>',
          format: 'png',
          width: 1920,
          height: 1080
        }
      };

      client.publish(repliesTopic, JSON.stringify(replyEnvelope), { qos: 1 });
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

  function connectDeviceClient(): Promise<MqttClient> {
    const connectUrl = buildConnectUrl(deviceBrokerUrl);

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: deviceClientId,
      username: deviceSub,
      password: deviceJwt,
      reconnectPeriod: 0
    };

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(connectUrl, options);

      attachDeviceHandlers(client);

      const notificationsTopic = `device/${deviceSub}/notifications`;

      const timeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Timed out connecting device MQTT client'));
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
    const cookie = await loginAndGetCookie();
    const userMint = await mintUserMqtt(cookie);

    userBrokerUrl = userMint.brokerUrl;
    userJwt = userMint.jwt;
    userClientId = userMint.clientId;
    userSub = userMint.username;

    const deviceRecord = await findDeviceForUser();
    deviceId = deviceRecord.id;

    const deviceMint = await mintDeviceMqtt(deviceRecord.apiKey);

    deviceBrokerUrl = deviceMint.brokerUrl;
    deviceJwt = deviceMint.jwt;
    deviceClientId = deviceMint.clientId;
    deviceSub = deviceMint.mqttUsername ?? deviceMint.username;

    if (!deviceSub) {
      throw new Error('Failed to derive MQTT subject for device');
    }
  }, 30_000);

  afterAll(async () => {
    if (userClient) {
      await new Promise<void>((resolve) => {
        userClient!.end(true, () => resolve());
      });
    }
    if (deviceClient) {
      await new Promise<void>((resolve) => {
        deviceClient!.end(true, () => resolve());
      });
    }
  });

  it('allows a user to request a screenshot from a device over MQTT', async () => {
    userClient = await connectUserClient();
    deviceClient = await connectDeviceClient();

    // eslint-disable-next-line no-console
    console.log('[UserScreenshotE2E] Connected user & device MQTT clients', {
      userSub,
      deviceSub,
      deviceId
    });

    const screenshotRpcResult = await sendUserRpc(userClient, 'device.screenshot', { deviceId }, 15_000);
    const screenshotFlowId = (screenshotRpcResult as { flowId?: string }).flowId;

    expect(typeof screenshotFlowId).toBe('string');
    expect((screenshotFlowId as string).length).toBeGreaterThan(0);

    const notification = await waitForUserNotification(screenshotFlowId as string, 15_000);

    const params = (notification as { params?: Record<string, unknown> }).params ?? {};
    const screenshotData = params.data as string | undefined;

    // eslint-disable-next-line no-console
    console.log('[UserScreenshotE2E] Screenshot notification params', params);

    expect(typeof screenshotData).toBe('string');
    expect((screenshotData as string).length).toBeGreaterThan(0);
  }, 60_000);
});
