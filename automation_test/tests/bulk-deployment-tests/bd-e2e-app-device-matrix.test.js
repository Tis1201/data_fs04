const { createBulkE2ETest, bulkTestData } = require('./bd-e2e-shared');
const {
  createDraftOpenDetail,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk app/device matrix (valid, non-existent, same)', () => {
  test('TC-BULK-E2E-030: Add App valid -> table row visible', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const app = bulkTestData.counterNowAppName;

    let bulkPage;
    await test.step('Create draft and add valid app', async () => {
      const created = await createDraftOpenDetail(page, { name: `Bulk E2E AppValid ${Date.now()}` });
      bulkPage = created.bulkPage;
      await bulkPage.addAppsByNames([app]);
    });

    await test.step('Verify app row is visible', async () => {
      await bulkPage.openAppsTab();
      await expect(bulkPage.rowByText(app)).toBeVisible();
    });
  });

  test('TC-BULK-E2E-031: Add App non-existent keyword -> empty state + Assign disabled', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);

    let bulkPage;
    await test.step('Open Add App modal and search unknown app', async () => {
      const created = await createDraftOpenDetail(page, { name: `Bulk E2E AppNoHit ${Date.now()}` });
      bulkPage = created.bulkPage;
      const dialog = await bulkPage.openAddAppModal();
      await bulkPage.searchAppInAddModal(`zz_no_app_${Date.now()}`);
      await expect(bulkPage.getNoAppsMatchText()).toBeVisible();
      await expect(bulkPage.getAssignButton(dialog)).toBeDisabled();
    });
  });

  test('TC-BULK-E2E-032: Add Device valid -> row visible and status shown', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const device = bulkTestData.onlineDeviceSearch;

    let bulkPage;
    await test.step('Create draft and add valid online device', async () => {
      const created = await createDraftOpenDetail(page, { name: `Bulk E2E DevValid ${Date.now()}` });
      bulkPage = created.bulkPage;
      await bulkPage.addDevicesByNames([device]);
    });

    await test.step('Verify device row and status', async () => {
      await bulkPage.openDevicesTab();
      await bulkPage.expectDeviceRowVisible(device);
    });
  });

  test('TC-BULK-E2E-033: Add Device non-existent keyword -> empty state + Add disabled', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);

    let bulkPage;
    await test.step('Open Add Device modal and search unknown device', async () => {
      const created = await createDraftOpenDetail(page, { name: `Bulk E2E DevNoHit ${Date.now()}` });
      bulkPage = created.bulkPage;
      const dialog = await bulkPage.openAddDeviceModal();
      await bulkPage.searchDeviceInAddModal(`zz_no_device_${Date.now()}`);
      await expect(bulkPage.getNoDevicesFoundText()).toBeVisible({ timeout: bulkPage.timeout });
      await expect(bulkPage.getAddButton(dialog)).toBeDisabled();
    });
  });
});
