const path = require('path');
const base = require('@playwright/test');
const {
  createPinRulesPage,
  deleteTrackedPinRulesForPage,
  deletePinRulesByNamePrefix,
} = require('../../pages/app-pinning-rules/flows');

const authFile = path.join(__dirname, '..', '..', 'user.json');

function createAppPinningRulesE2ETest() {
  const test = base.test.extend({
    page: async ({ page }, use) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await use(page);
    },
    pinRules: async ({ page }, use) => {
      const pinRules = createPinRulesPage(page);
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      await use(pinRules);
    },
  });

  test.use({ storageState: authFile });
  test.beforeEach(async ({ page }) => {
    await deletePinRulesByNamePrefix(page);
  });
  test.afterEach(async ({ page }) => {
    await deleteTrackedPinRulesForPage(page);
    await deletePinRulesByNamePrefix(page);
  });

  return test;
}

module.exports = {
  createAppPinningRulesE2ETest,
  expect: base.expect,
};
