const { createBulkE2ETest, bulkTestData, T } = require('./bd-e2e-shared');
const { createFailedDeploymentFromFlow } = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk failure/retry behavior', () => {
  test('TC-BULK-E2E-040: Failed deployment is created by flow before retry', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    let bulkPage;
    let deploymentId;

    await test.step('Create deployment with online device and make that device report Failed', async () => {
      const created = await createFailedDeploymentFromFlow(page, {
        name: `Bulk E2E Retry Failed ${Date.now()}`,
        appName: bulkTestData.counterNowAppName,
        onlineDeviceSearch: bulkTestData.onlineDeviceSearch,
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      bulkPage = created.bulkPage;
      deploymentId = created.deploymentId;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Retry from the same Failed deployment and verify retried status', async () => {
      await bulkPage.gotoDetail(deploymentId);
      await bulkPage.waitForPageReady();
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
      await bulkPage.retryDeploymentFromDetail();
      await expect(bulkPage.pageTitle).toBeVisible();
      await expect(bulkPage.overviewTitle).toBeVisible();
      await bulkPage.waitForStatusOneOf([T.STATUS_IN_PROGRESS, T.STATUS_FAILED], {
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
    });
  });

  test('TC-BULK-E2E-041: Failed deployment action visibility (Delete/Run) is deterministic', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    let bulkPage;

    await test.step('Create deployment with online device that reaches Failed status', async () => {
      const created = await createFailedDeploymentFromFlow(page, {
        name: `Bulk E2E Failed Actions ${Date.now()}`,
        appName: bulkTestData.counterNowAppName,
        onlineDeviceSearch: bulkTestData.onlineDeviceSearch,
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      bulkPage = created.bulkPage;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Assert action affordances are present/absent in a stable way', async () => {
      await expect(bulkPage.page.getByRole('button', { name: T.RETRY }).first()).toBeVisible();
      await expect(bulkPage.page.getByRole('button', { name: T.EDIT }).first()).toBeVisible();
      await expect(bulkPage.page.getByRole('button', { name: T.DELETE }).first()).toBeVisible();
      await expect(bulkPage.page.getByRole('button', { name: T.RUN_DEPLOYMENT }).first()).toBeHidden();
    });
  });
});
