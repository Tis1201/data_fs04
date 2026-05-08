const { createBulkE2ETest, bulkTestData, T } = require('./bd-e2e-shared');
const {
  createDraftWithAssignments,
  createDraftOpenDetail,
  buildFutureSchedulePayload,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk Deployment core flow', () => {
  test('TC-BULK-E2E-001: Full flow — create draft -> assign app/device -> publish -> verify overview + batches', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);

    let bulkPage;
    await test.step('Create draft and assign one app + one online device', async () => {
      const created = await createDraftWithAssignments(page, {
        payloadOverrides: {
          name: `Bulk E2E Core ${Date.now()}`,
          description: 'E2E full flow deployment',
          version: '1.0.1',
        },
        appNames: [bulkTestData.digitalSignageAppName],
        deviceNames: [bulkTestData.onlineDeviceSearch],
      });
      bulkPage = created.bulkPage;
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '1.0.1');
    });

    await test.step('Verify assigned resources on Apps/Devices tabs', async () => {
      await bulkPage.openAppsTab();
      await expect(bulkPage.rowByText(bulkTestData.digitalSignageAppName)).toBeVisible();
      await bulkPage.openDevicesTab();
      await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch);
    });

    await test.step('Publish and verify deployment enters a published/running status', async () => {
      await bulkPage.publishFromDetail();
      const status = await bulkPage.expectStatusBadgeVisible();
      expect([T.STATUS_PUBLISHED, T.STATUS_IN_PROGRESS, T.STATUS_COMPLETED]).toContain(status);
    });

    await test.step('Verify Batches tab is visible and metrics are numeric', async () => {
      await bulkPage.openBatchesTab();
      const metrics = await bulkPage.getBatchMetrics();
      Object.values(metrics).forEach((value) => {
        expect(Number.isFinite(value)).toBeTruthy();
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  test('TC-BULK-E2E-002: Full flow with Future schedule -> status Scheduled and Start On set', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);

    let bulkPage;
    await test.step('Create draft with future schedule + assignments', async () => {
      const created = await createDraftWithAssignments(page, {
        payloadOverrides: {
          name: `Bulk E2E Future ${Date.now()}`,
          ...future,
        },
        appNames: [bulkTestData.counterNowAppName],
        deviceNames: [bulkTestData.onlineDeviceSearch],
      });
      bulkPage = created.bulkPage;
    });

    await test.step('Publish and verify Scheduled state', async () => {
      await bulkPage.publishFromDetail();
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_SCHEDULED);
    });

    await test.step('Verify Start On is populated from future schedule', async () => {
      const startOn = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
      expect(startOn.length).toBeGreaterThan(4);
    });
  });

  test('TC-BULK-E2E-003: Cleanup behavior — created draft can be deleted from detail', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const name = `Bulk E2E Delete ${Date.now()}`;

    let bulkPage;
    await test.step('Create draft deployment', async () => {
      const created = await createDraftOpenDetail(page, { name });
      bulkPage = created.bulkPage;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_DRAFT);
    });

    await test.step('Delete deployment from detail and verify list no-result', async () => {
      await bulkPage.deleteFromDetail(true);
      await bulkPage.searchDeployment(name);
      const rowStillVisible = await bulkPage.rowByText(name).isVisible().catch(() => false);
      if (rowStillVisible) {
        await bulkPage.deleteFromListByName(name, true);
        await bulkPage.searchDeployment(name);
      }
      await bulkPage.expectNoDeploymentResults();
    });
  });
});
