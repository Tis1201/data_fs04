const base = require('@playwright/test');
const path = require('path');

const config = require('../../config/config-loader');
const BulkDeploymentPage = require('../../pages/iot/bulk-deployment-page');

function appOrigin(url) {
  if (!url) return '';
  return new URL(url).origin;
}

function buildAuthFile() {
  return path.resolve(__dirname, '..', '..', 'user.json');
}

function buildDeploymentName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `E2E Bulk Deployment ${stamp}`;
}

function buildDraftPayload() {
  return {
    name: buildDeploymentName(),
    targetOS: 'Android',
    version: '1.0.0',
    batchSize: 100,
    schedule: 'None',
    description: 'E2E draft created by automation.',
    rebootDevice: false,
    forceUpdate: false,
  };
}

function validateBulkConfig() {
  if (!config?.baseURL) {
    throw new Error('Missing required config: baseURL (config/environments/<env>.js).');
  }
}

function createBulkPage(page, options = {}) {
  validateBulkConfig();
  return new BulkDeploymentPage(page, {
    appUrl: options.appUrl || appOrigin(config.baseURL),
    deploymentId: options.deploymentId,
    timeout: options.timeout || config?.timeouts?.pageLoadMs || 30000,
    registerDeployment: options.registerDeployment,
  });
}

const test = base.test.extend({
  page: async ({ page }, use) => {
    // Ensure we start from app origin so relative navigation works.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await use(page);
  },
});

const authFile = buildAuthFile();
test.use({ storageState: authFile });

async function openDeploymentForAppsTab(page, registry = {}) {
  const bulkPage = createBulkPage(page, {
    registerDeployment: (created) => {
      registry.lastDeployment = created;
    },
  });

  // Always create a fresh Draft so edit actions (Add App, etc.) are available.
  const created = await bulkPage.createDraftDeployment(buildDraftPayload());
  const deploymentId = created.id;
  await bulkPage.gotoDetail(deploymentId);
  await bulkPage.waitForPageReady();
  await bulkPage.openAppsTab();
  return { bulkPage, deploymentId };
}

module.exports = {
  test,

  testBulkDeploymentAppsTab() {
    test('BD-APPS-001: Open Apps tab and Add App modal works', async ({ page }, testInfo) => {
      test.setTimeout(3 * 60 * 1000);

      const registry = {};
      const { bulkPage } = await openDeploymentForAppsTab(page, registry);

      const dialog = await bulkPage.openAddAppModal();
      await bulkPage.waitForUiSettled();

      await testInfo.attach('bulk-deployment-added-app', {
        body: JSON.stringify({ deploymentId: registry?.lastDeployment?.id || '' }, null, 2),
        contentType: 'application/json',
      });

      await page.keyboard.press('Escape').catch(() => {});
      await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    });

    test('BD-APPS-002: App search empty state renders', async ({ page }) => {
      test.setTimeout(2 * 60 * 1000);
      const { bulkPage } = await openDeploymentForAppsTab(page);

      await bulkPage.openAddAppModal();
      await bulkPage.searchAppInAddModal('zzzz_no_app_12345');
      await bulkPage.getNoAppsMatchText().waitFor({ state: 'visible', timeout: bulkPage.timeout });
    });
  },
};

