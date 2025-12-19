import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

/**
 * Shape of EMQX /api/v5/clients items (we only care about a few fields).
 */
interface EmqxClientSummary {
  clientid: string;
  username?: string;
  connected_at?: number;
  node?: string;
}

interface EmqxClientListResponse {
  code?: number;
  data?: EmqxClientSummary[];
}

function getEmqxAdminConfig() {
  const EMQX_URL = process.env.EMQX_URL ?? 'http://localhost:18083';
  const EMQX_API_KEY = process.env.EMQX_API_KEY;
  const EMQX_API_SECRET = process.env.EMQX_API_SECRET;

  if (!EMQX_API_KEY || !EMQX_API_SECRET) {
    logger.warn('[MqttReconcile] EMQX_API_KEY/EMQX_API_SECRET not set; skipping reconciliation');
    return null;
  }

  const baseUrl = EMQX_URL.replace(/\/+$/, '');
  const authHeader =
    'Basic ' + Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');

  return { baseUrl, authHeader };
}

async function fetchAllEmqxClients(baseUrl: string, authHeader: string): Promise<EmqxClientSummary[]> {
  const perPage = 100;
  let page = 1;
  const all: EmqxClientSummary[] = [];

  // Simple pagination loop; EMQX returns { code, data: [] }
  // We stop when data.length < perPage or there is an error.
  // This is similar to the Vitest EMQX admin tests.
  /* eslint-disable no-constant-condition */
  while (true) {
    const url = `${baseUrl}/api/v5/clients?page=${page}&limit=${perPage}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      }
    });

    if (res.status !== 200) {
      logger.error('[MqttReconcile] Failed to fetch EMQX clients', {
        url,
        status: res.status,
        statusText: res.statusText
      });
      break;
    }

    let body: EmqxClientListResponse;
    try {
      body = (await res.json()) as EmqxClientListResponse;
    } catch (err) {
      logger.error('[MqttReconcile] Failed to parse EMQX clients response', {
        url,
        error: err instanceof Error ? err.message : String(err)
      });
      break;
    }

    if (body.code != null && body.code !== 0) {
      logger.error('[MqttReconcile] EMQX returned non-zero code', {
        url,
        code: body.code
      });
      break;
    }

    const batch = Array.isArray(body.data) ? body.data : [];
    all.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }
  /* eslint-enable no-constant-condition */

  return all;
}

/**
 * Reconcile the MqttConnection table against the current EMQX /api/v5/clients view.
 *
 * - For every client returned by EMQX, we upsert a CONNECTED session row by clientId.
 * - For any MqttConnection rows currently marked CONNECTED but not present in EMQX,
 *   we mark them DISCONNECTED with a synthetic reason.
 *
 * NOTE: This is intended to be run on demand (e.g. admin action) as a safety net
 * if MQTT event processing missed some transitions.
 */
export async function reconcileMqttConnections(prismaOverride?: PrismaClient): Promise<void> {
  const config = getEmqxAdminConfig();
  if (!config) {
    return;
  }

  const { baseUrl, authHeader } = config;
  const prisma = prismaOverride ?? getAdminPrisma();

  const clients = await fetchAllEmqxClients(baseUrl, authHeader);
  logger.info('[MqttReconcile] Fetched EMQX clients', { count: clients.length });

  const onlineIds = new Set<string>();
  const now = new Date();

  // Fetch current CONNECTED sessions once so we can mark stale ones DISCONNECTED.
  const existingConnected = await prisma.mqttConnection.findMany({
    where: { status: 'CONNECTED' },
    select: { clientId: true }
  });

  for (const c of clients) {
    if (!c.clientid) continue;

    const clientId = c.clientid;
    const username = c.username ?? '';
    onlineIds.add(clientId);

    const connectedAtMs =
      typeof c.connected_at === 'number' && !Number.isNaN(c.connected_at)
        ? c.connected_at
        : Date.now();
    const connectedAt = new Date(connectedAtMs);

    const kind = username.startsWith('device:')
      ? 'device'
      : username.startsWith('user:')
        ? 'user'
        : 'other';

    await prisma.mqttConnection.upsert({
      where: { clientId },
      create: {
        clientId,
        username,
        kind,
        status: 'CONNECTED',
        connectedAt,
        disconnectedAt: null,
        lastEventAt: connectedAt,
        node: c.node ?? null,
        reason: null
      },
      update: {
        username,
        kind,
        status: 'CONNECTED',
        connectedAt,
        disconnectedAt: null,
        lastEventAt: connectedAt,
        node: c.node ?? null,
        reason: null
      }
    });
  }

  const staleClientIds = existingConnected
    .map((x) => x.clientId)
    .filter((id) => !onlineIds.has(id));

  if (staleClientIds.length > 0) {
    await prisma.mqttConnection.updateMany({
      where: { clientId: { in: staleClientIds } },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: now,
        lastEventAt: now,
        reason: 'reconciled_offline'
      }
    });
  }

  logger.info('[MqttReconcile] Reconciliation complete', {
    onlineCount: clients.length,
    markedOffline: staleClientIds.length
  });
}
