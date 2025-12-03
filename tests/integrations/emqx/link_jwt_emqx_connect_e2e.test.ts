import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import jwt, { type Algorithm } from 'jsonwebtoken';
import mqtt, { type IClientOptions } from 'mqtt';

import { getAdminPrisma } from '$lib/server/prisma';

/**
 * E2E: use the fs04_web LINK signing key to sign a JWT and connect to EMQX over WS.
 *
 * Preconditions:
 * - EMQX dev broker running from fs04_iot_core (see packages/app/docker/emqx/docker-compose.yaml)
 *   exposing: ws://localhost:8083/mqtt
 * - At least one active, primary LINK signing key exists in fs04_web.jwtSigningKey
 *   (create via Admin → JWT → Signing Keys with type LINK).
 */

describe('EMQX LINK JWT connect E2E', () => {
  const EMQX_WS_URL = process.env.EMQX_WS_URL ?? 'ws://localhost:8083/mqtt';

  const username = 'link-jwt-emqx-test';
  let clientId: string;
  let token: string;

  beforeAll(async () => {
    const prisma = getAdminPrisma();

    // 1. Load active primary LINK signing key from fs04_web DB
    const linkKey = await prisma.jwtSigningKey.findFirst({
      where: {
        keyType: 'LINK',
        isActive: true,
        isPrimary: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!linkKey) {
      throw new Error('No active primary LINK signing key found; create one in Admin → JWT → Signing Keys');
    }

    // 2. Build a simple MQTT-style payload with EMQX ACL allowing test/link
    clientId = `${username}-${Date.now().toString(16)}`;

    const payload = {
      sub: username,
      client_id: clientId,
      username,
      scope: 'emqx:test',
      // Old EMQX JWT ACL format: allow publish+subscribe on test/link
      acl: {
        pub: ['test/link'],
        sub: ['test/link']
      }
    };

    const algorithm: Algorithm = (linkKey.algorithm || 'RS256') as Algorithm;

    // 3. Sign JWT using the LINK key's private key and keyId
    token = jwt.sign(payload, linkKey.privateKey, {
      algorithm,
      expiresIn: '15m',
      keyid: linkKey.keyId
    });

    const decoded = jwt.decode(token, { complete: true }) as any;
    expect(decoded).toBeTruthy();
    expect(decoded.header.kid).toBe(linkKey.keyId);
  }, 20_000);

  it('connects to EMQX over WebSocket using LINK-key JWT as password', async () => {
    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId,
      username,
      password: token,
      reconnectPeriod: 0,
      connectTimeout: 10_000
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(EMQX_WS_URL, options);

      const connectTimeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Connection timed out'));
        });
      }, 15_000);

      let messageTimeout: ReturnType<typeof setTimeout> | null = null;

      client.on('connect', () => {
        clearTimeout(connectTimeout);
        expect(client.connected).toBe(true);

        const testTopic = 'test/link';
        const testMessage = `hello-from-link-jwt:${Date.now()}`;

        let messageReceived = false;

        // Fail if we don't see our test message in time
        messageTimeout = setTimeout(() => {
          client.end(true, () => {
            reject(new Error('Timed out waiting for test message'));
          });
        }, 10_000);

        client.subscribe(testTopic, { qos: 1 }, (err) => {
          if (err) {
            if (messageTimeout) clearTimeout(messageTimeout);
            client.end(true, () => reject(err));
            return;
          }

          client.publish(testTopic, testMessage, { qos: 1 }, (pubErr) => {
            if (pubErr) {
              if (messageTimeout) clearTimeout(messageTimeout);
              client.end(true, () => reject(pubErr));
            } else {
              // Log published message for debugging
              // eslint-disable-next-line no-console
              console.log('[EMQX LINK JWT] Published', { testTopic, testMessage });
            }
          });
        });

        client.on('message', (topic, payload) => {
          if (messageReceived) return;
          if (topic !== testTopic) return;

          const text = payload.toString();
          expect(text).toBe(testMessage);
          messageReceived = true;

          if (messageTimeout) clearTimeout(messageTimeout);
          // Log received message and close immediately on success
          // eslint-disable-next-line no-console
          console.log('[EMQX LINK JWT] Received', { topic, text });

          client.end(true, () => resolve());
        });
      });

      client.on('error', (err) => {
        clearTimeout(connectTimeout);
        if (messageTimeout) clearTimeout(messageTimeout);
        client.end(true, () => reject(err));
      });
    });
  }, 80_000);

  it('denies subscribe to topics not covered by JWT ACL', async () => {
    const prisma = getAdminPrisma();

    const linkKey = await prisma.jwtSigningKey.findFirst({
      where: {
        keyType: 'LINK',
        isActive: true,
        isPrimary: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!linkKey) {
      throw new Error('No active primary LINK signing key found; create one in Admin → JWT → Signing Keys');
    }

    const deniedUsername = 'link-jwt-emqx-deny-sub';
    const deniedClientId = `${deniedUsername}-${Date.now().toString(16)}`;

    // ACL only allows test/allowed, not test/denied
    const deniedPayload = {
      sub: deniedUsername,
      client_id: deniedClientId,
      username: deniedUsername,
      acl: {
        pub: ['test/allowed'],
        sub: ['test/allowed']
      }
    };

    const algorithm: Algorithm = (linkKey.algorithm || 'RS256') as Algorithm;
    const deniedToken = jwt.sign(deniedPayload, linkKey.privateKey, {
      algorithm,
      expiresIn: '15m',
      keyid: linkKey.keyId
    });

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: deniedClientId,
      username: deniedUsername,
      password: deniedToken,
      reconnectPeriod: 0,
      connectTimeout: 10_000
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(EMQX_WS_URL, options);

      const connectTimeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Connection timed out'));
        });
      }, 15_000);

      const deniedTopic = 'test/denied';

      const finishAsExpected = () => {
        clearTimeout(connectTimeout);
        client.end(true, () => resolve());
      };

      client.on('connect', () => {
        clearTimeout(connectTimeout);

        client.subscribe(deniedTopic, { qos: 1 }, (err) => {
          if (!err) {
            client.end(true, () => {
              reject(new Error('Subscribe unexpectedly succeeded on denied topic'));
            });
            return;
          }

          if (String(err.message || err).includes('Not authorized')) {
            finishAsExpected();
          } else {
            client.end(true, () => reject(err));
          }
        });
      });

      client.on('error', (err) => {
        if (String(err.message || err).includes('Not authorized')) {
          finishAsExpected();
        } else {
          clearTimeout(connectTimeout);
          client.end(true, () => reject(err));
        }
      });
    });
  }, 40_000);

  it('rejects invalid JWT at authentication stage', async () => {
    const prisma = getAdminPrisma();

    const linkKey = await prisma.jwtSigningKey.findFirst({
      where: {
        keyType: 'LINK',
        isActive: true,
        isPrimary: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!linkKey) {
      throw new Error('No active primary LINK signing key found; create one in Admin → JWT → Signing Keys');
    }

    const badUsername = 'link-jwt-emqx-auth-fail';
    const badClientId = `${badUsername}-${Date.now().toString(16)}`;

    const payload = {
      sub: badUsername,
      client_id: badClientId,
      username: badUsername
    };

    const algorithm: Algorithm = (linkKey.algorithm || 'RS256') as Algorithm;
    const validToken = jwt.sign(payload, linkKey.privateKey, {
      algorithm,
      expiresIn: '15m',
      keyid: linkKey.keyId
    });

    // Corrupt the token so signature verification fails
    const invalidToken = validToken.slice(0, -1) + (validToken.endsWith('a') ? 'b' : 'a');

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: badClientId,
      username: badUsername,
      password: invalidToken,
      reconnectPeriod: 0,
      connectTimeout: 10_000
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(EMQX_WS_URL, options);

      const timeout = setTimeout(() => {
        client.end(true, () => {
          resolve(); // If broker silently drops, treat as auth failure
        });
      }, 10_000);

      client.on('connect', () => {
        clearTimeout(timeout);
        client.end(true, () => {
          reject(new Error('Connected successfully with invalid JWT'));
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        const msg = String(err.message || err);
        if (msg.includes('Not authorized') || msg.includes('Connection refused')) {
          client.end(true, () => resolve());
        } else {
          client.end(true, () => reject(err));
        }
      });
    });
  }, 40_000);

  it('denies publish to topics not covered by JWT ACL', async () => {
    const prisma = getAdminPrisma();

    const linkKey = await prisma.jwtSigningKey.findFirst({
      where: {
        keyType: 'LINK',
        isActive: true,
        isPrimary: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!linkKey) {
      throw new Error('No active primary LINK signing key found; create one in Admin → JWT → Signing Keys');
    }

    const pubUsername = 'link-jwt-emqx-deny-pub';
    const pubClientId = `${pubUsername}-${Date.now().toString(16)}`;

    // ACL only allows publishing to test/pub-allowed, not test/pub-denied
    const payload = {
      sub: pubUsername,
      client_id: pubClientId,
      username: pubUsername,
      acl: {
        pub: ['test/pub-allowed'],
        sub: ['test/pub-allowed']
      }
    };

    const algorithm: Algorithm = (linkKey.algorithm || 'RS256') as Algorithm;
    const token = jwt.sign(payload, linkKey.privateKey, {
      algorithm,
      expiresIn: '15m',
      keyid: linkKey.keyId
    });

    const options: IClientOptions = {
      protocolVersion: 5,
      clean: true,
      clientId: pubClientId,
      username: pubUsername,
      password: token,
      reconnectPeriod: 0,
      connectTimeout: 10_000
    };

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(EMQX_WS_URL, options);

      const connectTimeout = setTimeout(() => {
        client.end(true, () => {
          reject(new Error('Connection timed out'));
        });
      }, 15_000);

      const deniedTopic = 'test/pub-denied';

      client.on('connect', () => {
        clearTimeout(connectTimeout);

        client.publish(deniedTopic, 'denied', { qos: 1 }, (err) => {
          if (!err) {
            client.end(true, () => {
              reject(new Error('Publish unexpectedly succeeded on denied topic'));
            });
            return;
          }

          if (String(err.message || err).includes('Not authorized')) {
            client.end(true, () => resolve());
          } else {
            client.end(true, () => reject(err));
          }
        });
      });

      client.on('error', (err) => {
        const msg = String(err.message || err);
        if (msg.includes('Not authorized')) {
          clearTimeout(connectTimeout);
          client.end(true, () => resolve());
        } else {
          clearTimeout(connectTimeout);
          client.end(true, () => reject(err));
        }
      });
    });
  }, 40_000);
});
