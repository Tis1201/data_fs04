#!/usr/bin/env tsx
/**
 * MQTT Worker Load Test for fs04_web
 *
 * Runs total requests with controlled concurrency and ramp-up.
 * Tests factory mint → connect → loopback flow under load.
 *
 * Usage:
 *   pnpm test:mqtt:load                                    # 100 total, 10 concurrent, 5s ramp-up
 *   pnpm test:mqtt:load -- --total=500 --concurrency=20   # 500 total, 20 concurrent, 5s ramp-up
 *   pnpm test:mqtt:load -- --total=1000 --concurrency=50 --ramp=10000  # 1000 total, 50 concurrent, 10s ramp-up
 */

import 'dotenv/config';
import { getAdminPrisma } from '$lib/server/prisma';
import mqtt from 'mqtt';
import { randomUUID } from 'crypto';

const prisma = getAdminPrisma();
const WEB_BASE_URL = process.env.WEB_APP_BASE_URL || 'http://localhost:5173';
const FACTORY_MINT_URL = `${WEB_BASE_URL}/api/device/mqtt/mint/factory`;
const MQTT_DEFAULT_WS_PATH = '/mqtt';

const TOTAL_REQUESTS = parseInt(process.argv.find(a => a.startsWith('--total='))?.split('=')[1] || '100');
const MAX_CONCURRENCY = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '10');
const RAMP_UP_MS = parseInt(process.argv.find(a => a.startsWith('--ramp='))?.split('=')[1] || '5000');
const TIMEOUT_MS = 30000;

interface RunResult {
  index: number;
  success: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Single instance of the factory mint → connect → loopback flow
 */
async function runFactoryLoopbackInstance(
  index: number,
  factoryJwt: string,
): Promise<RunResult> {
  const startTime = Date.now();

  try {
    // 1. Mint factory MQTT credentials
    const response = await fetch(FACTORY_MINT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${factoryJwt}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return { index, success: false, latencyMs: Date.now() - startTime, error: `Mint failed: ${text}` };
    }

    const payload: any = await response.json();
    if (!payload?.success) {
      return { index, success: false, latencyMs: Date.now() - startTime, error: 'Mint response not successful' };
    }

    const data = payload.data;
    const brokerUrl = data.brokerUrl as string;
    const token = data.jwt as string;
    const clientId = data.clientId as string;
    const username = (data.username as string) || clientId;

    // 2. Build MQTT connection URL and topics
    const url = new URL(brokerUrl);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = MQTT_DEFAULT_WS_PATH;
    }
    const connectUrl = url.toString();

    const effectiveId = username || clientId;
    const loopbackTopic = `device/${effectiveId}/loopback`;

    // 3. Connect, subscribe, publish loopback, wait for response
    const result = await new Promise<RunResult>((resolve) => {
      let done = false;

      const timeout = setTimeout(() => {
        if (done) return;
        done = true;
        mqttClient.end(true);
        resolve({ index, success: false, latencyMs: Date.now() - startTime, error: 'Timeout' });
      }, TIMEOUT_MS);

      const mqttClient = mqtt.connect(connectUrl, {
        clientId,
        username,
        password: token,
        protocolVersion: 5,
        clean: true,
        reconnectPeriod: 0,
      });

      mqttClient.on('connect', () => {
        mqttClient.subscribe(loopbackTopic, { qos: 1 }, (err) => {
          if (err) {
            if (!done) {
              done = true;
              clearTimeout(timeout);
              mqttClient.end(true);
              resolve({ index, success: false, latencyMs: Date.now() - startTime, error: `Subscribe failed: ${err.message}` });
            }
            return;
          }

          const loopPayload = { test: 'loopback', ts: Date.now(), index };
          mqttClient.publish(loopbackTopic, JSON.stringify(loopPayload), { qos: 1 }, (err) => {
            if (err && !done) {
              done = true;
              clearTimeout(timeout);
              mqttClient.end(true);
              resolve({ index, success: false, latencyMs: Date.now() - startTime, error: `Publish failed: ${err.message}` });
            }
          });
        });
      });

      mqttClient.on('message', (topic, message) => {
        if (done || topic !== loopbackTopic) return;

        try {
          const data = JSON.parse(message.toString());
          if (data.test === 'loopback' && data.index === index) {
            const latencyMs = Date.now() - startTime;
            done = true;
            clearTimeout(timeout);
            mqttClient.end();
            resolve({ index, success: true, latencyMs });
          }
        } catch {
          // Ignore malformed messages
        }
      });

      mqttClient.on('error', (err) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        mqttClient.end(true);
        resolve({ index, success: false, latencyMs: Date.now() - startTime, error: `MQTT error: ${err.message}` });
      });
    });

    return result;
  } catch (err: any) {
    return { index, success: false, latencyMs: Date.now() - startTime, error: err.message };
  }
}

async function main() {
  console.log(`\n🚀 MQTT Worker Load Test — ${TOTAL_REQUESTS} total requests\n`);
  console.log(`   Max concurrency: ${MAX_CONCURRENCY}`);
  console.log(`   Ramp-up duration: ${RAMP_UP_MS}ms\n`);

  // 1. Get factory token (once, shared by all instances)
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

  const factoryJwt = factoryToken.token;
  console.log('✅ Factory token retrieved\n');

  // 2. Fire requests with gradual ramp-up
  console.log(`📈 Starting ramp-up: 0 → ${MAX_CONCURRENCY} concurrent over ${RAMP_UP_MS}ms\n`);
  
  const startTime = Date.now();
  const results: RunResult[] = [];
  const activePromises = new Map<number, Promise<RunResult>>();
  let startedCount = 0;

  // Ramp up function - start new requests until we reach total
  const scheduleNext = () => {
    if (startedCount >= TOTAL_REQUESTS) return;
    
    // Calculate when to start this request based on ramp-up
    const delay = Math.min((startedCount / MAX_CONCURRENCY) * RAMP_UP_MS, RAMP_UP_MS);
    setTimeout(() => {
      if (startedCount < TOTAL_REQUESTS && activePromises.size < MAX_CONCURRENCY) {
        const promise = runFactoryLoopbackInstance(startedCount, factoryJwt);
        activePromises.set(startedCount, promise);
        startedCount++;
        
        promise.then(result => {
          results.push(result);
          activePromises.delete(result.index);
          
          // Log progress periodically
          if (results.length % 20 === 0 || results.length === TOTAL_REQUESTS) {
            const completed = results.length;
            const active = activePromises.size;
            console.log(`  Progress: ${completed}/${TOTAL_REQUESTS} completed, ${active} active`);
          }
        });
        
        // Schedule next if we haven't reached max concurrency
        if (activePromises.size < MAX_CONCURRENCY && startedCount < TOTAL_REQUESTS) {
          scheduleNext();
        }
      }
    }, delay);
  };

  // Start initial batch
  for (let i = 0; i < Math.min(MAX_CONCURRENCY, TOTAL_REQUESTS); i++) {
    scheduleNext();
  }

  // Continue scheduling as slots become available
  const checkAndSchedule = () => {
    if (startedCount < TOTAL_REQUESTS && activePromises.size < MAX_CONCURRENCY) {
      scheduleNext();
    }
    if (results.length < TOTAL_REQUESTS) {
      setTimeout(checkAndSchedule, 100);
    }
  };
  checkAndSchedule();

  // Wait for all to complete
  while (results.length < TOTAL_REQUESTS) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const totalTime = Date.now() - startTime;

  // 3. Print results
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  const latencies = successes.map(r => r.latencyMs).sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;

  console.log('='.repeat(60));
  console.log('LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total Requests:  ${TOTAL_REQUESTS}`);
  console.log(`  Max Concurrent:  ${MAX_CONCURRENCY}`);
  console.log(`  Ramp-up Time:    ${RAMP_UP_MS}ms`);
  console.log(`  Total time:      ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  Success:         ${successes.length}/${results.length} (${(successes.length / results.length * 100).toFixed(1)}%)`);
  console.log(`  Throughput:      ${(successes.length / (totalTime / 1000)).toFixed(2)} req/s`);
  console.log('');
  console.log('  Latency (ms):');
  console.log(`    Min:  ${latencies[0] || 0}`);
  console.log(`    Avg:  ${avg.toFixed(0)}`);
  console.log(`    p50:  ${p50}`);
  console.log(`    p95:  ${p95}`);
  console.log(`    p99:  ${p99}`);
  console.log(`    Max:  ${latencies[latencies.length - 1] || 0}`);

  if (failures.length > 0) {
    console.log('');
    console.log(`  Failures (${failures.length}):`);
    const errorCounts = new Map<string, number>();
    for (const f of failures) {
      const key = f.error || 'unknown';
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }
    for (const [err, count] of errorCounts) {
      console.log(`    ${err}: ${count}`);
    }
  }

  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
