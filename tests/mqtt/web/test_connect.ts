import 'dotenv/config';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { mint } from './test_mint';
import { randomUUID } from 'crypto';

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

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
};

const pendingRequests = new Map<string, PendingRequest>();

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

    const pin = process.env.CLAIM_PIN;
    if (pin) {
      sendRpcRequest(client, clientId, 'web.claim.device', { pin })
        .then((result) => {
          console.log('Claim result:', result);
        })
        .catch((err) => {
          console.error('Claim error:', err);
        });
    }
  });

  client.on('message', (topic, payload) => {
    const text = payload.toString();
    console.log(`Received on ${topic}:`, text);

    try {
      const data = JSON.parse(text) as {
        requestId?: string;
        result?: any;
        error?: any;
      };

      if (topic.endsWith('/response') && data.requestId && pendingRequests.has(data.requestId)) {
        const entry = pendingRequests.get(data.requestId)!;
        clearTimeout(entry.timeout);
        pendingRequests.delete(data.requestId);

        if (data.error) {
          entry.reject(new Error(String(data.error)));
        } else {
          entry.resolve(data.result);
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