const { createBulkE2ETest, bulkTestData, T } = require('./bd-e2e-shared');
const {
  createDraftOpenDetail,
  createDraftWithAssignments,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk Deployment action twice', () => {
  test('TC-BULK-E2E-010: Duplicate twice from detail keeps valid Draft copies', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);

    let bulkPage;
    await test.step('Create source draft', async () => {
      const created = await createDraftOpenDetail(page, {
        name: `Bulk E2E DupTwice ${Date.now()}`,
        version: '3.3.3',
      });
      bulkPage = created.bulkPage;
    });

    await test.step('Duplicate #1 and verify draft + version preserved', async () => {
      await bulkPage.duplicateFromDetail();
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_DRAFT);
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '3.3.3');
    });

    await test.step('Duplicate #2 and verify draft + version preserved', async () => {
      await bulkPage.duplicateFromDetail();
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_DRAFT);
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '3.3.3');
    });
  });

  test('TC-BULK-E2E-011: Assign same app twice keeps one row in Apps table', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const app = bulkTestData.digitalSignageAppName;

    let bulkPage;
    await test.step('Create draft with one app assigned', async () => {
      const created = await createDraftWithAssignments(page, {
        payloadOverrides: { name: `Bulk E2E AppTwice ${Date.now()}` },
        appNames: [app],
      });
      bulkPage = created.bulkPage;
    });

    await test.step('Open Add App and assign same app again', async () => {
      await bulkPage.openAddAppModal();
      await bulkPage.selectAppInModal(app);
      const dialog = bulkPage.dialogByTitle(T.DIALOG_ADD_APP);
      await bulkPage.getAssignButton(dialog).click();
      await bulkPage.waitForToastOrNetwork();
    });

    await test.step('Verify app appears once in table', async () => {
      await bulkPage.openAppsTab();
      await expect(bulkPage.getTableRowsByText(app)).toHaveCount(1);
    });
  });

  test('TC-BULK-E2E-012: Assign same device twice keeps one row in Devices table', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const device = bulkTestData.onlineDeviceSearch;

    let bulkPage;
    await test.step('Create draft with one online device assigned', async () => {
      const created = await createDraftWithAssignments(page, {
        payloadOverrides: { name: `Bulk E2E DevTwice ${Date.now()}` },
        deviceNames: [device],
      });
      bulkPage = created.bulkPage;
    });

    await test.step('Reopen Add Device modal and select same device again', async () => {
      await bulkPage.openAddDeviceModal();
      await bulkPage.selectDeviceInModal(device);
      const dialog = bulkPage.dialogByTitle(T.DIALOG_ADD_DEVICE);
      await bulkPage.getAddButton(dialog).click();
      await bulkPage.waitForToastOrNetwork();
    });

    await test.step('Verify device appears once in table', async () => {
      await bulkPage.openDevicesTab();
      await expect(bulkPage.getTableRowsByText(device)).toHaveCount(1);
    });
  });
});
