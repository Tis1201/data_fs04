const { createBulkTest, bulkTestData } = require('./bd-shared');
const {
  createDraftOpenDetail,
  assertDeploymentDetailShell,
  assertDevicesTabIsDefault,
  assertOverviewKeyFieldsVisible,
  T,
} = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 2 — Deployment detail & overview (TC-BULK-INFO-001~004)', () => {
  test('TC-BULK-INFO-001: Detail page loads with header, overview, tabs; Devices default', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const { bulkPage, payload } = await createDraftOpenDetail(page, {
      name: `Bulk DetailShell ${Date.now()}`,
    });

    await test.step('Header, overview, Devices/Apps/Batches visible', async () => {
      await assertDeploymentDetailShell(bulkPage);
    });

    await test.step('Devices tab is selected by default', async () => {
      await assertDevicesTabIsDefault(bulkPage);
    });

    await test.step('Draft status badge visible', async () => {
      const status = await bulkPage.expectStatusBadgeVisible();
      expect(status).toBe(T.STATUS_DRAFT);
    });

    await test.step('Deployment name in overview matches payload', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, payload.name);
    });
  });

  test('TC-BULK-INFO-002: Overview shows all key fields with expected values', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const desc = `Overview check ${Date.now()}`;
    const { bulkPage, payload } = await createDraftOpenDetail(page, {
      name: `Bulk Overview ${Date.now()}`,
      version: '2.3.4',
      batchSize: 200,
      description: desc,
      rebootDevice: true,
      forceUpdate: true,
    });

    await test.step('All overview labels are visible', async () => {
      await assertOverviewKeyFieldsVisible(bulkPage);
    });

    await test.step('Values match saved draft payload', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, payload.name);
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_TARGET_OS, payload.targetOS);
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, payload.version);
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '200');
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, desc);
    });
  });

  test('TC-BULK-INFO-003: Status badge on existing Failed deployment (optional)', async ({ page, bd }) => {
    test.skip(!bulkTestData.failedDeploymentId, 'Set pageURL.bulkDeployments.failedDeploymentId or BULK_FAILED_DEPLOYMENT_ID');

    await test.step('Open configured Failed deployment and assert Failed badge', async () => {
      await bd.gotoDetail(bulkTestData.failedDeploymentId);
      await bd.waitForPageReady();
      const status = await bd.expectStatusBadgeVisible();
      expect(status).toBe(T.STATUS_FAILED);
    });
  });

  test('TC-BULK-INFO-004: Audit block shows Created by and Last updated by', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);

    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk Audit ${Date.now()}` });

    await test.step('Audit labels visible on detail', async () => {
      await bulkPage.expectAuditInfoVisible();
    });
  });
});
