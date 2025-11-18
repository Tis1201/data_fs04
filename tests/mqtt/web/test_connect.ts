import mqtt, { type IClientOptions } from 'mqtt';

const BROKER_URL = 'ws://localhost:8080/mqtt';
const DEVICE_ID = '8cea34ef-07c8-461a-9b69-02ff6e460260';
const X_API_KEY = 'qi3hh86phpx5hhnu8wzsc58vfz7trv8u'

async function mint(): Promise<string> {
  const res = await fetch('http://localhost:5173/api/device/mqtt/mint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': X_API_KEY,
    },
  });
  if (!res.ok) throw new Error(`Mint failed: ${res.status}`);
  const body = await res.json();
  return (body as { data: { jwt: string } }).data.jwt;
}

async function testConnect() {
  const token = await mint();
  console.log('JWT:', token);

  const options: IClientOptions = {
    protocolVersion: 5,
    clean: true,
    clientId: DEVICE_ID,
    username: DEVICE_ID,
    password: token,
    reconnectPeriod: 5000,
  };

  const client = mqtt.connect(BROKER_URL, options);

  client.on('connect', () => {
    console.log('Connected to broker');
    client.subscribe(`${DEVICE_ID}/#`);
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