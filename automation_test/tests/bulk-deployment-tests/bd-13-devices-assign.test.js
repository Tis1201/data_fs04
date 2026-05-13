const { createBulkTest, bulkTestData } = require('./bd-shared');
const { createDraftOpenDetail, createDraftWithAssignments } = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-DEVICES assign / TC-BULK-CREATE-025~027', () => {
  test('TC-BULK-DEVICES-002 / TC-BULK-CREATE-025: Add online device', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DevOn ${Date.now()}` });
    await bulkPage.addDevicesByNames([bulkTestData.onlineDeviceSearch]);
    await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch);
  });

  test('TC-BULK-DEVICES-003 / TC-BULK-CREATE-026: Add offline device', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DevOff ${Date.now()}` });
    await bulkPage.addDevicesByNames([bulkTestData.offlineDeviceSearch]);
    await bulkPage.expectDeviceRowVisible(bulkTestData.offlineDeviceSearch, 'Offline');
  });

  test('TC-BULK-DEVICES-004 / TC-BULK-CREATE-027: Add online and offline devices', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DevBoth ${Date.now()}` });
    await bulkPage.addDevicesByNames([bulkTestData.onlineDeviceSearch, bulkTestData.offlineDeviceSearch]);
    await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch);
    await bulkPage.expectDeviceRowVisible(bulkTestData.offlineDeviceSearch);
  });

  test('TC-BULK-DEVICES-005: Remove device from Draft', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DevRm ${Date.now()}` },
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.removeDeviceByName(bulkTestData.onlineDeviceSearch);
  });

  test('TC-BULK-DEVICES-006: Search devices table by keyword', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DevSearch ${Date.now()}` },
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.searchDeviceInDeployment(bulkTestData.onlineDeviceSearch);
    await expect(bulkPage.deviceRowByNameOrMac(bulkTestData.onlineDeviceSearch)).toBeVisible();
  });

  test('TC-BULK-DEVICES-009: Add Device modal still usable after device already assigned', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DevDupSel ${Date.now()}` },
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    const dialog = await bulkPage.openAddDeviceModal();
    await expect(bulkPage.getAddDeviceSearchInput()).toBeVisible();
    await bulkPage.getCancelButton(dialog).click();
    await expect(dialog).toBeHidden({ timeout: bulkPage.timeout }).catch(() => {});
  });

  test('TC-BULK-DEVICES-010: Online and Offline status in table', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DevStat ${Date.now()}` },
      deviceNames: [bulkTestData.onlineDeviceSearch, bulkTestData.offlineDeviceSearch],
    });
    await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch, 'Online');
    await bulkPage.expectDeviceRowVisible(bulkTestData.offlineDeviceSearch, 'Offline');
  });
});
