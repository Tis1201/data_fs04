const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  createDraftWithAppsAndDevices,
  futureScheduleDate,
  setActualResult,
  setTestCaseMetadata,
} = require('./bulk-deployment-test-helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Edit
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Edit', () => {
  test('TC-BULK-EDIT-001 ~ 007: Open modal, edit name/description/version/batch/schedule/device behavior, cancel', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-EDIT-001~007',
      category: 'Bulk Deployment Edit',
      title: 'Edit modal, all field edits, schedule change, device behavior, and cancel',
      precondition: 'User is logged in; Draft deployments exist',
      steps: [
        'Open Edit modal → verify fields and Save Changes/Cancel buttons',
        'Edit Deployment Name → verify updated in overview',
        'Edit Description → verify updated in overview',
        'Edit Version → verify updated in overview',
        'Edit Batch Size → verify updated in overview',
        'Edit Schedule from None to Future → verify Start On populated',
        'Enable Reboot Device and Force Update → verify Enable values',
        'Cancel edit → verify original name unchanged',
      ],
      expected: 'All edits save correctly; cancel leaves data unchanged',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-EDIT-001: open modal
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-open'));
    const dialog = await context.bulkDeploymentPage.openEditDeploymentModal();
    await expect(dialog.getByText('Deployment Name')).toBeVisible();
    await expect(dialog.getByText('Target to Operating System')).toBeVisible();
    await expect(dialog.getByText('Version')).toBeVisible();
    await expect(dialog.getByText('Batch Size')).toBeVisible();
    await expect(dialog.getByText('Schedule')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // TC-BULK-EDIT-002: edit name
    const original = createDeploymentData('edit-name');
    await context.bulkDeploymentPage.createDraftDeployment(original);
    const updatedName = `${original.name}-updated`;
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ name: updatedName });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', updatedName);

    // TC-BULK-EDIT-003: edit description
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-desc'));
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ description: 'Updated automation description' });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Description', 'Updated automation description');

    // TC-BULK-EDIT-004: edit version
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-version'));
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ version: '5.6.7' });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Version', '5.6.7');

    // TC-BULK-EDIT-005: edit batch size
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-batch'));
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ batchSize: '200' });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Batch Size', '200');

    // TC-BULK-EDIT-006: schedule None → Future
    const future = futureScheduleDate(1);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-future'));
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    const startOn = await context.bulkDeploymentPage.getOverviewValue('Start On');
    expect(startOn).not.toBe('');
    expect(startOn).not.toBe('-');

    // TC-BULK-EDIT-007: device behavior
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-device-behavior'));
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ rebootDevice: true, forceUpdate: true });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Reboot Device', 'Enable');
    await context.bulkDeploymentPage.expectOverviewValue('Force Update', 'Enable');

    // TC-BULK-EDIT-008: cancel
    const cancelOrig = createDeploymentData('edit-cancel');
    await context.bulkDeploymentPage.createDraftDeployment(cancelOrig);
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ name: `${cancelOrig.name}-not-saved` });
    await context.bulkDeploymentPage.cancelEdit();
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', cancelOrig.name);

    setActualResult(testInfo, 'All edit operations verified: name, description, version, batch, schedule, device behavior, cancel');
  });

  test('TC-BULK-EDIT-009 ~ 012: Empty name blocked, no-change save, audit after edit, list/detail sync', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-EDIT-009~012',
      category: 'Bulk Deployment Edit',
      title: 'Empty name blocked, no-change save, audit visible, list/detail sync',
      precondition: 'User is logged in; Draft deployment exists',
      steps: [
        'Open Edit modal, clear name → Save Changes blocked',
        'Open Edit modal, save without changes → original data unchanged',
        'Edit description, save → audit info remains visible',
        'Edit name+version, save → verify updates on both detail and list page',
      ],
      expected: 'Empty name blocked; no-change save preserves data; audit visible; list/detail in sync',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-EDIT-009: empty name blocked
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-empty-name'));
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ name: '' });
    await context.bulkDeploymentPage.saveEditExpectBlocked();

    // TC-BULK-EDIT-010: save without changes
    const noChangeData = createDeploymentData('edit-no-change', { description: 'No change edit baseline' });
    await context.bulkDeploymentPage.createDraftDeployment(noChangeData);
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', noChangeData.name);
    await context.bulkDeploymentPage.expectOverviewValue('Description', noChangeData.description);

    // TC-BULK-EDIT-011: audit after edit
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('edit-audit'));
    await context.bulkDeploymentPage.expectAuditInfoVisible();
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ description: 'Audit after edit' });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectAuditInfoVisible();

    // TC-BULK-EDIT-012: list/detail sync
    const syncData = createDeploymentData('edit-list-sync');
    await context.bulkDeploymentPage.createDraftDeployment(syncData);
    const syncName = `${syncData.name}-sync`;
    const syncVersion = '8.8.8';
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ name: syncName, version: syncVersion });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', syncName);
    await context.bulkDeploymentPage.expectOverviewValue('Version', syncVersion);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(syncName);
    const listVersion = await context.bulkDeploymentPage.getListCellText(syncName, 'version');
    expect(listVersion).toContain(syncVersion);

    setActualResult(testInfo, 'Empty name blocked; no-change preserved; audit visible; list/detail synced');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Publish
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Publish', () => {
  test('TC-BULK-PUBLISH-001 ~ 006: Publish happy, no-app/no-device (known issue), offline, scheduled, action buttons', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-PUBLISH-001,004~006',
      category: 'Bulk Deployment Publish',
      title: 'Publish happy path, offline device, scheduled, action buttons after publish',
      precondition: 'Online/Offline test devices and Digital Signage app are available',
      steps: [
        'Draft+device+app → Publish → status not Draft, Publish button gone',
        'Offline device+app → Publish → status not Draft, Offline device retained',
        'Future schedule+device+app → Publish → status Scheduled, Start On populated',
        'After publish → Publish hidden, Duplicate visible, Delete hidden',
      ],
      expected: 'Publish transitions status correctly for each scenario; action buttons update',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-PUBLISH-001: happy path
    await createDraftWithAppsAndDevices(context, 'publish-happy');
    await context.bulkDeploymentPage.publishFromDetail();
    await expect.poll(() => context.bulkDeploymentPage.getOverviewValue('Status'), {
      timeout: context.bulkDeploymentPage.timeout,
      message: 'Status should transition out of Draft',
    }).not.toContain('Draft');
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Publish')).toBe(false);

    // TC-BULK-PUBLISH-004: offline device
    await createDraftWithAppsAndDevices(context, 'publish-offline', {
      deviceNames: [bulkDeploymentConfig.offlineDeviceName],
      appNames: [bulkDeploymentConfig.appDigitalSignage],
    });
    await context.bulkDeploymentPage.publishFromDetail();
    await expect.poll(() => context.bulkDeploymentPage.getOverviewValue('Status'), {
      timeout: context.bulkDeploymentPage.timeout,
    }).not.toContain('Draft');
    await context.bulkDeploymentPage.openDevicesTab();
    await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName, 'Offline');

    // TC-BULK-PUBLISH-005: future schedule
    const future = futureScheduleDate(1);
    await createDraftWithAppsAndDevices(context, 'publish-scheduled', {
      data: { schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time },
    });
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Status', 'Scheduled');
    const startOn = await context.bulkDeploymentPage.getOverviewValue('Start On');
    expect(startOn).not.toBe('');
    expect(startOn).not.toBe('-');

    // TC-BULK-PUBLISH-006: action buttons after publish
    await createDraftWithAppsAndDevices(context, 'publish-actions');
    await context.bulkDeploymentPage.publishFromDetail();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await context.bulkDeploymentPage.waitForPageReady();
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Publish')).toBe(false);
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Duplicate')).toBe(true);
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Delete')).toBe(false);

    setActualResult(testInfo, 'Publish happy/offline/scheduled/action-buttons all verified');
  });

  test('TC-BULK-PUBLISH-002 ~ 003: Cannot publish without app/device (known issues)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system may allow publishing without app or device.');
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-PUBLISH-002~003',
      category: 'Bulk Deployment Publish',
      title: 'Cannot publish without app or device',
      precondition: 'Business rule expects at least one app and one device before publish',
      steps: [
        'Draft+device (no app) → Publish → should stay Draft',
        'Draft+app (no device) → Publish → should stay Draft',
      ],
      expected: 'Publish blocked until both app and device are assigned',
    });

    const context = createBulkDeploymentContext(page);

    // no app
    await createDraftWithAppsAndDevices(context, 'publish-no-app', { appNames: [], deviceNames: [bulkDeploymentConfig.onlineDeviceName] });
    await context.bulkDeploymentPage.publishFromDetail();
    const status1 = await context.bulkDeploymentPage.getOverviewValue('Status');

    // no device
    await createDraftWithAppsAndDevices(context, 'publish-no-device', { appNames: [bulkDeploymentConfig.appDigitalSignage], deviceNames: [] });
    await context.bulkDeploymentPage.publishFromDetail();
    const status2 = await context.bulkDeploymentPage.getOverviewValue('Status');

    setActualResult(testInfo, `No-app status="${status1}", no-device status="${status2}". Defect candidate.`);
    expect(status1).toContain('Draft');
    expect(status2).toContain('Draft');
  });

  test('TC-BULK-PUBLISH-007 ~ 010: List publish cancel/confirm, Version retained, Batch Size retained', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-PUBLISH-007~010',
      category: 'Bulk Deployment Publish',
      title: 'List page publish cancel/confirm, Version and Batch Size preserved after publish',
      precondition: 'Online device and Digital Signage app are available',
      steps: [
        'Create draft → list Publish → Cancel → status stays Draft',
        'Create draft → list Publish → Confirm → status not Draft',
        'Publish with custom Version → verify Version unchanged in detail and list',
        'Publish with custom Batch Size → verify Batch Size unchanged',
      ],
      expected: 'List publish works correctly; Version and Batch Size are preserved through publish',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-PUBLISH-007: list cancel
    const cancelCreated = await createDraftWithAppsAndDevices(context, 'publish-list-cancel');
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(cancelCreated.data.name);
    await context.bulkDeploymentPage.selectRowAction(cancelCreated.data.name, 'Publish');
    const cancelDialog = context.bulkDeploymentPage.dialogByTitle('Deployment Confirm');
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole('button', { name: 'Cancel' }).click();
    const statusAfterCancel = await context.bulkDeploymentPage.getListCellText(cancelCreated.data.name, 'status');
    expect(statusAfterCancel).toContain('Draft');

    // TC-BULK-PUBLISH-008: list confirm
    const confirmCreated = await createDraftWithAppsAndDevices(context, 'publish-list-confirm');
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(confirmCreated.data.name);
    await context.bulkDeploymentPage.selectRowAction(confirmCreated.data.name, 'Publish');
    const confirmDialog = context.bulkDeploymentPage.dialogByTitle('Deployment Confirm');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Confirm' }).click();
    await context.bulkDeploymentPage.waitForToastOrNetwork();
    await expect.poll(() => context.bulkDeploymentPage.getListCellText(confirmCreated.data.name, 'status'), {
      timeout: context.bulkDeploymentPage.timeout,
    }).not.toContain('Draft');

    // TC-BULK-PUBLISH-009: Version retained
    const version = '10.2.0';
    const verCreated = await createDraftWithAppsAndDevices(context, 'publish-version', { data: { version } });
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Version', version);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(verCreated.data.name);
    expect(await context.bulkDeploymentPage.getListCellText(verCreated.data.name, 'version')).toContain(version);

    // TC-BULK-PUBLISH-010: Batch Size retained
    await createDraftWithAppsAndDevices(context, 'publish-batch', { data: { batchSize: '37' } });
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Batch Size', '37');

    setActualResult(testInfo, 'List publish cancel/confirm works; Version and Batch Size preserved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Delete', () => {
  test('TC-BULK-DELETE-001 ~ 004: Detail cancel/confirm, list cancel/confirm delete', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-DELETE-001~004',
      category: 'Bulk Deployment Delete',
      title: 'Cancel and confirm delete from detail and list pages',
      precondition: 'User is logged in; Draft deployments exist',
      steps: [
        'Detail page → Delete → Cancel → deployment remains',
        'Detail page → Delete → Confirm → deployment gone from list',
        'List page → Delete → Cancel → row stays visible',
        'List page → Delete → Confirm → deployment gone from list',
      ],
      expected: 'Cancel preserves deployment; confirm deletes it from both locations',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-DELETE-001: detail cancel
    const cancelCreated = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('del-cancel-detail'));
    await context.bulkDeploymentPage.deleteFromDetail(false);
    expect(context.bulkDeploymentPage.getDeploymentIdFromUrl()).toBe(cancelCreated.id);

    // TC-BULK-DELETE-002: detail confirm
    const detailData = createDeploymentData('del-confirm-detail');
    await context.bulkDeploymentPage.createDraftDeployment(detailData);
    await context.bulkDeploymentPage.deleteFromDetail(true);
    await context.bulkDeploymentPage.searchDeployment(detailData.name);
    await context.bulkDeploymentPage.expectNoDeploymentResults();

    // TC-BULK-DELETE-003: list cancel
    const listCancelData = createDeploymentData('del-cancel-list');
    await context.bulkDeploymentPage.createDraftDeployment(listCancelData);
    await context.bulkDeploymentPage.deleteFromListByName(listCancelData.name, false);
    await expect(context.bulkDeploymentPage.rowByText(listCancelData.name)).toBeVisible();

    // TC-BULK-DELETE-004: list confirm
    const listConfirmData = createDeploymentData('del-confirm-list');
    await context.bulkDeploymentPage.createDraftDeployment(listConfirmData);
    await context.bulkDeploymentPage.deleteFromListByName(listConfirmData.name, true);
    await context.bulkDeploymentPage.searchDeployment(listConfirmData.name);
    await context.bulkDeploymentPage.expectNoDeploymentResults();

    setActualResult(testInfo, 'Detail/list cancel and confirm delete all verified');
  });

  test('TC-BULK-DELETE-005 ~ 006: Delete hidden after publish, scheduled delete', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-DELETE-005~006',
      category: 'Bulk Deployment Delete',
      title: 'Delete hidden after non-scheduled publish; scheduled deployment can be deleted',
      precondition: 'Online device and Digital Signage app are available',
      steps: [
        'Publish non-scheduled → Delete button hidden',
        'Publish scheduled → Delete visible → confirm → deployment gone',
      ],
      expected: 'Non-scheduled published deployment hides Delete; scheduled can be deleted',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-DELETE-005: hidden after publish
    await createDraftWithAppsAndDevices(context, 'del-published');
    await context.bulkDeploymentPage.publishFromDetail();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await context.bulkDeploymentPage.waitForPageReady();
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Delete')).toBe(false);

    // TC-BULK-DELETE-006: scheduled delete
    const future = futureScheduleDate(1);
    const schedCreated = await createDraftWithAppsAndDevices(context, 'del-scheduled', {
      data: { schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time },
    });
    await context.bulkDeploymentPage.publishFromDetail();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await context.bulkDeploymentPage.waitForPageReady();
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Delete')).toBe(true);
    await context.bulkDeploymentPage.deleteFromDetail(true);
    await context.bulkDeploymentPage.searchDeployment(schedCreated.data.name);
    await context.bulkDeploymentPage.expectNoDeploymentResults();

    setActualResult(testInfo, 'Delete hidden after non-scheduled publish; scheduled delete confirmed');
  });

  test('TC-BULK-DELETE-007: Failed deployment Delete visibility', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-DELETE-007',
      category: 'Bulk Deployment Delete',
      title: 'Failed deployment Delete visibility',
      precondition: 'BULK_DEPLOYMENT_FAILED_ID points to a Failed deployment (configured in helpers)',
      steps: ['Open Failed deployment detail page', 'Verify Delete button visibility'],
      expected: 'Failed deployment displays Delete button',
    });
    if (!bulkDeploymentConfig.failedDeploymentId) {
      const msg = 'Blocked: failedDeploymentId is not configured.';
      setActualResult(testInfo, msg);
      throw new Error(msg);
    }

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.gotoDetail(bulkDeploymentConfig.failedDeploymentId);
    await context.bulkDeploymentPage.waitForPageReady();
    expect(await context.bulkDeploymentPage.isDetailActionVisible('Delete')).toBe(true);

    setActualResult(testInfo, 'Failed deployment displayed Delete button');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Duplicate', () => {
  test('TC-BULK-DUPLICATE-001 ~ 008: Cancel, confirm, overview copy, version, apps, devices, name, no batches', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-DUPLICATE-001~008',
      category: 'Bulk Deployment Duplicate',
      title: 'Cancel, confirm, overview fields, version, apps, devices, name, and no batch data',
      precondition: 'Online/Offline devices and Digital Signage/counter_now apps are available',
      steps: [
        'Cancel duplicate → stay on original',
        'Confirm duplicate → new deployment ID, Draft status',
        'Verify overview fields are copied',
        'Verify Version is copied',
        'Verify apps are copied',
        'Verify devices are copied',
        'Verify name is traceable to original',
        'Verify no batch data on duplicated Draft',
      ],
      expected: 'Duplicate copies all configuration; creates new Draft with no batch data',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-DUPLICATE-001: cancel
    const cancelCreated = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-cancel'));
    await context.bulkDeploymentPage.cancelDuplicateFromDetail();
    expect(context.bulkDeploymentPage.getDeploymentIdFromUrl()).toBe(cancelCreated.id);

    // TC-BULK-DUPLICATE-002: confirm → new id + Draft
    const origCreated = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-draft'));
    const dupId = await context.bulkDeploymentPage.duplicateFromDetail();
    expect(dupId).not.toBe(origCreated.id);
    await context.bulkDeploymentPage.expectOverviewValue('Status', 'Draft');

    // TC-BULK-DUPLICATE-003: overview copied
    const overviewData = createDeploymentData('dup-overview', { description: 'Duplicate overview baseline', rebootDevice: true, forceUpdate: true });
    await context.bulkDeploymentPage.createDraftDeployment(overviewData);
    await context.bulkDeploymentPage.duplicateFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', overviewData.name);
    await context.bulkDeploymentPage.expectOverviewValue('Target OS', overviewData.targetOS);
    await context.bulkDeploymentPage.expectOverviewValue('Batch Size', overviewData.batchSize);
    await context.bulkDeploymentPage.expectOverviewValue('Description', overviewData.description);
    await context.bulkDeploymentPage.expectOverviewValue('Reboot Device', 'Enable');
    await context.bulkDeploymentPage.expectOverviewValue('Force Update', 'Enable');

    // TC-BULK-DUPLICATE-004: version copied
    const verData = createDeploymentData('dup-version', { version: '9.1.0' });
    await context.bulkDeploymentPage.createDraftDeployment(verData);
    await context.bulkDeploymentPage.duplicateFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Version', verData.version);

    // TC-BULK-DUPLICATE-005: apps copied
    await createDraftWithAppsAndDevices(context, 'dup-apps', { deviceNames: [], appNames: [bulkDeploymentConfig.appDigitalSignage, bulkDeploymentConfig.appCounterNow] });
    await context.bulkDeploymentPage.duplicateFromDetail();
    await context.bulkDeploymentPage.openAppsTab();
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeVisible();
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toBeVisible();

    // TC-BULK-DUPLICATE-006: devices copied
    await createDraftWithAppsAndDevices(context, 'dup-devices', { appNames: [], deviceNames: [bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName] });
    await context.bulkDeploymentPage.duplicateFromDetail();
    await context.bulkDeploymentPage.openDevicesTab();
    await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);
    await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName);

    // TC-BULK-DUPLICATE-007: name traceable
    const nameData = createDeploymentData('dup-name');
    await context.bulkDeploymentPage.createDraftDeployment(nameData);
    await context.bulkDeploymentPage.duplicateFromDetail();
    const dupName = await context.bulkDeploymentPage.getOverviewValue('Deployment Name');
    expect(dupName).toContain(nameData.name);

    // TC-BULK-DUPLICATE-008: no batch data
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-batches'));
    await context.bulkDeploymentPage.duplicateFromDetail();
    await context.bulkDeploymentPage.openBatchesTab();
    const metrics = await context.bulkDeploymentPage.getBatchMetrics();
    expect(metrics.total).toBe(0);
    await context.bulkDeploymentPage.expectBatchesEmptyState();

    setActualResult(testInfo, 'Duplicate cancel, confirm, overview/version/apps/devices/name/batches all verified');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Batches
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Batches', () => {
  test('TC-BULK-BATCHES-001 ~ 003: Draft empty, metrics after publish, metrics consistency', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-BATCHES-001~003',
      category: 'Bulk Deployment Batches',
      title: 'Draft zero metrics, post-publish metrics visible, metrics consistency',
      precondition: 'Online device and Digital Signage app are available',
      steps: [
        'Draft → Batches tab → zero metrics and empty state',
        'Publish → Batches tab → metrics are numeric and non-negative',
        'Verify each status metric ≤ Total Batches',
      ],
      expected: 'Draft has zero metrics; published deployment has valid metrics',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-BATCHES-001: draft empty
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('batches-draft'));
    await context.bulkDeploymentPage.openBatchesTab();
    const draftMetrics = await context.bulkDeploymentPage.getBatchMetrics();
    expect(draftMetrics).toEqual({ total: 0, completed: 0, inProgress: 0, failed: 0, canceled: 0 });
    await context.bulkDeploymentPage.expectBatchesEmptyState();

    // TC-BULK-BATCHES-002: metrics after publish
    await createDraftWithAppsAndDevices(context, 'batches-publish');
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.openBatchesTab();
    const pubMetrics = await context.bulkDeploymentPage.getBatchMetrics();
    for (const v of Object.values(pubMetrics)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }

    // TC-BULK-BATCHES-003: consistency
    expect(pubMetrics.completed).toBeLessThanOrEqual(pubMetrics.total);
    expect(pubMetrics.inProgress).toBeLessThanOrEqual(pubMetrics.total);
    expect(pubMetrics.failed).toBeLessThanOrEqual(pubMetrics.total);
    expect(pubMetrics.canceled).toBeLessThanOrEqual(pubMetrics.total);

    setActualResult(testInfo, `Draft empty; published metrics: ${JSON.stringify(pubMetrics)}`);
  });

  test('TC-BULK-BATCHES-004 ~ 007: Batch columns, scheduled empty, offline stable, refresh', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-BATCHES-004~007',
      category: 'Bulk Deployment Batches',
      title: 'Batch table columns, scheduled empty, offline stable, refresh keeps metrics',
      precondition: 'Online/Offline devices and Digital Signage app are available',
      steps: [
        'Publish with Online device → if batches > 0, verify table columns',
        'Publish with Future schedule → Total Batches should be 0',
        'Publish with Offline device → metrics remain numeric and non-negative',
        'Refresh Draft Batches tab → metrics still visible',
      ],
      expected: 'Batches behave correctly for published, scheduled, offline, and after refresh',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-BATCHES-004: table columns when batches exist
    await createDraftWithAppsAndDevices(context, 'batches-table');
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.openBatchesTab();
    const tableMetrics = await context.bulkDeploymentPage.getBatchMetrics();
    if (tableMetrics.total > 0) {
      for (const col of ['#', 'Batch Name', 'Devices', 'Status', 'Started On', 'End On']) {
        await expect(page.getByText(col, { exact: true }).first()).toBeVisible();
      }
    }

    // TC-BULK-BATCHES-005: future scheduled → no runtime batches
    const future = futureScheduleDate(1);
    await createDraftWithAppsAndDevices(context, 'batches-scheduled', {
      data: { schedule: 'Future', scheduleDate: future.date, scheduleTime: future.time },
    });
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.openBatchesTab();
    const schedMetrics = await context.bulkDeploymentPage.getBatchMetrics();
    expect(schedMetrics.total).toBe(0);
    await context.bulkDeploymentPage.expectBatchesEmptyState();

    // TC-BULK-BATCHES-006: offline stable
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

    // TC-BULK-BATCHES-007: refresh
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('batches-refresh'));
    await context.bulkDeploymentPage.openBatchesTab();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await context.bulkDeploymentPage.waitForPageReady();
    await context.bulkDeploymentPage.openBatchesTab();
    const refreshMetrics = await context.bulkDeploymentPage.getBatchMetrics();
    expect(refreshMetrics.total).toBeGreaterThanOrEqual(0);

    setActualResult(testInfo, 'Batch columns, scheduled empty, offline stable, and refresh all verified');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Version
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Version', () => {
  test('TC-BULK-VERSION-001 ~ 008: Default, editable, semver, edit, duplicate, publish, empty default, tab switching', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-VERSION-001~008',
      category: 'Bulk Deployment Version',
      title: 'Version: default, editable, semver, edit, duplicate, publish, empty default, tab switching',
      precondition: 'Online device and Digital Signage app are available',
      steps: [
        'Open Add Deployment modal → Version defaults to 1.0.0',
        'Update Version field → verify accepts new value',
        'Create Draft with semver Version → verify in detail and list',
        'Edit Version → verify updated in detail and list',
        'Duplicate → verify Version copied',
        'Publish → verify Version unchanged',
        'Create with empty Version → defaults to 1.0.0',
        'Switch tabs → Version remains unchanged',
      ],
      expected: 'Version is correct through create, edit, duplicate, publish, and tab switching',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-VERSION-001: default
    await context.bulkDeploymentPage.openAddDeploymentModal();
    await expect(context.bulkDeploymentPage.inputByLabel('Version')).toHaveValue(bulkDeploymentConfig.defaultVersion);

    // TC-BULK-VERSION-002: editable
    await context.bulkDeploymentPage.fillInput('Version', '1.2.3');
    await expect(context.bulkDeploymentPage.inputByLabel('Version')).toHaveValue('1.2.3');

    // TC-BULK-VERSION-003: semver persisted
    const semver = '1.2.3-beta';
    const semverData = createDeploymentData('ver-semver', { version: semver });
    await context.bulkDeploymentPage.createDraftDeployment(semverData);
    await context.bulkDeploymentPage.expectOverviewValue('Version', semver);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(semverData.name);
    expect(await context.bulkDeploymentPage.getListCellText(semverData.name, 'version')).toContain(semver);

    // TC-BULK-VERSION-004: edit + list consistency
    const editVerData = createDeploymentData('ver-edit');
    await context.bulkDeploymentPage.createDraftDeployment(editVerData);
    const updatedVer = '6.0.0';
    await context.bulkDeploymentPage.openEditDeploymentModal();
    await context.bulkDeploymentPage.fillEditDeploymentForm({ version: updatedVer });
    await context.bulkDeploymentPage.saveEditExpectDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Version', updatedVer);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(editVerData.name);
    expect(await context.bulkDeploymentPage.getListCellText(editVerData.name, 'version')).toContain(updatedVer);

    // TC-BULK-VERSION-005: duplicate preserves
    const dupVer = '7.7.1';
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-dup', { version: dupVer }));
    await context.bulkDeploymentPage.duplicateFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Version', dupVer);

    // TC-BULK-VERSION-006: publish preserves
    const pubVer = '11.0.0';
    await createDraftWithAppsAndDevices(context, 'ver-publish', { data: { version: pubVer } });
    await context.bulkDeploymentPage.publishFromDetail();
    await context.bulkDeploymentPage.expectOverviewValue('Version', pubVer);

    // TC-BULK-VERSION-007: empty → default
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-empty', { version: '' }));
    await context.bulkDeploymentPage.expectOverviewValue('Version', bulkDeploymentConfig.defaultVersion);

    // TC-BULK-VERSION-008: tab switching
    const tabVer = '12.3.4';
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-tabs', { version: tabVer }));
    for (const openTab of [
      () => context.bulkDeploymentPage.openDevicesTab(),
      () => context.bulkDeploymentPage.openAppsTab(),
      () => context.bulkDeploymentPage.openBatchesTab(),
    ]) {
      await openTab();
      await context.bulkDeploymentPage.expectOverviewValue('Version', tabVer);
    }

    setActualResult(testInfo, 'Version default/editable/semver/edit/dup/publish/empty/tabs all verified');
  });
});
