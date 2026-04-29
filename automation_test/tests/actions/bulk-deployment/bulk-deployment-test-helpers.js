const { test: base, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../config/config-loader');
const BulkDeploymentPage = require('../../pages/iot/bulk-deployment-page');
const {
  setActualResult,
} = require('../support/usecase-annotations');

const authFile = path.resolve(__dirname, '../../user.json');
const appOrigin = 'https://app-dev-v2.datarealities.com';
const apiOrigin = 'https://app-dev-v2.datarealities.com';

const cleanupStateByPage = new WeakMap();

function getCleanupState(page) {
  if (!cleanupStateByPage.has(page)) {
    cleanupStateByPage.set(page, {
      deployments: [],
    });
  }
  return cleanupStateByPage.get(page);
}

function registerCreatedDeployment(page, deployment) {
  if (!page || !deployment?.id) return;

  const state = getCleanupState(page);
  if (state.deployments.some((item) => item.id === deployment.id)) return;

  state.deployments.push({
    id: deployment.id,
    name: deployment.name || '',
  });
}

async function responseSummary(response) {
  if (!response) return 'no response';

  let body = '';
  try {
    body = await response.text();
  } catch (_) {
    body = '';
  }

  return `${response.status()} ${response.statusText()}${body ? ` ${body.slice(0, 300)}` : ''}`;
}

async function requestDeleteBundle(page, deploymentId, apiPath) {
  return page.request.delete(`${apiOrigin}${apiPath}/${deploymentId}`, {
    timeout: config.timeouts?.pageLoadMs || 30000,
  });
}

async function requestStopBundle(page, deploymentId) {
  return page.request.post(`${apiOrigin}/api/v2/bundles/${deploymentId}/stop`, {
    data: {},
    timeout: config.timeouts?.pageLoadMs || 30000,
  });
}

async function cleanupDeploymentByApi(page, deployment) {
  const attempts = [];

  const deletePaths = ['/api/user/iot/bundles', '/api/v2/bundles'];

  for (const deletePath of deletePaths) {
    const deleteResponse = await requestDeleteBundle(page, deployment.id, deletePath);
    attempts.push(`DELETE ${deletePath}/${deployment.id}: ${await responseSummary(deleteResponse)}`);

    if (deleteResponse.ok() || deleteResponse.status() === 404) {
      return { cleaned: true, attempts };
    }
  }

  const stopResponse = await requestStopBundle(page, deployment.id);
  attempts.push(`POST stop ${deployment.id}: ${await responseSummary(stopResponse)}`);

  for (const deletePath of deletePaths) {
    const deleteResponse = await requestDeleteBundle(page, deployment.id, deletePath);
    attempts.push(`DELETE after stop ${deletePath}/${deployment.id}: ${await responseSummary(deleteResponse)}`);

    if (deleteResponse.ok() || deleteResponse.status() === 404) {
      return { cleaned: true, attempts };
    }
  }

  return { cleaned: false, attempts };
}

async function cleanupTrackedBulkDeployments(page, testInfo) {

  const state = cleanupStateByPage.get(page);
  if (!state?.deployments?.length) return;

  const deployments = [...state.deployments].reverse();
  state.deployments = [];

  const cleanupLogs = [];
  const failures = [];

  for (const deployment of deployments) {
    try {
      const result = await cleanupDeploymentByApi(page, deployment);
      cleanupLogs.push(
        `deployment id=${deployment.id}${deployment.name ? ` name="${deployment.name}"` : ''}: ${result.attempts.join(' | ')}`
      );
      if (!result.cleaned) {
        failures.push(`Unable to cleanup deployment id=${deployment.id}${deployment.name ? ` name="${deployment.name}"` : ''}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cleanupLogs.push(`deployment id=${deployment.id}: cleanup threw ${message}`);
      failures.push(`Unable to cleanup deployment id=${deployment.id}: ${message}`);
    }
  }

  if (cleanupLogs.length) {
    await testInfo
      .attach('bulk-deployment-cleanup', {
        body: cleanupLogs.join('\n'),
        contentType: 'text/plain',
      })
      .catch(() => {});
  }

  if (failures.length) {
    throw new Error(`Bulk Deployment cleanup failed:\n${failures.join('\n')}`);
  }
}

const test = base.extend({
  bulkDeploymentCleanup: [
    async ({ page }, use, testInfo) => {
      try {
        await use();
      } finally {
        // 1. Dismiss any open dialogs/toasts before cleanup
        try {
          const openDialogs = page.getByRole('dialog');
          if (await openDialogs.count() > 0) {
            for (const dialog of await openDialogs.all()) {
              const closeBtn = dialog.getByRole('button', { name: /close|cancel|×/i }).first();
              if (await closeBtn.isVisible().catch(() => false)) {
                await closeBtn.click();
                await expect(dialog).toBeHidden({ timeout: 5000 }).catch(() => {});
              }
            }
          }
          // Dismiss any toast notifications
          const toastCloseBtns = page.locator('[data-sonner-toast] button, .toast-close, [aria-label="Close toast"]');
          for (const btn of await toastCloseBtns.all()) {
            await btn.click().catch(() => {});
          }
        } catch (_) {
          // Non-critical: if dialog dismissal fails, continue with cleanup
        }

        // 2. Delete all tracked deployments via API
        await cleanupTrackedBulkDeployments(page, testInfo);

        // 3. Navigate to list page to ensure clean state for next test
        try {
          const appUrl = config.appURL;
          if (appUrl) {
            await page.goto(`${appUrl}/user/iot/bundles`, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            }).catch(() => {});
          }
        } catch (_) {
          // Non-critical: page navigation for cleanup
        }
      }
    },
    { auto: true },
  ],
});

test.use({ storageState: authFile });

const bulkDeploymentConfig = {
  targetDeploymentId: '',
  failedDeploymentId: '',
  inProgressDeploymentId: '',
  publishedDeploymentId: '',
  scheduledDeploymentId: '',
  listPath: '/user/iot/bundles',
  detailPath: '/user/iot/bundles',
  defaultTargetOS: 'Android',
  defaultVersion: '1.0.0',
  defaultBatchSize: '100',
  defaultSchedule: 'None',
  deviceSearchKeyword: '',
  appSearchKeyword: '',
  appDigitalSignage: 'Digital Signage',
  appCounterNow: 'counter_now',
  onlineDeviceName: 'Auto test - 24:1C:04:26:88:E7 - DN74',
  onlineDeviceMac: '24:1C:04:26:88:E7',
  offlineDeviceName: '',
  offlineDeviceMac: '',
  noResultKeyword: `zz_no_bulk_${Date.now()}`,
};

function createBulkDeploymentContext(page) {
  return {
    config,
    bulkDeploymentConfig,
    bulkDeploymentPage: new BulkDeploymentPage(page, {
      appUrl: appOrigin,
      listPath: bulkDeploymentConfig.listPath,
      detailPath: bulkDeploymentConfig.detailPath,
      deploymentId: bulkDeploymentConfig.targetDeploymentId,
      timeout: config.timeouts?.pageLoadMs || 30000,
      registerDeployment: (deployment) => registerCreatedDeployment(page, deployment),
    }),
  };
}

async function openBulkDeploymentDetail(context) {
  await context.bulkDeploymentPage.openExistingDeploymentOrCreateDraft(createDeploymentData('info'));
  await context.bulkDeploymentPage.waitForPageReady();
}

function uniqueSuffix(label = 'case') {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createDeploymentData(label = 'draft', overrides = {}) {
  const name = overrides.name || `Bulk Auto ${uniqueSuffix(label)}`;
  return {
    name,
    targetOS: bulkDeploymentConfig.defaultTargetOS,
    version: bulkDeploymentConfig.defaultVersion,
    batchSize: bulkDeploymentConfig.defaultBatchSize,
    schedule: bulkDeploymentConfig.defaultSchedule,
    description: '',
    rebootDevice: false,
    forceUpdate: false,
    ...overrides,
  };
}

function makeString(length, character = 'A') {
  return Array.from({ length }, () => character).join('');
}

function futureScheduleDate(daysFromNow = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: '09:00',
  };
}

async function createDraftWithAppsAndDevices(context, label, options = {}) {
  const data = createDeploymentData(label, options.data || {});
  const created = await context.bulkDeploymentPage.createDraftDeployment(data);
  const deviceNames = options.deviceNames || [bulkDeploymentConfig.onlineDeviceName];
  const appNames = options.appNames || [bulkDeploymentConfig.appDigitalSignage];

  if (deviceNames.length > 0) {
    await context.bulkDeploymentPage.addDevicesByNames(deviceNames);
  }
  if (appNames.length > 0) {
    await context.bulkDeploymentPage.addAppsByNames(appNames);
  }

  return {
    ...created,
    data,
    deviceNames,
    appNames,
  };
}

module.exports = {
  test,
  expect,
  config,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  createDraftWithAppsAndDevices,
  cleanupTrackedBulkDeployments,
  futureScheduleDate,
  makeString,
  openBulkDeploymentDetail,
  setActualResult,
};
