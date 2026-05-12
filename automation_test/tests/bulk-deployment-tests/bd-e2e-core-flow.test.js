const { createBulkE2ETest, bulkTestData, T } = require('./bd-e2e-shared');
const {
  createDraftWithAssignments,
  createDraftOpenDetail,
  buildFutureSchedulePayload,
  createFailedDeploymentFromFlow,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk Deployment core flow', () => {
  test('TC-BULK-E2E-001: Immediate publish — create draft, assign app and device, publish, verify successful finish and batches', async ({
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

    await test.step('Publish and wait until overview shows a successful terminal status (Completed or Published)', async () => {
      await bulkPage.publishFromDetail();
      await bulkPage.waitForDeploymentSuccessfulFinish({ timeout: bulkTestData.publishFlowTimeoutMs });
      const status = await bulkPage.expectStatusBadgeVisible();
      expect([T.STATUS_COMPLETED, T.STATUS_PUBLISHED]).toContain(status);
    });

    await test.step('Verify assigned device shows Completed in the deployment Devices tab', async () => {
      await bulkPage.openDevicesTab();
      await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch, T.STATUS_COMPLETED);
    });

    await test.step('Verify Batches tab metrics are numeric and show no failed batches for this run', async () => {
      await bulkPage.openBatchesTab();
      const metrics = await bulkPage.getBatchMetrics();
      Object.values(metrics).forEach((value) => {
        expect(Number.isFinite(value)).toBeTruthy();
        expect(value).toBeGreaterThanOrEqual(0);
      });
      expect(metrics.failed).toBe(0);
    });
  });

  test('TC-BULK-E2E-002: Future schedule — publish reaches Scheduled state with Start On set, list row matches', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const deploymentName = `Bulk E2E Future ${Date.now()}`;

    let bulkPage;
    await test.step('Create draft with future schedule + assignments', async () => {
      const created = await createDraftWithAssignments(page, {
        payloadOverrides: {
          name: deploymentName,
          ...future,
        },
        appNames: [bulkTestData.counterNowAppName],
        deviceNames: [bulkTestData.onlineDeviceSearch],
      });
      bulkPage = created.bulkPage;
    });

    await test.step('Publish and wait until overview status is Scheduled (successful schedule publish)', async () => {
      await bulkPage.publishFromDetail();
      await bulkPage.waitForStatusOneOf(T.STATUS_SCHEDULED, {
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_SCHEDULED);
    });

    await test.step('Verify Start On is populated from future schedule', async () => {
      const startOn = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
      expect(startOn.length).toBeGreaterThan(4);
    });

    await test.step('Verify Bulk Deployments list row shows Scheduled status for this deployment', async () => {
      await bulkPage.gotoList();
      await bulkPage.waitForListReady();
      await bulkPage.searchDeployment(deploymentName);
      const row = bulkPage.rowByText(deploymentName);
      await expect(row).toBeVisible();
      await expect(row).toContainText(T.STATUS_SCHEDULED);
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

  test('TC-BULK-E2E-004: Device Deployments tab status matches Bulk Deployment Devices tab', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const name = `Bulk E2E Device Consistency ${Date.now()}`;
    const device = bulkTestData.onlineDeviceSearch;
    let bulkPage;
    let bulkDeviceStatus;

    await test.step('Create a deployment that reaches Failed with one assigned device', async () => {
      const created = await createFailedDeploymentFromFlow(page, {
        name,
        appName: bulkTestData.counterNowAppName,
        onlineDeviceSearch: device,
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      bulkPage = created.bulkPage;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Read device deployment status from Bulk Deployment Devices tab', async () => {
      bulkDeviceStatus = await bulkPage.getDeviceDeploymentStatusText(device);
      expect(bulkDeviceStatus).toBe(T.STATUS_FAILED);
    });

    await test.step('Open assigned device from Bulk Deployment Devices tab', async () => {
      await bulkPage.openDeviceDetailFromDevicesTab(device);
    });

    await test.step('Verify Device Deployments tab shows the same device-level status', async () => {
      const deploymentsTab = page
        .getByRole('button', { name: 'Deployments', exact: true })
        .or(page.getByRole('tab', { name: 'Deployments' }));
      await deploymentsTab.click();

      const deploymentRow = page.locator('tbody tr').filter({ hasText: name }).first();
      await expect(deploymentRow).toBeVisible({ timeout: bulkTestData.publishFlowTimeoutMs });

      const statusCell = deploymentRow.locator('td[data-ds-col-id="status"]').first();
      if ((await statusCell.count()) > 0) {
        await expect(statusCell).toContainText(bulkDeviceStatus, { timeout: bulkTestData.publishFlowTimeoutMs });
      } else {
        await expect(deploymentRow).toContainText(bulkDeviceStatus, { timeout: bulkTestData.publishFlowTimeoutMs });
      }
    });
  });
});
