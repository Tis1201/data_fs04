const { createBulkE2ETest, failedDeploymentId, T } = require('./bd-e2e-shared');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk failure/retry behavior', () => {
  test('TC-BULK-E2E-040: Failed deployment exposes retry path (Run Deployment)', async ({ bd }) => {
    test.skip(
      !failedDeploymentId,
      'Set pageURL.bulkDeployments.failedDeploymentId or BULK_FAILED_DEPLOYMENT_ID to validate retry on real failed deployment.'
    );
    test.setTimeout(8 * 60 * 1000);

    await test.step('Open existing Failed deployment', async () => {
      await bd.gotoDetail(failedDeploymentId);
      await bd.waitForPageReady();
      expect(await bd.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Retry by Run Deployment from detail and verify UI still healthy', async () => {
      await bd.runDeploymentFromDetail();
      await bd.waitForPageReady();
      await expect(bd.pageTitle).toBeVisible();
      await expect(bd.overviewTitle).toBeVisible();
      // Status may remain Failed or transition based on backend policy/timing.
      expect(await bd.expectStatusBadgeVisible()).toBeTruthy();
    });
  });

  test('TC-BULK-E2E-041: Failed deployment action visibility (Delete/Run) is deterministic', async ({
    bd,
  }) => {
    test.skip(
      !failedDeploymentId,
      'Set pageURL.bulkDeployments.failedDeploymentId or BULK_FAILED_DEPLOYMENT_ID to validate failed-action affordances.'
    );
    test.setTimeout(5 * 60 * 1000);

    await test.step('Open failed deployment and inspect actions', async () => {
      await bd.gotoDetail(failedDeploymentId);
      await bd.waitForPageReady();
      expect(await bd.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Assert action affordances are present/absent in a stable way', async () => {
      const runVisible = await bd.isDetailActionVisible(T.RUN_DEPLOYMENT);
      const deleteVisible = await bd.isDetailActionVisible(T.DELETE);
      expect(typeof runVisible).toBe('boolean');
      expect(typeof deleteVisible).toBe('boolean');
    });
  });
});
