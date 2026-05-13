import 'dotenv/config';
import { describe, expect, it } from 'vitest';

/**
 * EMQX admin API E2E: list online clients.
 *
 * Uses EMQX_URL, EMQX_API_KEY and EMQX_API_SECRET from the environment to
 * call the EMQX 5 REST API `/api/v5/clients` endpoint and asserts we can
 * retrieve and parse the clients list.
 */
describe('EMQX admin API - list clients', () => {
  const EMQX_URL = process.env.EMQX_URL ?? 'http://localhost:18083';
  const EMQX_API_KEY = process.env.EMQX_API_KEY;
  const EMQX_API_SECRET = process.env.EMQX_API_SECRET;

  it('fetches list of clients from EMQX', async () => {
    if (!EMQX_API_KEY || !EMQX_API_SECRET) {
      // eslint-disable-next-line no-console
      console.warn('[EMQX admin] EMQX_API_KEY/EMQX_API_SECRET not set, skipping test');
      return;
    }

    const baseUrl = EMQX_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/api/v5/clients`;

    const auth = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json'
      }
    });

    expect(res.status).toBe(200);

    const body: any = await res.json();

    expect(body).toBeTruthy();
    if (Object.prototype.hasOwnProperty.call(body, 'code')) {
      expect(body.code).toBe(0);
    }

    // EMQX returns an array of clients under `data`
    expect(Array.isArray(body.data)).toBe(true);

    // eslint-disable-next-line no-console
    console.log('[EMQX admin] online clients count', body.data.length);
  }, 20_000);

  it('fetches paged list of clients from EMQX (page=1, limit=1)', async () => {
    if (!EMQX_API_KEY || !EMQX_API_SECRET) {
      // eslint-disable-next-line no-console
      console.warn('[EMQX admin] EMQX_API_KEY/EMQX_API_SECRET not set, skipping test');
      return;
    }

    const baseUrl = EMQX_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/api/v5/clients?page=1&limit=1`;

    const auth = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json'
      }
    });

    expect(res.status).toBe(200);

    const body: any = await res.json();

    expect(body).toBeTruthy();
    if (Object.prototype.hasOwnProperty.call(body, 'code')) {
      expect(body.code).toBe(0);
    }

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(1);

    // eslint-disable-next-line no-console
    console.log('[EMQX admin] paged clients count', body.data.length);
  }, 20_000);

  it('fetches all clients via pagination until complete', async () => {
    if (!EMQX_API_KEY || !EMQX_API_SECRET) {
      // eslint-disable-next-line no-console
      console.warn('[EMQX admin] EMQX_API_KEY/EMQX_API_SECRET not set, skipping test');
      return;
    }

    const baseUrl = EMQX_URL.replace(/\/+$/, '');
    const auth = Buffer.from(`${EMQX_API_KEY}:${EMQX_API_SECRET}`).toString('base64');

    // First, fetch the full list once to know how many clients we expect.
    const fullRes = await fetch(`${baseUrl}/api/v5/clients`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json'
      }
    });

    expect(fullRes.status).toBe(200);
    const fullBody: any = await fullRes.json();
    expect(fullBody).toBeTruthy();
    if (Object.prototype.hasOwnProperty.call(fullBody, 'code')) {
      expect(fullBody.code).toBe(0);
    }

    const fullData: any[] = Array.isArray(fullBody.data) ? fullBody.data : [];
    const expectedTotal = fullData.length;

    const limit = 1;
    let page = 1;
    const collected: any[] = [];

    // Safety guard to avoid infinite loops in case of unexpected API behavior.
    const maxPages = expectedTotal + 5;

    while (collected.length < expectedTotal && page <= maxPages) {
      const url = `${baseUrl}/api/v5/clients?page=${page}&limit=${limit}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json'
        }
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toBeTruthy();
      if (Object.prototype.hasOwnProperty.call(body, 'code')) {
        expect(body.code).toBe(0);
      }

      const pageData: any[] = Array.isArray(body.data) ? body.data : [];
      if (pageData.length === 0) {
        break;
      }

      collected.push(...pageData);
      page += 1;
    }

    expect(collected.length).toBeGreaterThanOrEqual(expectedTotal);

    // eslint-disable-next-line no-console
    console.log('[EMQX admin] pagination summary', {
      expectedTotal,
      pagesFetched: page - 1,
      collected: collected.length
    });
  }, 30_000);
});
