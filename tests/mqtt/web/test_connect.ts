import 'dotenv/config';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { mint } from './test_mint';
import { randomUUID } from 'crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function deriveUsernameFromJwt(jwt: string): string {
  try {
    const [, payloadSegment] = jwt.split('.');
    if (!payloadSegment) {
      return 'web-client';
    }

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decodedPayload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as {
      sub?: string;
      email?: string;
      username?: string;
      userId?: string;
      name?: string;
    };

    // For broker auth we want the username to match the JWT subject, just like
    // the device claim test uses the `sub` claim as MQTT username.
    return (
      decodedPayload.sub ??
      decodedPayload.username ??
      decodedPayload.email ??
      decodedPayload.userId ??
      decodedPayload.name ??
      'web-client'
    );
  } catch (err) {
    console.warn('Failed to decode JWT payload, falling back to default username', err);
    return 'web-client';
  }
}

type UserAction =
  | { kind: 'skip' }
  | { kind: 'claim'; pin: string }
  | { kind: 'screenshot'; deviceId: string };

async function promptForAction(): Promise<UserAction> {
  const rl = readline.createInterface({ input, output });
  try {
    const action = await rl.question('Select action: [1] Claim device, [2] Screenshot, [Enter] to skip: ');
    const trimmedAction = action.trim();

    if (trimmedAction === '1') {
      const pin = await rl.question('Enter PIN to claim device: ');
      const trimmed = pin.trim();
      if (!trimmed) {
        return { kind: 'skip' };
      }
      return { kind: 'claim', pin: trimmed };
    }

    if (trimmedAction === '2') {
      const deviceId = await rl.question('Enter deviceId for screenshot: ');
      const trimmedId = deviceId.trim();
      if (!trimmedId) {
        return { kind: 'skip' };
      }
      return { kind: 'screenshot', deviceId: trimmedId };
    }

    return { kind: 'skip' };
  } finally {
    rl.close();
  }
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
};

const pendingRequests = new Map<string, PendingRequest>();

type PendingNotification = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
};

const pendingNotifications = new Map<string, PendingNotification>();

function waitForClaimNotification(requestId: string, timeoutMs = 10_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingNotifications.delete(requestId);
      reject(new Error(`No claim.confirmed notification for requestId ${requestId} within ${timeoutMs}ms`));
    }, timeoutMs);

    pendingNotifications.set(requestId, { resolve, reject, timeout });
  });
}

function sendRpcRequest(
  client: MqttClient,
  clientId: string,
  op: string,
  params: Record<string, any>,
  timeoutMs = 5000
): Promise<any> {
  const requestId = randomUUID();
  const requestPayload = { requestId, op, params };
  const requestTopic = `user/${clientId}/requests`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`RPC timeout for ${op} (${requestId})`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    console.log(`Publishing RPC to ${requestTopic}:`, requestPayload);
    client.publish(requestTopic, JSON.stringify(requestPayload), { qos: 1 });
  });
}

async function testConnect() {
  const { jwt, brokerUrl } = await mint();
  console.log('JWT:', jwt);
  console.log('Broker URL:', brokerUrl);

  const derivedUsername = deriveUsernameFromJwt(jwt);
  console.log('Derived MQTT Username (from sub):', derivedUsername);

  const clientId = derivedUsername;

  const options: IClientOptions = {
    protocolVersion: 5,
    clean: true,
    clientId,
    username: derivedUsername,
    password: jwt,
    reconnectPeriod: 5000,
  };

  // Ensure we use the same /mqtt WebSocket path pattern as the device claim test.
  const url = new URL(brokerUrl);
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/mqtt';
  }

  const connectUrl = url.toString();
  const client = mqtt.connect(connectUrl, options);

  client.on('connect', () => {
    console.log('Connected to broker');
    client.subscribe(`user/${clientId}/requests`);
    client.subscribe(`user/${clientId}/response`);
    client.subscribe(`user/${clientId}/notifications`);

    (async () => {
      // Determine action: prefer CLAIM_PIN env for direct claim, otherwise ask user.
      const envPin = process.env.CLAIM_PIN?.trim();
      let action: UserAction;

      if (envPin && envPin.length > 0) {
        action = { kind: 'claim', pin: envPin };
      } else {
        action = await promptForAction();
      }

      if (action.kind === 'skip') {
        console.log('No action selected, skipping');
        return;
      }

      if (action.kind === 'screenshot') {
        console.log('Screenshot mode selected. Device ID:', action.deviceId);
        console.log('User topics for this session:', {
          requests: `user/${clientId}/requests`,
          response: `user/${clientId}/response`,
          notifications: `user/${clientId}/notifications`,
        });
        console.log('Invoking device.screenshot via RPC...');
        try {
          const screenshotRequestId = randomUUID();
          const result = await sendRpcRequest(client, clientId, 'device.screenshot', {
            deviceId: action.deviceId,
            requestId: screenshotRequestId,
          });
          console.log('device.screenshot result:', result, 'requestId:', screenshotRequestId);
        } catch (err) {
          console.error('device.screenshot error:', err);
        }
        return;
      }

      const pinToUse = action.pin;
      console.log('Using PIN for claim:', pinToUse);
      try {
        const result = await sendRpcRequest(client, clientId, 'device.claim', { pin: pinToUse });
        console.log('Claim result:', result);

        // If the server returned a requestId, wait for a matching
        // claim-confirmed notification so we know the device side
        // has completed the flow.
        const { deviceId, requestId } = result as { deviceId: string; requestId?: string };
        if (requestId) {
          try {
            const notification = await waitForClaimNotification(requestId, 10_000);

            // notification.payload should contain the same requestId and
            // factoryDeviceId that was returned as deviceId from the RPC
            if (
              notification.requestId === requestId &&
              notification.factoryDeviceId === deviceId
            ) {
              console.log('Claim confirmation notification (matched):', notification);
            } else {
              console.warn('Claim confirmation mismatch:', {
                expectedRequestId: requestId,
                expectedFactoryDeviceId: deviceId,
                notification
              });
            }
          } catch (err) {
            console.error('Claim confirmation timeout:', err);
          }
        }
      } catch (err) {
        console.error('Claim error:', err);
      }
    })().catch((err) => {
      console.error('Error during claim flow:', err);
    });
  });

  client.on('message', (topic, payload) => {
    const text = payload.toString();
    console.log(`Received on ${topic}:`, text);

    try {
      const data = JSON.parse(text) as any;

      if (topic.endsWith('/response') && data.requestId && pendingRequests.has(data.requestId)) {
        const entry = pendingRequests.get(data.requestId)!;
        clearTimeout(entry.timeout);
        pendingRequests.delete(data.requestId);

        if (data.error) {
          entry.reject(new Error(String(data.error)));
        } else {
          entry.resolve(data.result);
        }
      } else if (topic.endsWith('/notifications') && data.type === 'claim.confirmed') {
        const notifRequestId: string | undefined = data.payload?.requestId;
        if (notifRequestId && pendingNotifications.has(notifRequestId)) {
          const entry = pendingNotifications.get(notifRequestId)!;
          clearTimeout(entry.timeout);
          pendingNotifications.delete(notifRequestId);
          entry.resolve(data.payload);
        }
      }
    } catch {
      // Non-JSON message; already logged above.
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });

  client.on('close', () => {
    console.log('Disconnected from broker');
  });

  // Keep alive for testing; in real usage you’d handle shutdown
  process.on('SIGINT', () => {
    client.end(true, () => {
      console.log('Client closed');
      process.exit(0);
    });
  });
}

testConnect().catch(console.error);