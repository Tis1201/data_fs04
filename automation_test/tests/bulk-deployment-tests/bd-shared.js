/**
 * Shared setup for Bulk Deployment split tests (same idea as device-profiles/dp-shared.js).
 */
const path = require('path');
const base = require('@playwright/test');
const { createBulkPage, deleteTrackedBundlesForPage } = require('../../pages/bulk-deployments/flows');
const config = require('../../config/config-loader');

(function validateBulkDeploymentEnv() {
  if (!config.baseURL) {
    throw new Error('Missing baseURL in config-loader for Bulk Deployment tests.');
  }
})();

const authFile = path.join(__dirname, '..', '..', 'user.json');
const bulkCfg = config.pageURL?.bulkDeployments || {};
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

/** Strings used when assigning apps/devices; override per env in config.pageURL.bulkDeployments */
const bulkTestData = {
  digitalSignageAppName: bulkCfg.digitalSignageAppName || 'Digital Signage',
  counterNowAppName: bulkCfg.counterNowAppName || 'counter_now',
  onlineDeviceSearch: bulkCfg.onlineDeviceSearch || '3576M',
  offlineDeviceSearch: bulkCfg.offlineDeviceSearch || 'DN76',
  /** Optional: open an existing Failed deployment for TC-BULK-INFO-003 / DELETE-007 */
  failedDeploymentId: bulkCfg.failedDeploymentId || process.env.BULK_FAILED_DEPLOYMENT_ID || '',
  /** Long publish / batch waits (ms) */
  publishFlowTimeoutMs: bulkCfg.publishFlowTimeoutMs ?? 10 * 60 * 1000,
  /** Days ahead for Future schedule tests */
  futureScheduleDaysAhead: bulkCfg.futureScheduleDaysAhead ?? 45,
};

function createBulkTest() {
  const test = base.test.extend({
    page: async ({ page }, use) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await use(page);
    },
    bd: async ({ page }, use) => {
      const bd = createBulkPage(page);
      await bd.gotoList();
      await bd.waitForListReady();
      await use(bd);
    },
  });
  test.use({ storageState: authFile });
  test.afterEach(async ({ page }) => {
    await deleteTrackedBundlesForPage(page);
  });
  return test;
}

module.exports = {
  config,
  authFile,
  bulkTestData,
  bulkLimits: BULK_DEPLOYMENT.LIMITS,
  createBulkTest,
};
