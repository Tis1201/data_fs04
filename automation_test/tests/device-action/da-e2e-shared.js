/**
 * Shared Playwright test factory for Device Action E2E specs.
 * Centralizes storage state + initial navigation per project Playwright rules.
 */
const base = require('@playwright/test');
const { authFile } = require('./device-actions-shared');

/**
 * @returns {import('@playwright/test').TestType} Extended test with page.goto('/') and storageState.
 */
function createDeviceActionTest() {
  const extendedTest = base.test.extend({
    page: async ({ page }, use) => {
      await page.goto('/');
      await use(page);
    },
  });
  extendedTest.use({ storageState: authFile });
  return extendedTest;
}

module.exports = {
  createDeviceActionTest,
  expect: base.expect,
};
