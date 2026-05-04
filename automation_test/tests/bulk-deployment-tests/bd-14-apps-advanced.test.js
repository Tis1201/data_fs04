const { createBulkTest, bulkTestData } = require('./bd-shared');
const { T, createDraftOpenDetail, createDraftWithAssignments } = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-APPS table & remove', () => {
  test('TC-BULK-APPS-005: Remove app from Draft', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const app = bulkTestData.digitalSignageAppName;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk AppRm ${Date.now()}` },
      appNames: [app],
    });
    await bulkPage.removeAppByName(app);
  });

  test('TC-BULK-APPS-006: Search app in Add App modal returns result', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk AppFind ${Date.now()}` });
    await bulkPage.openAddAppModal();
    await bulkPage.searchAppInAddModal(bulkTestData.counterNowAppName);
    await bulkPage.expectAppSearchResultVisible(bulkTestData.counterNowAppName);
    await bulkPage.page.keyboard.press('Escape').catch(() => {});
  });

  test('TC-BULK-APPS-007: Re-open Add App and assign same app — single row in Apps table', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const app = bulkTestData.digitalSignageAppName;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk AppDup ${Date.now()}` },
      appNames: [app],
    });
    await bulkPage.openAddAppModal();
    await bulkPage.selectAppInModal(app);
    const dialog = bulkPage.dialogByTitle(T.DIALOG_ADD_APP);
    await dialog.getByRole('button', { name: T.ASSIGN }).click();
    await bulkPage.waitForToastOrNetwork();
    await bulkPage.openAppsTab();
    await expect(bulkPage.page.locator('tbody tr').filter({ hasText: app })).toHaveCount(1);
  });

  test('TC-BULK-APPS-008: Apps table column headers', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk AppCols ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
    });
    await bulkPage.openAppsTab();
    for (const col of [
      T.APPS_TABLE_COL_APP,
      T.APPS_TABLE_COL_TYPE,
      T.APPS_TABLE_COL_VERSION,
      T.APPS_TABLE_COL_SIZE,
      T.APPS_TABLE_COL_AUTO_OPEN,
      T.APPS_TABLE_COL_ADDED_ON,
      T.APPS_TABLE_COL_ACTIONS,
    ]) {
      await expect(bulkPage.getAppsTableColumnHeader(col)).toBeVisible();
    }
  });

  test('TC-BULK-APPS-009: Auto Open defaults to No for counter_now', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const app = bulkTestData.counterNowAppName;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk AppAuto ${Date.now()}` },
      appNames: [app],
    });
    await bulkPage.openAppsTab();
    const row = bulkPage.rowByText(app);
    await expect(row).toContainText(/no/i);
  });
});
