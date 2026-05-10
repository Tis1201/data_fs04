const config = require('../../config/config-loader');
const { expect } = require('@playwright/test');
const AppPinningRulesPage = require('./app-pinning-rules-page');

const trackedRuleIds = [];
const PIN_RULE_PREFIX = 'PIN E2E';

function appOrigin() {
  if (!config?.baseURL) {
    throw new Error('Missing required config: baseURL');
  }
  return new URL(config.baseURL).origin;
}

function createPinRulesPage(page) {
  return new AppPinningRulesPage(page, {
    appUrl: appOrigin(),
    timeout: config.timeouts?.pageLoadMs || 30000,
  });
}

function trackPinRuleId(id) {
  if (id && typeof id === 'string' && !trackedRuleIds.includes(id)) {
    trackedRuleIds.push(id);
  }
}

function takeTrackedRuleIds() {
  const ids = [...trackedRuleIds];
  trackedRuleIds.length = 0;
  return ids;
}

async function getFirstAvailableAppPackage(page) {
  const origin = appOrigin();
  const res = await page.request.get(`${origin}/api/v2/resources/apps?page=1&pageSize=20&sort=createdAt&order=desc`);
  if (!res.ok()) {
    throw new Error(`Unable to load app resources for pin rule test. Status: ${res.status()}`);
  }
  const body = await res.json();
  const items = body?.data?.items || body?.items || [];
  const app = items.find((item) => item?.packageName);
  if (!app?.packageName) {
    throw new Error('No app resource with packageName is available for pin rule tests.');
  }
  return app.packageName;
}

async function getFirstInstalledAppForDevice(page, deviceId, preferredPackage = '') {
  const origin = appOrigin();
  const res = await page.request.get(
    `${origin}/api/v2/devices/${encodeURIComponent(deviceId)}/apps-with-pins?page=1&limit=50&sortBy=name&sortOrder=asc`
  );
  if (!res.ok()) {
    throw new Error(`Unable to load installed apps for device "${deviceId}". Status: ${res.status()}`);
  }
  const body = await res.json().catch(() => ({}));
  const apps = body?.data?.apps || body?.data?.items || body?.apps || body?.items || [];
  const installedApps = apps
    .map((app) => ({
      ...app,
      appName: app.app_name || app.appName,
      packageName: app.package_name || app.packageName,
      isPinned: app.isPinned ?? app.is_pinned ?? false,
    }))
    .filter((app) => app.packageName);
  const preferred = preferredPackage
    ? installedApps.find((app) => app.packageName === preferredPackage)
    : null;
  const app = preferred || installedApps.find((item) => item.app_type !== 'System' && item.appType !== 'System') || installedApps[0];
  if (!app?.packageName) {
    throw new Error(`No installed app package is available for device "${deviceId}".`);
  }
  return app;
}

async function createPinRuleViaApi(page, overrides = {}) {
  const origin = appOrigin();
  const appPackage = overrides.appPackage || await getFirstAvailableAppPackage(page);
  const payload = {
    ruleType: 'user_custom',
    name: overrides.name || `${PIN_RULE_PREFIX} ${Date.now()}`,
    description: overrides.description ?? 'Created by App Pinning Rules E2E automation',
    apps: overrides.apps || [appPackage],
    targetType: overrides.targetType || 'all',
    targetValue: overrides.targetValue || [],
    isActive: overrides.isActive ?? true,
    isDraft: overrides.isDraft ?? false,
  };

  const res = await page.request.post(`${origin}/api/v2/pin-rules`, { data: payload });
  const body = await res.json().catch(() => ({}));
  if (!res.ok() || body?.success !== true) {
    throw new Error(`Failed to create pin rule via API. Status: ${res.status()}, body: ${JSON.stringify(body)}`);
  }

  const rule = body?.data?.rule || body?.rule;
  trackPinRuleId(rule?.id);
  return { rule, payload };
}

async function expectDeviceAppPinned(page, deviceId, packageName, options = {}) {
  const origin = appOrigin();
  const timeout = options.timeout || config.timeouts?.pageLoadMs || 30000;
  await expect
    .poll(
      async () => {
        const res = await page.request.get(
          `${origin}/api/v2/devices/${encodeURIComponent(deviceId)}/apps-with-pins?page=1&limit=50&sortBy=name&sortOrder=asc`
        );
        const body = await res.json().catch(() => ({}));
        const apps = body?.data?.apps || body?.data?.items || body?.apps || body?.items || [];
        const app = apps.find((item) => (item.package_name || item.packageName) === packageName);
        return Boolean(app && (app.isPinned ?? app.is_pinned));
      },
      {
        timeout,
        intervals: [1000, 2000, 5000],
        message: `Expected package "${packageName}" to be pinned on device "${deviceId}"`,
      }
    )
    .toBe(true);
}

async function openDeviceResourcesTab(page, deviceId) {
  const origin = appOrigin();
  await page.goto(`${origin}/user/iot/devices/${encodeURIComponent(deviceId)}?tab=resources`, {
    waitUntil: 'domcontentloaded',
    timeout: config.timeouts?.pageLoadMs || 30000,
  });

  const resourcesTab = page
    .getByRole('button', { name: /^(Resources|Installed Apps)$/ })
    .or(page.getByRole('tab', { name: /^(Resources|Installed Apps)$/ }));
  await expect(resourcesTab).toBeVisible({ timeout: config.timeouts?.pageLoadMs || 30000 });
  await resourcesTab.click().catch(() => null);

  const resourcesHeading = page
    .getByRole('heading', { name: /^(Installed Resources|Installed Apps)$/ })
    .or(page.getByText(/List of installed (resources|apps)\. Pinned apps are shown first\./));
  await expect(resourcesHeading.first()).toBeVisible({ timeout: config.timeouts?.pageLoadMs || 30000 });
}

async function expectPinnedAppVisibleInDeviceResources(page, packageName, appName = '') {
  const searchInput = page.getByPlaceholder(/Search by name or package/i);
  await expect(searchInput).toBeVisible({ timeout: config.timeouts?.pageLoadMs || 30000 });
  await searchInput.fill(packageName);

  const row = page.locator('tbody tr').filter({ hasText: packageName }).first();
  await expect(row).toBeVisible({ timeout: config.timeouts?.pageLoadMs || 30000 });
  if (appName) {
    await expect(row).toContainText(appName);
  }

  const pinIcon = row.locator('td[data-ds-col-id="pin"] svg').first().or(row.locator('td').first().locator('svg').first());
  await expect(pinIcon).toBeVisible({ timeout: config.timeouts?.pageLoadMs || 30000 });
  await expect
    .poll(
      async () => (await pinIcon.getAttribute('fill').catch(() => '')) || '',
      {
        timeout: config.timeouts?.pageLoadMs || 30000,
        message: `Expected package "${packageName}" to show filled pin icon in device Resources tab`,
      }
    )
    .toMatch(/^(?!none$).+/);
}

async function deletePinRuleById(page, id) {
  if (!id) return { deleted: true, status: 0, body: '' };
  const origin = appOrigin();
  const res = await page.request.delete(`${origin}/api/v2/pin-rules/${encodeURIComponent(id)}`);
  const status = res.status();
  const body = await res.text().catch(() => '');
  return {
    deleted: status === 200 || status === 204 || status === 404,
    status,
    body,
  };
}

async function deleteTrackedPinRulesForPage(page) {
  const ids = takeTrackedRuleIds();
  const failures = [];
  for (const id of ids.reverse()) {
    let lastError = '';
    await expect
      .poll(
        async () => {
          const result = await deletePinRuleById(page, id).catch((error) => {
            lastError = error instanceof Error ? error.message : String(error);
            return { deleted: false, status: 0, body: '' };
          });
          if (result.deleted) {
            return true;
          }
          lastError = `DELETE returned ${result.status}${result.body ? `: ${result.body.slice(0, 250)}` : ''}`;
          return false;
        },
        {
          timeout: config.pageURL?.appPinningRules?.cleanupTimeoutMs ?? 60 * 1000,
          intervals: [1000, 3000, 5000],
          message: `Expected tracked App Pinning Rule "${id}" to be deleted`,
        }
      )
      .toBe(true)
      .catch(() => {
        failures.push(`${id}: ${lastError || 'cleanup timed out'}`);
      });
  }
  if (failures.length) {
    throw new Error(`App Pinning Rules cleanup failed:\n${failures.join('\n')}`);
  }
}

async function deletePinRulesByNamePrefix(page, prefix = PIN_RULE_PREFIX) {
  const origin = appOrigin();
  const res = await page.request.get(`${origin}/api/v2/pin-rules?search=${encodeURIComponent(prefix)}`).catch(() => null);
  if (!res || !res.ok()) return;
  const body = await res.json().catch(() => ({}));
  const rules = body?.data?.rules || body?.rules || [];
  const failures = [];
  for (const rule of rules) {
    if (rule?.id && String(rule.name || '').startsWith(prefix) && rule.ruleType !== 'user_default') {
      const result = await deletePinRuleById(page, rule.id).catch((error) => ({
        deleted: false,
        status: 0,
        body: error instanceof Error ? error.message : String(error),
      }));
      if (!result.deleted) {
        failures.push(`${rule.id} (${rule.name}): DELETE returned ${result.status}${result.body ? `: ${result.body.slice(0, 250)}` : ''}`);
      }
    }
  }

  const verify = await page.request.get(`${origin}/api/v2/pin-rules?search=${encodeURIComponent(prefix)}`).catch(() => null);
  if (!verify || !verify.ok()) {
    if (failures.length) {
      throw new Error(`App Pinning Rules cleanup failed:\n${failures.join('\n')}`);
    }
    return;
  }
  const verifyBody = await verify.json().catch(() => ({}));
  const remaining = (verifyBody?.data?.rules || verifyBody?.rules || [])
    .filter((rule) => rule?.id && String(rule.name || '').startsWith(prefix) && rule.ruleType !== 'user_default');
  if (failures.length || remaining.length) {
    throw new Error(
      [
        'App Pinning Rules cleanup failed:',
        ...failures,
        ...remaining.map((rule) => `${rule.id} (${rule.name}): still present after cleanup`),
      ].join('\n')
    );
  }
}

module.exports = {
  PIN_RULE_PREFIX,
  appOrigin,
  createPinRulesPage,
  createPinRuleViaApi,
  deleteTrackedPinRulesForPage,
  deletePinRulesByNamePrefix,
  getFirstAvailableAppPackage,
  getFirstInstalledAppForDevice,
  expectDeviceAppPinned,
  openDeviceResourcesTab,
  expectPinnedAppVisibleInDeviceResources,
  trackPinRuleId,
};
