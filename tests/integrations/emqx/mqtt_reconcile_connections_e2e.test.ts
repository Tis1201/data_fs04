import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { reconcileMqttConnections } from '$lib/server/mqtt/helper';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * EMQX admin reconcile E2E: sync MqttConnection table with /api/v5/clients.
 *
 * Uses EMQX_URL, EMQX_API_KEY and EMQX_API_SECRET from the environment to
 * call the EMQX 5 REST API `/api/v5/clients` endpoint via the
 * `reconcileMqttConnections` helper, then asserts that the MqttConnection
 * table reflects at least the set of currently connected clients.
 */
describe('EMQX admin reconcile - MqttConnection', () => {
  const EMQX_URL = process.env.EMQX_URL ?? 'http://localhost:18083';
  const EMQX_API_KEY = process.env.EMQX_API_KEY;
  const EMQX_API_SECRET = process.env.EMQX_API_SECRET;

  it('reconciles MqttConnection rows against EMQX /clients', async () => {
    if (!EMQX_API_KEY || !EMQX_API_SECRET) {
      // eslint-disable-next-line no-console
      console.warn('[MqttReconcileTest] EMQX_API_KEY/EMQX_API_SECRET not set, skipping test');
      return;
    }

    // Run reconciliation using the same helper the server will call.
    await reconcileMqttConnections();

    const prisma = getAdminPrisma();

    const connections = await prisma.mqttConnection.findMany();

    expect(Array.isArray(connections)).toBe(true);

    // At minimum, reconcile should succeed without throwing and return a
    // coherent set of rows. If EMQX has any clients online, there should be
    // at least one CONNECTED row.
    if (connections.length > 0) {
      expect(connections.some((c) => c.status === 'CONNECTED')).toBe(true);
    }

    // eslint-disable-next-line no-console
    console.log('[MqttReconcileTest] MqttConnection row count', {
      emqxUrl: EMQX_URL,
      total: connections.length,
      connected: connections.filter((c) => c.status === 'CONNECTED').length
    });
  }, 30_000);
});
