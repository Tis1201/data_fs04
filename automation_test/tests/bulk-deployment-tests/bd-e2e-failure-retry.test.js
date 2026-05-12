const { createBulkE2ETest, bulkTestData, T } = require('./bd-e2e-shared');
const {
  createFailedDeploymentFromFlow,
  createFailedDeploymentFromDowngradePublish,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk failure, retry, and downgrade recovery', () => {
  test('TC-BULK-E2E-040: Create a failed deployment from the UI flow, then retry from detail', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    let bulkPage;
    let deploymentId;

    await test.step('Create draft with online device, publish, and wait until deployment status is Failed', async () => {
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

    await test.step('Re-open deployment detail and confirm status is still Failed', async () => {
      await bulkPage.gotoDetail(deploymentId);
      await bulkPage.waitForPageReady();
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Use Retry from detail, confirm dialog, and wait for a non-draft follow-up status', async () => {
      await bulkPage.retryDeploymentFromDetail();
      await expect(bulkPage.pageTitle).toBeVisible();
      await expect(bulkPage.overviewTitle).toBeVisible();
      await bulkPage.waitForStatusOneOf(
        [T.STATUS_IN_PROGRESS, T.STATUS_FAILED, T.STATUS_COMPLETED, T.STATUS_PUBLISHED],
        {
          timeout: bulkTestData.publishFlowTimeoutMs,
        },
      );
    });
  });

  test('TC-BULK-E2E-041: After Failed status, detail page shows Retry, Edit, Delete and hides Run Deployment', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    let bulkPage;

    await test.step('Create draft with online device, publish, and wait until deployment status is Failed', async () => {
      const created = await createFailedDeploymentFromFlow(page, {
        name: `Bulk E2E Failed Actions ${Date.now()}`,
        appName: bulkTestData.counterNowAppName,
        onlineDeviceSearch: bulkTestData.onlineDeviceSearch,
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      bulkPage = created.bulkPage;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Verify primary actions: Retry, Edit, Delete are available; Run Deployment is not offered', async () => {
      await expect(bulkPage.page.getByRole('button', { name: T.RETRY }).first()).toBeVisible();
      await expect(bulkPage.page.getByRole('button', { name: T.EDIT }).first()).toBeVisible();
      await expect(bulkPage.page.getByRole('button', { name: T.DELETE }).first()).toBeVisible();
      await expect(bulkPage.page.getByRole('button', { name: T.RUN_DEPLOYMENT }).first()).toBeHidden();
    });
  });

  test('TC-BULK-E2E-042: Downgrade publish fails; Retry without editing plan still ends in Failed', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);

    const older = bulkTestData.e2eOlderCatalogAppName;
    const newer = bulkTestData.e2eNewerCatalogAppName;

    test.skip(
      !older || !newer,
      'Configure bulkDeployments / devices.installApp with e2eOlderCatalogAppName + e2eNewerCatalogAppName (catalog labels). Device must already have the newer build installed.',
    );

    let bulkPage;
    let deploymentId;

    await test.step('Create and publish a deployment that assigns an older catalog app build (expect Failed)', async () => {
      const created = await createFailedDeploymentFromDowngradePublish(page, {
        name: `Bulk E2E DownFail ${Date.now()}`,
        olderCatalogAppName: older,
        onlineDeviceSearch: bulkTestData.onlineDeviceSearch,
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      bulkPage = created.bulkPage;
      deploymentId = created.deploymentId;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('Retry without changing apps or devices; expect deployment to return to Failed', async () => {
      await bulkPage.retryDeploymentFromDetail();
      await bulkPage.waitForStatusOneOf([T.STATUS_FAILED], {
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });
  });

  test('TC-BULK-E2E-043: After downgrade failure, replace app with newer catalog build, Retry, reach successful finish', async ({
    page,
  }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);

    const older = bulkTestData.e2eOlderCatalogAppName;
    const newer = bulkTestData.e2eNewerCatalogAppName;

    test.skip(
      !older || !newer,
      'Configure bulkDeployments / devices.installApp with e2eOlderCatalogAppName + e2eNewerCatalogAppName (catalog labels). Device must already have the newer build installed.',
    );

    let bulkPage;

    await test.step('Create and publish older-app deployment until status is Failed', async () => {
      const created = await createFailedDeploymentFromDowngradePublish(page, {
        name: `Bulk E2E DownRecover ${Date.now()}`,
        olderCatalogAppName: older,
        onlineDeviceSearch: bulkTestData.onlineDeviceSearch,
        timeout: bulkTestData.publishFlowTimeoutMs,
      });
      bulkPage = created.bulkPage;
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    });

    await test.step('On Apps tab, remove the older app and assign the newer catalog app', async () => {
      await bulkPage.openAppsTab();
      await bulkPage.removeAppByName(older);
      await bulkPage.addAppsByFlexibleNames([newer]);
    });

    await test.step('Retry deployment and wait for successful terminal status', async () => {
      await bulkPage.retryDeploymentFromDetail();
      await bulkPage.waitForDeploymentSuccessfulFinish({ timeout: bulkTestData.publishFlowTimeoutMs });
      const status = await bulkPage.expectStatusBadgeVisible();
      expect([T.STATUS_COMPLETED, T.STATUS_PUBLISHED]).toContain(status);
    });
  });
});
