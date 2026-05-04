const { createBulkTest, bulkTestData } = require('./bd-shared');
const {
  T,
  createDraftOpenDetail,
  createDraftWithAssignments,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-VERSION cross surfaces', () => {
  test('TC-BULK-VERSION-003: Semantic pre-release version on detail and list', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const ver = '1.2.3-beta';
    const name = `Bulk SemVer ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name, version: ver });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, ver);
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.searchDeployment(name);
    const cell = await bulkPage.getListCellText(name, 'version');
    expect(cell.toLowerCase()).toContain('beta');
  });

  test('TC-BULK-VERSION-004: Edit version reflected on list', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const name = `Bulk VerEditList ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name, version: '1.0.0' });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillInput(T.FORM.VERSION_LABEL, '6.0.0');
    await bulkPage.saveEditExpectDetail();
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.searchDeployment(name);
    expect(await bulkPage.getListCellText(name, 'version')).toContain('6.0.0');
  });

  test('TC-BULK-VERSION-005: Duplicate preserves version', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk VerDup ${Date.now()}`,
      version: '7.7.1',
    });
    await bulkPage.duplicateFromDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '7.7.1');
  });

  test('TC-BULK-VERSION-006: Publish preserves version', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const ver = '8.8.8';
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk VerPub ${Date.now()}`, version: ver },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });
    await bulkPage.publishFromDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, ver);
  });

  test('TC-BULK-VERSION-007: Default Version 1.0.0 when not overridden', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk VerNorm ${Date.now()}` });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '1.0.0');
  });

  test('TC-BULK-VERSION-008: Version stable when switching tabs', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk VerTabs ${Date.now()}`,
      version: '12.3.4',
    });
    const read = async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_VERSION);
    await bulkPage.openDevicesTab();
    const v1 = await read();
    await bulkPage.openAppsTab();
    const v2 = await read();
    await bulkPage.openBatchesTab();
    const v3 = await read();
    expect(v1).toContain('12.3.4');
    expect(v2).toContain('12.3.4');
    expect(v3).toContain('12.3.4');
  });
});
