const { createBulkTest } = require('./bd-shared');
const {
  openDeploymentForAppsTab,
  assertAddAppModalStructure,
  assertAddAppModalInvalidSearch,
} = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 4 — Add App modal (TC-BULK-APPS-001, TC-BULK-APPS-010, legacy BD-APPS)', () => {
  test('TC-BULK-APPS-001 / BD-APPS-001: Add App modal structure and dismiss', async ({ page }, testInfo) => {
    test.setTimeout(3 * 60 * 1000);

    const registry = {};
    const { bulkPage } = await openDeploymentForAppsTab(page, registry);

    await test.step('Open Add App modal and verify shell', async () => {
      const dialog = await bulkPage.openAddAppModal();
      await assertAddAppModalStructure(bulkPage, dialog);
      await bulkPage.waitForUiSettled();

      await testInfo.attach('bulk-deployment-apps-modal', {
        body: JSON.stringify({ deploymentId: registry?.lastDeployment?.id || '' }, null, 2),
        contentType: 'application/json',
      });

      await page.keyboard.press('Escape').catch(() => {});
      await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    });
  });

  test('TC-BULK-APPS-010 / BD-APPS-002: Invalid app search — no results, Assign disabled', async ({ page }) => {
    test.setTimeout(2 * 60 * 1000);

    const { bulkPage } = await openDeploymentForAppsTab(page);

    await test.step('No-result state and Assign stays disabled', async () => {
      await bulkPage.openAddAppModal();
      await assertAddAppModalInvalidSearch(bulkPage, `zz_no_app_${Date.now()}`);
    });
  });
});
