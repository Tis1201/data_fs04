const { createBulkTest, bulkTestData } = require('./bd-shared');
const {
  T,
  createDraftOpenDetail,
  createDraftWithAssignments,
  buildFutureSchedulePayload,
} = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-PUBLISH — detail & list', () => {
  test('TC-BULK-PUBLISH-001: Publish from detail with app + online device', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubDetail ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    const status = await bulkPage.expectStatusBadgeVisible();
    expect(status).not.toBe(T.STATUS_DRAFT);
  });

  test('TC-BULK-PUBLISH-002: Publish with device only (no app) — current product', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubDevOnly ${Date.now()}` },
      appNames: [],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.openAppsTab();
    await bulkPage.expectAppsEmptyState();
    await bulkPage.publishFromDetail();
    const status = await bulkPage.expectStatusBadgeVisible();
    expect(status).not.toBe(T.STATUS_DRAFT);
  });

  test('TC-BULK-PUBLISH-003: Publish with app only (no device) — current product', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubAppOnly ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [],
    });
    await bulkPage.publishFromDetail();
    const status = await bulkPage.expectStatusBadgeVisible();
    expect(status).not.toBe(T.STATUS_DRAFT);
  });

  test('TC-BULK-PUBLISH-004: Publish with Offline device + app', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubOff ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.offlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.openDevicesTab();
    await bulkPage.expectDeviceRowVisible(bulkTestData.offlineDeviceSearch, 'Offline');
  });

  test('TC-BULK-PUBLISH-005: Future schedule publish → Scheduled', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubSched ${Date.now()}`, ...future },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_SCHEDULED);
    const startOn = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
    expect(startOn.length).toBeGreaterThan(4);
  });

  test('TC-BULK-PUBLISH-006: After publish — Publish hidden, Duplicate still available', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubActions ${Date.now()}` },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    expect(await bulkPage.isDetailActionVisible(T.PUBLISH)).toBeFalsy();
    expect(await bulkPage.isDetailActionVisible(T.DUPLICATE)).toBeTruthy();
  });

  test('TC-BULK-PUBLISH-007: List Publish — cancel keeps Draft', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const name = `Bulk ListPubCancel ${Date.now()}`;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.publishFromListByName(name, false);
    await bulkPage.searchDeployment(name);
    const st = await bulkPage.getListCellText(name, 'status');
    expect(st.toLowerCase()).toContain('draft');
  });

  test('TC-BULK-PUBLISH-008: List Publish — confirm leaves Draft row as non-Draft', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const name = `Bulk ListPubOk ${Date.now()}`;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.publishFromListByName(name, true);
    await bulkPage.searchDeployment(name);
    const st = await bulkPage.getListCellText(name, 'status');
    expect(st.toLowerCase()).not.toContain('draft');
  });

  test('TC-BULK-PUBLISH-009: Version unchanged after publish', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const ver = '7.7.2';
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubVer ${Date.now()}`, version: ver },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, ver);
  });

  test('TC-BULK-PUBLISH-010: Custom Batch Size unchanged after publish', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk PubBatch ${Date.now()}`, batchSize: 250 },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '250');
  });
});
