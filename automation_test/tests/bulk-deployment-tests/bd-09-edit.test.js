const { createBulkTest, bulkTestData } = require('./bd-shared');
const { T, createDraftOpenDetail, buildFutureSchedulePayload } = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-EDIT — Edit Deployment modal', () => {
  test('TC-BULK-EDIT-001: Open Edit modal shows title and actions', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk EditOpen ${Date.now()}` });
    const dialog = await bulkPage.openEditDeploymentModal();
    await expect(bulkPage.getDialogHeading(dialog, T.DIALOG_EDIT_DEPLOYMENT)).toBeVisible();
    await expect(bulkPage.getSaveChangesButton(dialog)).toBeVisible();
    await expect(bulkPage.getCancelButton(dialog)).toBeVisible();
    await bulkPage.cancelEdit();
  });

  test('TC-BULK-EDIT-002: Edit Deployment Name', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const baseName = `Bulk EditName ${Date.now()}`;
    const updated = `${baseName}-updated`;
    const { bulkPage } = await createDraftOpenDetail(page, { name: baseName });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillInput(T.FORM.NAME_LABEL, updated);
    await bulkPage.saveEditExpectDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, updated);
  });

  test('TC-BULK-EDIT-003: Edit Description', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk EditDesc ${Date.now()}`,
      description: 'initial',
    });
    const next = `Updated desc ${Date.now()}`;
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillTextarea(T.FORM.DESCRIPTION_LABEL, next);
    await bulkPage.saveEditExpectDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, next);
  });

  test('TC-BULK-EDIT-004: Edit Version', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk EditVer ${Date.now()}`,
      version: '1.0.0',
    });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillInput(T.FORM.VERSION_LABEL, '5.6.7');
    await bulkPage.saveEditExpectDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '5.6.7');
  });

  test('TC-BULK-EDIT-005: Edit Batch Size', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk EditBatch ${Date.now()}` });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.setBatchSize(200);
    await bulkPage.saveEditExpectDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '200');
  });

  test('TC-BULK-EDIT-006: Edit Schedule from None to Future', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk EditSched ${Date.now()}` });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillDeploymentForm({
      schedule: future.schedule,
      scheduleDate: future.scheduleDate,
      scheduleTime: future.scheduleTime,
    });
    await bulkPage.saveEditExpectDetail();
    const startOn = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
    expect(startOn.length).toBeGreaterThan(4);
  });

  test('TC-BULK-EDIT-007: Enable Reboot Device and Force Update via Edit', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk EditBehav ${Date.now()}`,
      rebootDevice: false,
      forceUpdate: false,
    });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.setSwitch(T.FORM.REBOOT_DEVICE, true);
    await bulkPage.setSwitch(T.FORM.FORCE_UPDATE, true);
    await bulkPage.saveEditExpectDetail();
    await expect.poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE)).toMatch(/enable/i);
    await expect.poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE)).toMatch(/enable/i);
  });

  test('TC-BULK-EDIT-008: Cancel edit restores unchanged name', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const original = `Bulk EditCancel ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name: original });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillInput(T.FORM.NAME_LABEL, 'ShouldNotPersist');
    await bulkPage.cancelEdit();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, original);
  });

  test('TC-BULK-EDIT-009: Empty name blocks Save Changes', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk EditEmpty ${Date.now()}` });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.inputByLabel(T.FORM.NAME_LABEL).click({ clickCount: 3 });
    await bulkPage.inputByLabel(T.FORM.NAME_LABEL).fill('');
    await bulkPage.saveEditExpectBlocked();
    await bulkPage.cancelEdit();
  });

  test('TC-BULK-EDIT-010: Save without field changes preserves data', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const name = `Bulk EditNoop ${Date.now()}`;
    const desc = `Noop ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name, description: desc, version: '8.1.0' });
    await bulkPage.openEditDeploymentModal();
    await bulkPage.saveEditExpectDetail();
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, name);
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, desc);
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '8.1.0');
  });

  test('TC-BULK-EDIT-011: Audit section still visible after description edit', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk EditAudit ${Date.now()}` });
    await bulkPage.expectAuditInfoVisible();
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillTextarea(T.FORM.DESCRIPTION_LABEL, `Audit touch ${Date.now()}`);
    await bulkPage.saveEditExpectDetail();
    await bulkPage.expectAuditInfoVisible();
  });

  test('TC-BULK-EDIT-012: Edited name and version on list row', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const base = `Bulk EditList ${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name: base, version: '1.0.0' });
    const newName = `${base}-row`;
    await bulkPage.openEditDeploymentModal();
    await bulkPage.fillInput(T.FORM.NAME_LABEL, newName);
    await bulkPage.fillInput(T.FORM.VERSION_LABEL, '6.0.0');
    await bulkPage.saveEditExpectDetail();
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.searchDeployment(newName);
    const verCell = await bulkPage.getListCellText(newName, 'version');
    expect(verCell).toContain('6.0.0');
  });
});
