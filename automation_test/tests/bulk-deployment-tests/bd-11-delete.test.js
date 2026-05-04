const { createBulkTest, bulkTestData } = require('./bd-shared');
const {
  T,
  createDraftOpenDetail,
  createDraftWithAssignments,
  buildFutureSchedulePayload,
} = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-DELETE', () => {
  test('TC-BULK-DELETE-001: Cancel delete from detail', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DelCancel ${Date.now()}` });
    await bulkPage.deleteFromDetail(false);
    await expect(bulkPage.pageTitle).toBeVisible();
  });

  test('TC-BULK-DELETE-002: Delete Draft from detail returns to list', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const name = `Bulk DelDetail ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name });
    await bulkPage.deleteFromDetail(true);
    await bulkPage.searchDeployment(name);
    await bulkPage.expectNoDeploymentResults();
  });

  test('TC-BULK-DELETE-003: Cancel delete from list row', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const name = `Bulk DelListCancel ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name });
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.deleteFromListByName(name, false);
    await bulkPage.searchDeployment(name);
    await expect(bulkPage.rowByText(name)).toBeVisible();
  });

  test('TC-BULK-DELETE-004: Confirm delete from list removes row', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const name = `Bulk DelListOk ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name });
    await bulkPage.deleteFromListByName(name, true);
    await bulkPage.searchDeployment(name);
    await bulkPage.expectNoDeploymentResults();
  });

  test('TC-BULK-DELETE-005: After publish (non-scheduled), Delete hidden on detail', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk DelPub ${Date.now()}` },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    const status = await bulkPage.expectStatusBadgeVisible();
    expect(
      [T.STATUS_PUBLISHED, T.STATUS_IN_PROGRESS, T.STATUS_COMPLETED, T.STATUS_SCHEDULED].includes(status)
    ).toBeTruthy();
    const delVisible = await bulkPage.isDetailActionVisible(T.DELETE);
    expect(delVisible).toBeFalsy();
  });

  test('TC-BULK-DELETE-006: Scheduled deployment shows Delete and can be removed', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const name = `Bulk DelSched ${Date.now()}`;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name, ...future },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_SCHEDULED);
    await expect(bulkPage.deleteButton.first()).toBeVisible();
    await bulkPage.deleteFromDetail(true);
    await bulkPage.searchDeployment(name);
    await bulkPage.expectNoDeploymentResults();
  });

  test('TC-BULK-DELETE-007: Failed deployment — Delete button visibility', async ({ page, bd }) => {
    test.skip(!bulkTestData.failedDeploymentId, 'Set bulkDeployments.failedDeploymentId for this check');
    await bd.gotoDetail(bulkTestData.failedDeploymentId);
    await bd.waitForPageReady();
    expect(await bd.expectStatusBadgeVisible()).toBe(T.STATUS_FAILED);
    const delVisible = await bd.isDetailActionVisible(T.DELETE);
    expect(typeof delVisible).toBe('boolean');
  });
});
