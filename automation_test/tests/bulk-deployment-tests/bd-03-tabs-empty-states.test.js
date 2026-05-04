const { createBulkTest } = require('./bd-shared');
const { createDraftOpenDetail, T } = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 3 — Tabs empty states & batches draft (TC-BULK-INFO-005~007, BATCHES-001/007)', () => {
  test('TC-BULK-INFO-005: Devices tab actions, search, empty state', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DevicesTab ${Date.now()}` });
    await bulkPage.openDevicesTab();

    await test.step('Import CSV, Assign by tag, Add Device, table search', async () => {
      await expect(bulkPage.importCsvButton).toBeVisible();
      await expect(bulkPage.assignByTagButton).toBeVisible();
      await expect(bulkPage.addDeviceButton).toBeVisible();
      await expect(bulkPage.getDeviceTableSearchInput()).toBeVisible();
    });

    await test.step('Empty state when no devices', async () => {
      await bulkPage.expectDevicesEmptyState();
    });
  });

  test('TC-BULK-INFO-006: Apps tab Add App and empty state', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk AppsTab ${Date.now()}` });
    await bulkPage.openAppsTab();

    await test.step('Add App visible with empty table', async () => {
      await expect(bulkPage.addAppButton).toBeVisible();
      await bulkPage.expectAppsEmptyState();
    });
  });

  test('TC-BULK-INFO-007 & TC-BULK-BATCHES-001: Batches metrics zero and empty state', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk BatchesTab ${Date.now()}` });
    await bulkPage.openBatchesTab();

    await test.step('Metric cards visible with zero values', async () => {
      for (const label of [
        T.BATCH_METRIC_TOTAL,
        T.BATCH_METRIC_COMPLETED,
        T.BATCH_METRIC_IN_PROGRESS,
        T.BATCH_METRIC_FAILED,
        T.BATCH_METRIC_CANCELED,
      ]) {
        await expect(bulkPage.getBatchMetricLabel(label)).toBeVisible();
      }
      const metrics = await bulkPage.getBatchMetrics();
      expect(metrics.total).toBe(0);
      expect(metrics.completed).toBe(0);
      expect(metrics.inProgress).toBe(0);
      expect(metrics.failed).toBe(0);
      expect(metrics.canceled).toBe(0);
    });

    await test.step('Empty state for draft', async () => {
      await bulkPage.expectBatchesEmptyState();
    });
  });

  test('TC-BULK-BATCHES-007: Refresh keeps batch metrics visible on draft', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk BatchesRefresh ${Date.now()}` });
    await bulkPage.openBatchesTab();
    const before = await bulkPage.getBatchMetrics();

    await test.step('Reload and reopen Batches tab', async () => {
      await bulkPage.page.reload({ waitUntil: 'domcontentloaded' });
      await bulkPage.waitForPageReady();
      await bulkPage.openBatchesTab();
    });

    await test.step('Metrics still present', async () => {
      const after = await bulkPage.getBatchMetrics();
      expect(after).toEqual(before);
    });
  });
});
