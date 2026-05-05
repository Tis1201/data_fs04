const { createBulkTest, bulkTestData } = require('./bd-shared');
const {
  T,
  createDraftWithAssignments,
  buildFutureSchedulePayload,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-BATCHES after publish', () => {
  test('TC-BULK-BATCHES-002: Batch metric cards visible after publish', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk BatchVis ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.openBatchesTab();
    for (const label of [
      T.BATCH_METRIC_TOTAL,
      T.BATCH_METRIC_COMPLETED,
      T.BATCH_METRIC_IN_PROGRESS,
      T.BATCH_METRIC_FAILED,
      T.BATCH_METRIC_CANCELED,
    ]) {
      await expect(bulkPage.getBatchMetricLabel(label)).toBeVisible();
    }
  });

  test('TC-BULK-BATCHES-003: Status metrics ≤ Total', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk BatchSum ${Date.now()}` },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.openBatchesTab();
    const m = await bulkPage.getBatchMetrics();
    expect(m.completed).toBeLessThanOrEqual(Math.max(m.total, 0));
    expect(m.inProgress).toBeLessThanOrEqual(Math.max(m.total, 0));
    expect(m.failed).toBeLessThanOrEqual(Math.max(m.total, 0));
    expect(m.canceled).toBeLessThanOrEqual(Math.max(m.total, 0));
  });

  test('TC-BULK-BATCHES-004: Batch table headers when batches exist (poll)', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk BatchTbl ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.openBatchesTab();
    await expect
      .poll(async () => (await bulkPage.getBatchMetrics()).total, { timeout: bulkTestData.publishFlowTimeoutMs })
      .toBeGreaterThanOrEqual(0);
    const m = await bulkPage.getBatchMetrics();
    if (m.total > 0) {
      for (const col of [
        T.BATCH_TABLE_COL_NUM,
        T.BATCH_TABLE_COL_BATCH_NAME,
        T.BATCH_TABLE_COL_DEVICES,
        T.BATCH_TABLE_COL_STATUS,
        T.BATCH_TABLE_COL_STARTED_ON,
        T.BATCH_TABLE_COL_END_ON,
      ]) {
        await expect(bulkPage.getBatchTableColumnHeader(col)).toBeVisible();
      }
    }
  });

  test('TC-BULK-BATCHES-005: Future publish — batches may stay zero before start', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk BatchFut ${Date.now()}`, ...future },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.openBatchesTab();
    const m = await bulkPage.getBatchMetrics();
    expect(m.total).toBe(0);
  });

  test('TC-BULK-BATCHES-006: Offline device publish — metrics stay numeric', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk BatchOff ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.offlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.openBatchesTab();
    const m = await bulkPage.getBatchMetrics();
    Object.values(m).forEach((v) => {
      expect(Number.isFinite(v)).toBeTruthy();
      expect(v).toBeGreaterThanOrEqual(0);
    });
  });
});
