import 'dotenv/config';

const BASE_URL = process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173';
const USERNAME = process.env.SAMPLE_USER_USERNAME ?? 'admin@admin.com';
const PASSWORD = process.env.SAMPLE_USER_PASSWORD ?? 'admin0823';

const LOGIN_URL = `${BASE_URL}/auth/login?/login`;
const MINT_URL = `${BASE_URL}/api/user/mqtt/mint`;

console.info(`Minting MQTT credentials for user ${USERNAME}:${PASSWORD}`);

export interface MintResult {
  jwt: string;
  brokerUrl: string;
  mqttUsername?: string;
}

async function loginAndGetCookie(): Promise<string> {
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

  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error(`Failed to parse login JSON: ${(await res.text()).slice(0, 200)}`);
  }

  if (res.status !== 200 || json?.type !== 'success') {
    throw new Error(`Login failed: status=${res.status}, body=${JSON.stringify(json).slice(0, 200)}`);
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

async function mintUserMqtt(cookie: string): Promise<MintResult> {
  const res = await fetch(MINT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify({})
  });

  const payload: any = await res.json();

  if (!payload?.success) {
    throw new Error(`Mint failed: ${JSON.stringify(payload)}`);
  }

  const data = payload.data ?? {};
  const jwt = data.jwt as string | undefined;
  const brokerUrl = data.brokerUrl as string | undefined;
//   const mqttUsername = data.mqttUsername as string | undefined;

  if (!jwt || !brokerUrl) {
    throw new Error(`Mint response missing jwt or brokerUrl: ${JSON.stringify(payload)}`);
  }

  return { jwt, brokerUrl };
}

export async function mint(): Promise<MintResult> {
  const cookie = await loginAndGetCookie();
  return mintUserMqtt(cookie);
}

const result = await mint();

console.log(result);

// Pretty-print JWT claims for inspection
try {
  const parts = result.jwt.split('.');
  if (parts.length === 3) {
    const payload = parts[1];
    const json = Buffer.from(payload, 'base64').toString('utf8');
    const claims = JSON.parse(json);
    console.log('JWT claims:', claims);
  } else {
    console.warn('Unexpected JWT format');
  }
} catch (err) {
  console.error('Failed to decode JWT claims:', err);
}