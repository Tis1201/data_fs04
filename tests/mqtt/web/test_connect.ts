import mqtt, { type IClientOptions } from 'mqtt';
import { mint } from './test_mint';

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
    client.subscribe(`${clientId}/requests`);
    client.subscribe(`${clientId}/response`);
    client.subscribe(`${clientId}/notifications`);
  });

  client.on('message', (topic, payload) => {
    console.log(`Received on ${topic}:`, payload.toString());
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