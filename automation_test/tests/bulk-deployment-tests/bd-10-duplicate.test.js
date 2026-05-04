const { createBulkTest, bulkTestData } = require('./bd-shared');
const { T, createDraftOpenDetail, createDraftWithAssignments } = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-DUPLICATE', () => {
  test('TC-BULK-DUPLICATE-001: Cancel duplicate stays on same deployment', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DupCancel ${Date.now()}` });
    const urlBefore = bulkPage.page.url();
    await bulkPage.cancelDuplicateFromDetail();
    expect(bulkPage.page.url()).toBe(urlBefore);
  });

  test('TC-BULK-DUPLICATE-002: Confirm duplicate opens new Draft detail URL', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DupOk ${Date.now()}` });
    const beforeId = bulkPage.getDeploymentIdFromUrl();
    const newId = await bulkPage.duplicateFromDetail();
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(beforeId);
    expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_DRAFT);
  });

  test('TC-BULK-DUPLICATE-003: Duplicated deployment copies overview fields', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const desc = `Dup source ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk DupFields ${Date.now()}`,
      description: desc,
      rebootDevice: true,
      forceUpdate: true,
    });
    await bulkPage.duplicateFromDetail();
    const dupDesc = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION);
    expect(dupDesc).toContain(desc.slice(0, 12));
    await expect.poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE)).toMatch(/enable/i);
  });

  test('TC-BULK-DUPLICATE-004: Duplicated deployment copies Version', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk DupVer ${Date.now()}`,
      version: '9.1.0',
    });
    await bulkPage.duplicateFromDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '9.1.0');
  });

  test('TC-BULK-DUPLICATE-005: Duplicate copies assigned apps', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DupApps ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName, bulkTestData.counterNowAppName],
      deviceNames: [],
    });
    await bulkPage.duplicateFromDetail();
    await bulkPage.openAppsTab();
    await expect(bulkPage.rowByText(bulkTestData.digitalSignageAppName)).toBeVisible();
    await expect(bulkPage.rowByText(bulkTestData.counterNowAppName)).toBeVisible();
  });

  test('TC-BULK-DUPLICATE-006: Duplicate copies assigned devices', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DupDev ${Date.now()}` },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch, bulkTestData.offlineDeviceSearch],
    });
    await bulkPage.duplicateFromDetail();
    await bulkPage.openDevicesTab();
    await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch);
    await bulkPage.expectDeviceRowVisible(bulkTestData.offlineDeviceSearch);
  });

  test('TC-BULK-DUPLICATE-007: Duplicated name is traceable (contains Copy)', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const base = `Bulk DupTrace ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name: base });
    await bulkPage.duplicateFromDetail();
    const dupName = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME);
    expect(dupName.toLowerCase()).toContain('copy');
    expect(dupName.length).toBeGreaterThan(base.length - 2);
  });

  test('TC-BULK-DUPLICATE-008: Duplicated Draft has zero batches', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DupBatch ${Date.now()}` });
    await bulkPage.duplicateFromDetail();
    await bulkPage.openBatchesTab();
    const m = await bulkPage.getBatchMetrics();
    expect(m.total).toBe(0);
    await bulkPage.expectBatchesEmptyState();
  });
});
