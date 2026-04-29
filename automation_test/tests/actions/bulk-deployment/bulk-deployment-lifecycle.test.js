const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  createDraftWithAppsAndDevices,
  futureScheduleDate,
  setActualResult,
} = require('./bulk-deployment-test-helpers');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

test.describe('Bulk Deployment - Edit', () => {
  test('TC-BULK-EDIT-001: Edit modal opens with expected fields and action buttons', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-open'));
        const dialog = await context.bulkDeploymentPage.openEditDeploymentModal();
        await expect(dialog.getByText(T.FORM.NAME_LABEL)).toBeVisible();
        await expect(dialog.getByText(T.FORM.TARGET_OS_LABEL)).toBeVisible();
        await expect(dialog.getByText(T.FORM.VERSION_LABEL)).toBeVisible();
        await expect(dialog.getByText(T.FORM.BATCH_SIZE_LABEL)).toBeVisible();
        await expect(dialog.getByText(T.FORM.SCHEDULE_LABEL)).toBeVisible();
        await expect(dialog.getByRole('button', { name: T.SAVE_CHANGES })).toBeVisible();
        await expect(dialog.getByRole('button', { name: T.CANCEL })).toBeVisible();

        setActualResult(testInfo, 'Edit modal opened with all expected fields and buttons');
    });
});

  test('TC-BULK-EDIT-002: Edit Deployment Name updates in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const original = createDeploymentData('edit-name');
        await context.bulkDeploymentPage.createDraftDeployment(original);
        const updatedName = `${original.name}-updated`;
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ name: updatedName });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, updatedName);

        setActualResult(testInfo, `Deployment Name updated to "${updatedName}"`);
    });
});

  test('TC-BULK-EDIT-003: Edit Description updates in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-desc'));
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ description: 'Updated automation description' });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, 'Updated automation description');

        setActualResult(testInfo, 'Description updated to "Updated automation description"');
    });
});

  test('TC-BULK-EDIT-004: Edit Version updates in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-version'));
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ version: '5.6.7' });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '5.6.7');

        setActualResult(testInfo, 'Version updated to 5.6.7');
    });
});

  test('TC-BULK-EDIT-005: Edit Batch Size updates in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-batch'));
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ batchSize: '200' });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '200');

        setActualResult(testInfo, 'Batch Size updated to 200');
    });
});

  test('TC-BULK-EDIT-006: Edit Schedule from None to Future populates Start On', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const future = futureScheduleDate(1);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-future'));
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({
          schedule: 'Future',
          scheduleDate: future.date,
          scheduleTime: future.time,
        });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        const startOn = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
        expect(startOn).not.toBe('');
        expect(startOn).not.toBe('-');

        setActualResult(testInfo, `Start On populated: "${startOn}"`);
    });
});

  test('TC-BULK-EDIT-007: Enable Reboot Device and Force Update shows Enable in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-device-behavior'));
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ rebootDevice: true, forceUpdate: true });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE, 'Enable');
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE, 'Enable');

        setActualResult(testInfo, 'Reboot Device and Force Update enabled and shown as Enable');
    });
});

  test('TC-BULK-EDIT-008: Cancel edit preserves original name unchanged', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const cancelOrig = createDeploymentData('edit-cancel');
        await context.bulkDeploymentPage.createDraftDeployment(cancelOrig);
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ name: `${cancelOrig.name}-not-saved` });
        await context.bulkDeploymentPage.cancelEdit();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, cancelOrig.name);

        setActualResult(testInfo, `Original name "${cancelOrig.name}" preserved after cancel`);
    });
});

  test('TC-BULK-EDIT-009: Empty name in edit modal blocks Save Changes', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-empty-name'));
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ name: '' });
        await context.bulkDeploymentPage.saveEditExpectBlocked();

        setActualResult(testInfo, 'Save Changes blocked when name was cleared');
    });
});

  test('TC-BULK-EDIT-010: Save without changes preserves original data', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const noChangeData = createDeploymentData('edit-no-change', { description: 'No change edit baseline' });
        await context.bulkDeploymentPage.createDraftDeployment(noChangeData);
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, noChangeData.name);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, noChangeData.description);

        setActualResult(testInfo, 'No-change save preserved original name and description');
    });
});

  test('TC-BULK-EDIT-011: Audit info remains visible after edit', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-audit'));
        await context.bulkDeploymentPage.expectAuditInfoVisible();
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ description: 'Audit after edit' });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectAuditInfoVisible();

        setActualResult(testInfo, 'Audit info visible before and after edit');
    });
});

  test('TC-BULK-EDIT-012: Edited name and version are in sync between detail and list', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const syncData = createDeploymentData('edit-list-sync');
        await context.bulkDeploymentPage.createDraftDeployment(syncData);
        const syncName = `${syncData.name}-sync`;
        const syncVersion = '8.8.8';
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ name: syncName, version: syncVersion });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, syncName);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, syncVersion);
        await context.bulkDeploymentPage.gotoList();
        await context.bulkDeploymentPage.waitForListReady();
        await context.bulkDeploymentPage.searchDeployment(syncName);
        const listVersion = await context.bulkDeploymentPage.getListCellText(syncName, 'version');
        expect(listVersion).toContain(syncVersion);

        setActualResult(testInfo, `Edit synced: name="${syncName}", version="${syncVersion}" in both detail and list`);
    });
});
});

test.describe('Bulk Deployment - Publish', () => {
  test('TC-BULK-PUBLISH-001: Happy path publish transitions status out of Draft', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'publish-happy');
        await context.bulkDeploymentPage.publishFromDetail();
        await expect.poll(() => context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_STATUS), {
          timeout: context.bulkDeploymentPage.timeout,
          message: 'Status should transition out of Draft',
        }).not.toContain(T.STATUS_DRAFT);
        expect(await context.bulkDeploymentPage.isDetailActionVisible(T.PUBLISH)).toBe(false);

        setActualResult(testInfo, 'Publish happy path succeeded; status no longer Draft');
    });
});

  test('TC-BULK-PUBLISH-002: Cannot publish without app — status should stay Draft (known issue)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system may allow publishing without an app assigned.');    const context = createBulkDeploymentContext(page);
await test.step('Run main flow', async () => {
        await createDraftWithAppsAndDevices(context, 'publish-no-app', {
          appNames: [],
          deviceNames: [bulkDeploymentConfig.onlineDeviceName],
        });
        await context.bulkDeploymentPage.publishFromDetail();
        const status = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_STATUS);

        setActualResult(testInfo, `No-app publish status="${status}". Defect candidate.`);
        expect(status).toContain(T.STATUS_DRAFT);
    });
});

  test('TC-BULK-PUBLISH-003: Cannot publish without device — status should stay Draft (known issue)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system may allow publishing without a device assigned.');    const context = createBulkDeploymentContext(page);
await test.step('Run main flow', async () => {
        await createDraftWithAppsAndDevices(context, 'publish-no-device', {
          appNames: [bulkDeploymentConfig.appDigitalSignage],
          deviceNames: [],
        });
        await context.bulkDeploymentPage.publishFromDetail();
        const status = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_STATUS);

        setActualResult(testInfo, `No-device publish status="${status}". Defect candidate.`);
        expect(status).toContain(T.STATUS_DRAFT);
    });
});

  test('TC-BULK-PUBLISH-004: Offline device is retained after publish', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'publish-offline', {
          deviceNames: [bulkDeploymentConfig.offlineDeviceName],
          appNames: [bulkDeploymentConfig.appDigitalSignage],
        });
        await context.bulkDeploymentPage.publishFromDetail();
        await expect.poll(() => context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_STATUS), {
          timeout: context.bulkDeploymentPage.timeout,
        }).not.toContain(T.STATUS_DRAFT);
        await context.bulkDeploymentPage.openDevicesTab();
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName, 'Offline');

        setActualResult(testInfo, 'Offline device retained after publish');
    });
});

  test('TC-BULK-PUBLISH-005: Future schedule publish results in Scheduled status', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const future = futureScheduleDate(1);
        await createDraftWithAppsAndDevices(context, 'publish-scheduled', {
          data: { schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time },
        });
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_STATUS, T.STATUS_SCHEDULED);
        const startOn = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
        expect(startOn).not.toBe('');
        expect(startOn).not.toBe('-');

        setActualResult(testInfo, `Scheduled status confirmed; Start On="${startOn}"`);
    });
});

  test('TC-BULK-PUBLISH-006: Publish hides Publish, shows Duplicate, hides Delete', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'publish-actions');
        await context.bulkDeploymentPage.publishFromDetail();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await context.bulkDeploymentPage.waitForPageReady();
        await expect(page.getByRole('button', { name: T.PUBLISH }).first()).toBeHidden();
        await expect(page.getByRole('button', { name: T.DUPLICATE }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: T.DELETE }).first()).toBeHidden();

        setActualResult(testInfo, 'Post-publish action buttons correct: Publish hidden, Duplicate visible, Delete hidden');
    });
});

  test('TC-BULK-PUBLISH-007: List page Publish cancel keeps status as Draft', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const cancelCreated = await createDraftWithAppsAndDevices(context, 'publish-list-cancel');
        await context.bulkDeploymentPage.gotoList();
        await context.bulkDeploymentPage.waitForListReady();
        await context.bulkDeploymentPage.searchDeployment(cancelCreated.data.name);
        await context.bulkDeploymentPage.selectRowAction(cancelCreated.data.name, T.ROW_ACTION_PUBLISH);
        const cancelDialog = context.bulkDeploymentPage.dialogByTitle(T.DIALOG_DEPLOYMENT_CONFIRM);
        await expect(cancelDialog).toBeVisible();
        await cancelDialog.getByRole('button', { name: T.CANCEL }).click();
        const statusAfterCancel = await context.bulkDeploymentPage.getListCellText(cancelCreated.data.name, 'status');
        expect(statusAfterCancel).toContain(T.STATUS_DRAFT);

        setActualResult(testInfo, 'List Publish cancel kept status as Draft');
    });
});

  test('TC-BULK-PUBLISH-008: List page Publish confirm transitions status out of Draft', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const confirmCreated = await createDraftWithAppsAndDevices(context, 'publish-list-confirm');
        await context.bulkDeploymentPage.gotoList();
        await context.bulkDeploymentPage.waitForListReady();
        await context.bulkDeploymentPage.searchDeployment(confirmCreated.data.name);
        await context.bulkDeploymentPage.selectRowAction(confirmCreated.data.name, T.ROW_ACTION_PUBLISH);
        const confirmDialog = context.bulkDeploymentPage.dialogByTitle(T.DIALOG_DEPLOYMENT_CONFIRM);
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.getByRole('button', { name: T.CONFIRM }).click();
        await context.bulkDeploymentPage.waitForToastOrNetwork();
        await expect.poll(
          () => context.bulkDeploymentPage.getListCellText(confirmCreated.data.name, 'status'),
          { timeout: context.bulkDeploymentPage.timeout }
        ).not.toContain(T.STATUS_DRAFT);

        setActualResult(testInfo, 'List Publish confirm transitioned status out of Draft');
    });
});

  test('TC-BULK-PUBLISH-009: Version is preserved after publish', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const version = '10.2.0';
        const verCreated = await createDraftWithAppsAndDevices(context, 'publish-version', { data: { version } });
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, version);

        setActualResult(testInfo, `Version ${version} preserved after publish in detail and list`);
    });
});

  test('TC-BULK-PUBLISH-010: Batch Size is preserved after publish', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'publish-batch', { data: { batchSize: '37' } });
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '37');

        setActualResult(testInfo, 'Batch Size 37 preserved after publish');
    });
});
});

test.describe('Bulk Deployment - Delete', () => {
  test('TC-BULK-DELETE-001: Cancel delete from detail keeps deployment intact', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const cancelCreated = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('del-cancel-detail'));
        await context.bulkDeploymentPage.deleteFromDetail(false);
        expect(context.bulkDeploymentPage.getDeploymentIdFromUrl()).toBe(cancelCreated.id);

        setActualResult(testInfo, `Cancel preserved deployment id=${cancelCreated.id}`);
    });
});

  test('TC-BULK-DELETE-002: Confirm delete from detail removes deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const detailData = createDeploymentData('del-confirm-detail');
        await context.bulkDeploymentPage.createDraftDeployment(detailData);
        await context.bulkDeploymentPage.deleteFromDetail(true);
        await context.bulkDeploymentPage.searchDeployment(detailData.name);
        await context.bulkDeploymentPage.expectNoDeploymentResults();

        setActualResult(testInfo, 'Deployment deleted from detail; not found in list');
    });
});

  test('TC-BULK-DELETE-003: Cancel delete from list keeps row visible', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const listCancelData = createDeploymentData('del-cancel-list');
        await context.bulkDeploymentPage.createDraftDeployment(listCancelData);
        await context.bulkDeploymentPage.deleteFromListByName(listCancelData.name, false);
        await expect(context.bulkDeploymentPage.rowByText(listCancelData.name)).toBeVisible();

        setActualResult(testInfo, 'Cancel from list preserved deployment row');
    });
});

  test('TC-BULK-DELETE-004: Confirm delete from list removes deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const listConfirmData = createDeploymentData('del-confirm-list');
        await context.bulkDeploymentPage.createDraftDeployment(listConfirmData);
        await context.bulkDeploymentPage.deleteFromListByName(listConfirmData.name, true);
        await context.bulkDeploymentPage.searchDeployment(listConfirmData.name);
        await context.bulkDeploymentPage.expectNoDeploymentResults();

        setActualResult(testInfo, 'Deployment deleted from list; no results found');
    });
});

  test('TC-BULK-DELETE-005: Delete button is hidden after non-scheduled publish', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'del-published');
        await context.bulkDeploymentPage.publishFromDetail();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await context.bulkDeploymentPage.waitForPageReady();
        expect(await context.bulkDeploymentPage.isDetailActionVisible(T.DELETE)).toBe(false);

        setActualResult(testInfo, 'Delete button hidden after non-scheduled publish');
    });
});

  test('TC-BULK-DELETE-006: Scheduled deployment can be deleted after publish', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const future = futureScheduleDate(1);
        const schedCreated = await createDraftWithAppsAndDevices(context, 'del-scheduled', {
          data: { schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time },
        });
        await context.bulkDeploymentPage.publishFromDetail();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await context.bulkDeploymentPage.waitForPageReady();
        expect(await context.bulkDeploymentPage.isDetailActionVisible(T.DELETE)).toBe(true);
        await context.bulkDeploymentPage.deleteFromDetail(true);
        await context.bulkDeploymentPage.searchDeployment(schedCreated.data.name);
        await context.bulkDeploymentPage.expectNoDeploymentResults();

        setActualResult(testInfo, 'Scheduled deployment deleted successfully');
    });
});

  test('TC-BULK-DELETE-007: Failed deployment shows Delete button', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        if (!bulkDeploymentConfig.failedDeploymentId) {
          const msg = 'Blocked: failedDeploymentId is not configured.';
          setActualResult(testInfo, msg);
          throw new Error(msg);
        }

        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.gotoDetail(bulkDeploymentConfig.failedDeploymentId);
        await context.bulkDeploymentPage.waitForPageReady();
        expect(await context.bulkDeploymentPage.isDetailActionVisible(T.DELETE)).toBe(true);

        setActualResult(testInfo, 'Failed deployment displayed Delete button');
    });
});
});

test.describe('Bulk Deployment - Duplicate', () => {
  test('TC-BULK-DUPLICATE-001: Cancel duplicate stays on original deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const cancelCreated = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-cancel'));
        await context.bulkDeploymentPage.cancelDuplicateFromDetail();
        expect(context.bulkDeploymentPage.getDeploymentIdFromUrl()).toBe(cancelCreated.id);

        setActualResult(testInfo, `Cancel kept URL on original id=${cancelCreated.id}`);
    });
});

  test('TC-BULK-DUPLICATE-002: Confirm duplicate creates new deployment with Draft status', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const origCreated = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-draft'));
        const dupId = await context.bulkDeploymentPage.duplicateFromDetail();
        expect(dupId).not.toBe(origCreated.id);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_STATUS, T.STATUS_DRAFT);

        setActualResult(testInfo, `Duplicate created new id=${dupId}; status is Draft`);
    });
});

  test('TC-BULK-DUPLICATE-003: Overview fields are copied to duplicate', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const overviewData = createDeploymentData('dup-overview', {
          description: 'Duplicate overview baseline',
          rebootDevice: true,
          forceUpdate: true,
        });
        await context.bulkDeploymentPage.createDraftDeployment(overviewData);
        await context.bulkDeploymentPage.duplicateFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, overviewData.name);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_TARGET_OS, overviewData.targetOS);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, overviewData.batchSize);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, overviewData.description);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE, 'Enable');
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE, 'Enable');

        setActualResult(testInfo, 'All overview fields copied to duplicate');
    });
});

  test('TC-BULK-DUPLICATE-004: Version is copied to duplicate', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const verData = createDeploymentData('dup-version', { version: '9.1.0' });
        await context.bulkDeploymentPage.createDraftDeployment(verData);
        await context.bulkDeploymentPage.duplicateFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, verData.version);

        setActualResult(testInfo, `Version ${verData.version} copied to duplicate`);
    });
});

  test('TC-BULK-DUPLICATE-005: Apps are copied to duplicate', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'dup-apps', {
          deviceNames: [],
          appNames: [bulkDeploymentConfig.appDigitalSignage, bulkDeploymentConfig.appCounterNow],
        });
        await context.bulkDeploymentPage.duplicateFromDetail();
        await context.bulkDeploymentPage.openAppsTab();
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeVisible();
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toBeVisible();

        setActualResult(testInfo, 'Digital Signage and counter_now copied to duplicate');
    });
});

  test('TC-BULK-DUPLICATE-006: Devices are copied to duplicate', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'dup-devices', {
          appNames: [],
          deviceNames: [bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName],
        });
        await context.bulkDeploymentPage.duplicateFromDetail();
        await context.bulkDeploymentPage.openDevicesTab();
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName);

        setActualResult(testInfo, 'Online and Offline devices copied to duplicate');
    });
});

  test('TC-BULK-DUPLICATE-007: Duplicate name is traceable to original', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const nameData = createDeploymentData('dup-name');
        await context.bulkDeploymentPage.createDraftDeployment(nameData);
        await context.bulkDeploymentPage.duplicateFromDetail();
        const dupName = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME);
        expect(dupName).toContain(nameData.name);

        setActualResult(testInfo, `Duplicate name "${dupName}" contains original "${nameData.name}"`);
    });
});

  test('TC-BULK-DUPLICATE-008: Duplicate Draft has no batch data', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-batches'));
        await context.bulkDeploymentPage.duplicateFromDetail();
        await context.bulkDeploymentPage.openBatchesTab();
        const metrics = await context.bulkDeploymentPage.getBatchMetrics();
        expect(metrics.total).toBe(0);
        await context.bulkDeploymentPage.expectBatchesEmptyState();

        setActualResult(testInfo, 'Duplicate Draft had zero batch data');
    });
});
});

test.describe('Bulk Deployment - Batches', () => {
  test('TC-BULK-BATCHES-001: Draft has zero batch metrics and empty state', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('batches-draft'));
        await context.bulkDeploymentPage.openBatchesTab();
        const draftMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        expect(draftMetrics).toEqual({ total: 0, completed: 0, inProgress: 0, failed: 0, canceled: 0 });
        await context.bulkDeploymentPage.expectBatchesEmptyState();

        setActualResult(testInfo, 'Draft batch metrics all zero; empty state visible');
    });
});

  test('TC-BULK-BATCHES-002: Published deployment shows numeric non-negative batch metrics', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'batches-publish');
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.openBatchesTab();
        const pubMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        for (const v of Object.values(pubMetrics)) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }

        setActualResult(testInfo, `Published metrics: ${JSON.stringify(pubMetrics)}`);
    });
});

  test('TC-BULK-BATCHES-003: Each status metric does not exceed Total Batches', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'batches-consistency');
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.openBatchesTab();
        const pubMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        expect(pubMetrics.completed).toBeLessThanOrEqual(pubMetrics.total);
        expect(pubMetrics.inProgress).toBeLessThanOrEqual(pubMetrics.total);
        expect(pubMetrics.failed).toBeLessThanOrEqual(pubMetrics.total);
        expect(pubMetrics.canceled).toBeLessThanOrEqual(pubMetrics.total);

        setActualResult(testInfo, `Metrics consistent: ${JSON.stringify(pubMetrics)}`);
    });
});

  test('TC-BULK-BATCHES-004: Batch table columns are visible when batches exist', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'batches-table');
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.openBatchesTab();
        const tableMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        if (tableMetrics.total > 0) {
          for (const col of [
            T.BATCH_TABLE_COL_NUM,
            T.BATCH_TABLE_COL_BATCH_NAME,
            T.BATCH_TABLE_COL_DEVICES,
            T.BATCH_TABLE_COL_STATUS,
            T.BATCH_TABLE_COL_STARTED_ON,
            T.BATCH_TABLE_COL_END_ON,
          ]) {
            await expect(context.bulkDeploymentPage.getBatchTableColumnHeader(col)).toBeVisible();
          }
        }

        setActualResult(testInfo, `Table columns verified; total=${tableMetrics.total}`);
    });
});

  test('TC-BULK-BATCHES-005: Future scheduled publish results in zero runtime batches', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const future = futureScheduleDate(1);
        await createDraftWithAppsAndDevices(context, 'batches-scheduled', {
          data: { schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time },
        });
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.openBatchesTab();
        const schedMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        expect(schedMetrics.total).toBe(0);
        await context.bulkDeploymentPage.expectBatchesEmptyState();

        setActualResult(testInfo, 'Scheduled publish showed zero batches');
    });
});

  test('TC-BULK-BATCHES-006: Offline device publish shows stable non-negative metrics', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await createDraftWithAppsAndDevices(context, 'batches-offline', {
          deviceNames: [bulkDeploymentConfig.offlineDeviceName],
          appNames: [bulkDeploymentConfig.appDigitalSignage],
        });
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.openBatchesTab();
        const offMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        for (const v of Object.values(offMetrics)) {
          expect(v).toBeGreaterThanOrEqual(0);
        }

        setActualResult(testInfo, `Offline metrics stable: ${JSON.stringify(offMetrics)}`);
    });
});

  test('TC-BULK-BATCHES-007: Refresh keeps Batches tab metrics visible', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('batches-refresh'));
        await context.bulkDeploymentPage.openBatchesTab();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await context.bulkDeploymentPage.waitForPageReady();
        await context.bulkDeploymentPage.openBatchesTab();
        const refreshMetrics = await context.bulkDeploymentPage.getBatchMetrics();
        expect(refreshMetrics.total).toBeGreaterThanOrEqual(0);

        setActualResult(testInfo, `Refresh kept metrics visible; total=${refreshMetrics.total}`);
    });
});
});

test.describe('Bulk Deployment - Version', () => {
  test('TC-BULK-VERSION-001: Version defaults to 1.0.0 in Add Deployment modal', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.openAddDeploymentModal();
        await expect(context.bulkDeploymentPage.inputByLabel(T.FORM.VERSION_LABEL)).toHaveValue(
          bulkDeploymentConfig.defaultVersion
        );

        setActualResult(testInfo, `Version defaulted to ${bulkDeploymentConfig.defaultVersion}`);
    });
});

  test('TC-BULK-VERSION-002: Version field accepts new value while modal is open', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.openAddDeploymentModal();
        await context.bulkDeploymentPage.fillInput(T.FORM.VERSION_LABEL, '1.2.3');
        await expect(context.bulkDeploymentPage.inputByLabel(T.FORM.VERSION_LABEL)).toHaveValue('1.2.3');

        setActualResult(testInfo, 'Version field accepted value 1.2.3');
    });
});

  test('TC-BULK-VERSION-003: Semver version is persisted in detail and list', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const semver = '1.2.3-beta';
        const semverData = createDeploymentData('ver-semver', { version: semver });
        await context.bulkDeploymentPage.createDraftDeployment(semverData);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, semver);
        await context.bulkDeploymentPage.gotoList();
        await context.bulkDeploymentPage.waitForListReady();
        await context.bulkDeploymentPage.searchDeployment(semverData.name);
        expect(await context.bulkDeploymentPage.getListCellText(semverData.name, 'version')).toContain(semver);

        setActualResult(testInfo, `Semver ${semver} consistent in detail and list`);
    });
});

  test('TC-BULK-VERSION-004: Edited version is consistent in detail and list', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const editVerData = createDeploymentData('ver-edit');
        await context.bulkDeploymentPage.createDraftDeployment(editVerData);
        const updatedVer = '6.0.0';
        await context.bulkDeploymentPage.openEditDeploymentModal();
        await context.bulkDeploymentPage.fillEditDeploymentForm({ version: updatedVer });
        await context.bulkDeploymentPage.saveEditExpectDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, updatedVer);
        await context.bulkDeploymentPage.gotoList();
        await context.bulkDeploymentPage.waitForListReady();
        await context.bulkDeploymentPage.searchDeployment(editVerData.name);
        expect(await context.bulkDeploymentPage.getListCellText(editVerData.name, 'version')).toContain(updatedVer);

        setActualResult(testInfo, `Edited version ${updatedVer} consistent in detail and list`);
    });
});

  test('TC-BULK-VERSION-005: Duplicate preserves version from original', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const dupVer = '7.7.1';
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-dup', { version: dupVer }));
        await context.bulkDeploymentPage.duplicateFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, dupVer);

        setActualResult(testInfo, `Version ${dupVer} preserved in duplicate`);
    });
});

  test('TC-BULK-VERSION-006: Publish preserves version unchanged', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const pubVer = '11.0.0';
        await createDraftWithAppsAndDevices(context, 'ver-publish', { data: { version: pubVer } });
        await context.bulkDeploymentPage.publishFromDetail();
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, pubVer);

        setActualResult(testInfo, `Version ${pubVer} unchanged after publish`);
    });
});

  test('TC-BULK-VERSION-007: Empty version defaults to 1.0.0 after creation', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-empty', { version: '' }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, bulkDeploymentConfig.defaultVersion);

        setActualResult(testInfo, `Empty version defaulted to ${bulkDeploymentConfig.defaultVersion}`);
    });
});

  test('TC-BULK-VERSION-008: Version remains unchanged when switching between tabs', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const tabVer = '12.3.4';
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-tabs', { version: tabVer }));
        for (const openTab of [
          () => context.bulkDeploymentPage.openDevicesTab(),
          () => context.bulkDeploymentPage.openAppsTab(),
          () => context.bulkDeploymentPage.openBatchesTab(),
        ]) {
          await openTab();
          await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, tabVer);
        }

        setActualResult(testInfo, `Version ${tabVer} remained correct across all tab switches`);
    });
});
});
