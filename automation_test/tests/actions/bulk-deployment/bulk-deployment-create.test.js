const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  futureScheduleDate,
  makeString,
  setActualResult,
  setTestCaseMetadata,
} = require('./bulk-deployment-test-helpers');

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-CREATE-001 ~ 002 : Happy path create with minimum and full data
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Create - Success', () => {
  test('TC-BULK-CREATE-001 ~ 002: Create draft with minimum data and full data', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-001~002',
      category: 'Bulk Deployment Create',
      title: 'Create Draft with minimum required data and with all fields populated',
      precondition: 'User is logged in; at least one device and app are available',
      steps: [
        'Create deployment with minimum required fields (name, OS, batch size, schedule None)',
        'Verify all overview fields reflect submitted values',
        'Create deployment with all fields including description, reboot, force update, device, and app',
        'Verify overview, Devices tab, Apps tab, and Batches tab (empty for Draft)',
      ],
      expected: 'Both deployments are created as Draft and overview data is consistent',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-CREATE-001: minimum data
    const minData = createDeploymentData('create-minimum', { description: '', rebootDevice: true, forceUpdate: false });
    await context.bulkDeploymentPage.createDraftDeployment(minData);
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', minData.name);
    await context.bulkDeploymentPage.expectOverviewValue('Status', 'Draft');
    await context.bulkDeploymentPage.expectOverviewValue('Target OS', minData.targetOS);
    await context.bulkDeploymentPage.expectOverviewValue('Version', minData.version);
    await context.bulkDeploymentPage.expectOverviewValue('Batch Size', minData.batchSize);
    await context.bulkDeploymentPage.expectOverviewValue('Description', '-');
    await context.bulkDeploymentPage.expectOverviewValue('Reboot Device', 'Enable');
    await context.bulkDeploymentPage.expectOverviewValue('Force Update', 'Disable');
    const startOn1 = await context.bulkDeploymentPage.getOverviewValue('Start On');
    const endOn1 = await context.bulkDeploymentPage.getOverviewValue('End On');
    expect(['', '-']).toContain(startOn1);
    expect(['', '-']).toContain(endOn1);

    // TC-BULK-CREATE-002: full data with device + app
    const fullData = createDeploymentData('create-full', {
      description: 'Automation draft deployment with app and device',
      rebootDevice: true,
      forceUpdate: true,
    });
    await context.bulkDeploymentPage.createDraftDeployment(fullData);
    const addedDeviceName = await context.bulkDeploymentPage.addFirstAvailableDevice(bulkDeploymentConfig.deviceSearchKeyword);
    const addedAppName = await context.bulkDeploymentPage.addFirstAvailableApp(bulkDeploymentConfig.appSearchKeyword);

    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', fullData.name);
    await context.bulkDeploymentPage.expectOverviewValue('Status', 'Draft');
    await context.bulkDeploymentPage.expectOverviewValue('Description', fullData.description);
    await context.bulkDeploymentPage.expectOverviewValue('Reboot Device', 'Enable');
    await context.bulkDeploymentPage.expectOverviewValue('Force Update', 'Enable');
    await context.bulkDeploymentPage.openDevicesTab();
    await expect(page.getByText(addedDeviceName, { exact: true }).first()).toBeVisible();
    await context.bulkDeploymentPage.openAppsTab();
    await expect(page.getByText(addedAppName, { exact: true }).first()).toBeVisible();
    await context.bulkDeploymentPage.openBatchesTab();
    await context.bulkDeploymentPage.expectBatchesEmptyState();

    setActualResult(testInfo, `Minimum-data draft and full-data draft (device="${addedDeviceName}", app="${addedAppName}") created successfully`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-CREATE-003 ~ 004, 007, 010 ~ 013 : Form validation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Create - Validation', () => {
  test('TC-BULK-CREATE-003 ~ 004, 012: Required fields block Save as Draft', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-003~004,012',
      category: 'Bulk Deployment Create',
      title: 'Required fields (Name, Target OS, Batch Size) block Save as Draft',
      precondition: 'User is logged in; Add Deployment modal is available',
      steps: [
        'Open modal with empty Name → Save as Draft should be blocked',
        'Open modal without Target OS → Save as Draft should be blocked',
        'Open modal without Batch Size → Save as Draft should be blocked',
      ],
      expected: 'Save as Draft stays disabled for each missing required field',
    });

    const context = createBulkDeploymentContext(page);

    // Missing name
    await context.bulkDeploymentPage.openAddDeploymentModal();
    await context.bulkDeploymentPage.fillDeploymentForm({
      targetOS: bulkDeploymentConfig.defaultTargetOS,
      batchSize: bulkDeploymentConfig.defaultBatchSize,
      schedule: bulkDeploymentConfig.defaultSchedule,
    });
    await context.bulkDeploymentPage.saveAsDraftExpectBlocked();

    // Missing OS
    await context.bulkDeploymentPage.openAddDeploymentModal();
    await context.bulkDeploymentPage.fillDeploymentForm({
      name: createDeploymentData('missing-os').name,
      batchSize: bulkDeploymentConfig.defaultBatchSize,
      schedule: bulkDeploymentConfig.defaultSchedule,
    });
    await context.bulkDeploymentPage.saveAsDraftExpectBlocked();

    // Missing batch size
    await context.bulkDeploymentPage.openAddDeploymentModal();
    await context.bulkDeploymentPage.fillDeploymentForm({
      name: createDeploymentData('missing-batch').name,
      targetOS: bulkDeploymentConfig.defaultTargetOS,
      schedule: bulkDeploymentConfig.defaultSchedule,
    });
    await context.bulkDeploymentPage.saveAsDraftExpectBlocked();

    setActualResult(testInfo, 'Save as Draft remained disabled for each missing required field (Name, OS, Batch Size)');
  });

  test('TC-BULK-CREATE-007, 010, 011, 013: Field max-length, defaults, and Schedule None', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-007,010,011,013',
      category: 'Bulk Deployment Create',
      title: 'Name/Description max-length limits, default Version, Schedule None behavior',
      precondition: 'User is logged in; Add Deployment modal is available',
      steps: [
        'Enter Name > 50 chars → verify capped at 50 and counter shows 50/50',
        'Enter Description > 200 chars → verify capped at 200 and counter shows 200/200',
        'Open modal and verify Version defaults to 1.0.0',
        'Create draft with Schedule None → Start On and End On should be empty/dash',
      ],
      expected: 'Name capped at 50; Description at 200; Version defaults correctly; Schedule None accepted',
    });

    const context = createBulkDeploymentContext(page);

    // Name max length
    await context.bulkDeploymentPage.openAddDeploymentModal();
    const nameInput = context.bulkDeploymentPage.inputByLabel('Deployment Name');
    await nameInput.fill(makeString(55, 'N'));
    expect((await nameInput.inputValue()).length).toBe(50);
    await expect(page.getByText('50/50 characters')).toBeVisible();

    // Description max length
    const descTextarea = context.bulkDeploymentPage.textareaByLabel('Description');
    await descTextarea.fill(makeString(205, 'D'));
    expect((await descTextarea.inputValue()).length).toBe(200);
    await expect(page.getByText('200/200 characters')).toBeVisible();

    // Default version
    const versionValue = await context.bulkDeploymentPage.inputByLabel('Version').inputValue();
    expect(versionValue).toBe(bulkDeploymentConfig.defaultVersion);

    // Schedule None → empty dates
    const noneData = createDeploymentData('schedule-none');
    await context.bulkDeploymentPage.createDraftDeployment(noneData);
    expect(['', '-']).toContain(await context.bulkDeploymentPage.getOverviewValue('Start On'));
    expect(['', '-']).toContain(await context.bulkDeploymentPage.getOverviewValue('End On'));

    setActualResult(testInfo, 'Name/Description limits enforced; Version defaulted correctly; Schedule None accepted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-CREATE-005 ~ 006 : Known issues (expected to fail)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Create - Known Issues', () => {
  test('TC-BULK-CREATE-005: Cannot create deployment without app (known issue)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system creates draft without apps and Publish remains enabled.');
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-005',
      category: 'Bulk Deployment Create',
      title: 'Cannot create deployment without adding app',
      precondition: 'Business rule expects at least one app before publish is allowed',
      steps: ['Create draft without app', 'Verify Publish is disabled'],
      expected: 'Publish should be disabled when no app is assigned',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('known-no-app'));
    await context.bulkDeploymentPage.openAppsTab();
    await context.bulkDeploymentPage.expectAppsEmptyState();
    const publishEnabled = await context.bulkDeploymentPage.publishButton.isEnabled();
    setActualResult(testInfo, `Publish enabled=${publishEnabled}. Defect candidate.`);
    expect(publishEnabled).toBe(false);
  });

  test('TC-BULK-CREATE-006: Cannot create deployment without device (known issue)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system creates draft without devices and Publish remains enabled.');
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-006',
      category: 'Bulk Deployment Create',
      title: 'Cannot create deployment without assigning device',
      precondition: 'Business rule expects at least one device before publish is allowed',
      steps: ['Create draft without device', 'Verify Publish is disabled'],
      expected: 'Publish should be disabled when no device is assigned',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('known-no-device'));
    await context.bulkDeploymentPage.openDevicesTab();
    await context.bulkDeploymentPage.expectDevicesEmptyState();
    const publishEnabled = await context.bulkDeploymentPage.publishButton.isEnabled();
    setActualResult(testInfo, `Publish enabled=${publishEnabled}. Defect candidate.`);
    expect(publishEnabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-CREATE-008, 009, 014 ~ 017 : Optional fields and edge cases
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Create - Optional Fields and Edge Cases', () => {
  test('TC-BULK-CREATE-008 ~ 009, 014 ~ 017: Description, duplicate name, cancel, device behavior, trim, special chars', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-008~009,014~017',
      category: 'Bulk Deployment Create',
      title: 'Optional fields, cancel, duplicate name, device behavior, name trim/special chars',
      precondition: 'User is logged in',
      steps: [
        'Create with empty Description → Description should display dash',
        'Create two drafts with same name → both created with different IDs',
        'Cancel Add Deployment modal → no deployment created',
        'Create with Reboot+Force Update enabled → verify Enable values in overview',
        'Create with name with leading/trailing spaces → trimmed name saved',
        'Create with special chars in name → name displayed correctly',
      ],
      expected: 'All edge cases handled correctly per product behavior',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-CREATE-008: empty description
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('empty-desc', { description: '' }));
    await context.bulkDeploymentPage.expectOverviewValue('Description', '-');

    // TC-BULK-CREATE-009: duplicate name
    const dupName = createDeploymentData('dup-name').name;
    const first = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-first', { name: dupName }));
    const second = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-second', { name: dupName }));
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);

    // TC-BULK-CREATE-014: cancel closes modal without creating
    const cancelData = createDeploymentData('cancel-create');
    await context.bulkDeploymentPage.openAddDeploymentModal();
    await context.bulkDeploymentPage.fillDeploymentForm(cancelData);
    await context.bulkDeploymentPage.cancelButton.click();
    await expect(context.bulkDeploymentPage.addDeploymentModalTitle.first()).toBeHidden();
    await context.bulkDeploymentPage.searchDeployment(cancelData.name);
    await context.bulkDeploymentPage.expectNoDeploymentResults();

    // TC-BULK-CREATE-015: device behavior
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('device-behavior', { rebootDevice: true, forceUpdate: true }));
    await context.bulkDeploymentPage.expectOverviewValue('Reboot Device', 'Enable');
    await context.bulkDeploymentPage.expectOverviewValue('Force Update', 'Enable');

    // TC-BULK-CREATE-016: name trim
    const trimmedName = createDeploymentData('trim-name').name;
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('trim-submit', { name: `  ${trimmedName}  ` }));
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', trimmedName);

    // TC-BULK-CREATE-017: special chars
    const specialName = `Bulk_Auto-01.Test_${Date.now()}`.slice(0, 50);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('special-name', { name: specialName }));
    await context.bulkDeploymentPage.expectOverviewValue('Deployment Name', specialName);

    setActualResult(testInfo, 'All edge cases verified: empty desc, duplicate name, cancel, device behavior, trim, special chars');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-CREATE-018 ~ 030 : Extended coverage — version, apps, devices, schedule, batch
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Create - Extended Coverage', () => {
  test('TC-BULK-CREATE-018 ~ 021: Version custom, empty default, trim, list consistency', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-018~021',
      category: 'Bulk Deployment Create',
      title: 'Version: custom, empty→default, trim, and list consistency',
      precondition: 'User is logged in',
      steps: [
        'Create with custom Version → verify in overview',
        'Create with empty Version → verify defaults to 1.0.0',
        'Create with Version with spaces → verify trimmed',
        'Verify Version is consistent between detail and list',
      ],
      expected: 'Version is saved, normalized, and consistent between detail and list',
    });

    const context = createBulkDeploymentContext(page);

    // custom version
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-custom', { version: '2.0.5' }));
    await context.bulkDeploymentPage.expectOverviewValue('Version', '2.0.5');

    // empty → default
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-empty', { version: '' }));
    await context.bulkDeploymentPage.expectOverviewValue('Version', bulkDeploymentConfig.defaultVersion);

    // trim
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-trim', { version: '  3.1.4  ' }));
    await context.bulkDeploymentPage.expectOverviewValue('Version', '3.1.4');

    // list consistency
    const listVerData = createDeploymentData('ver-list', { version: '4.0.1' });
    await context.bulkDeploymentPage.createDraftDeployment(listVerData);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(listVerData.name);
    expect(await context.bulkDeploymentPage.getListCellText(listVerData.name, 'version')).toContain(listVerData.version);

    setActualResult(testInfo, 'Version custom/empty/trim/list-consistency all verified');
  });

  test('TC-BULK-CREATE-022 ~ 027: Create with apps and devices (Digital Signage, counter_now, Online, Offline)', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-022~027',
      category: 'Bulk Deployment Create',
      title: 'Add Digital Signage, counter_now, Online device, Offline device to new deployments',
      precondition: 'Digital Signage, counter_now, Online device, Offline device are available',
      steps: [
        'Create draft + add Digital Signage',
        'Create draft + add counter_now',
        'Create draft + add Digital Signage and counter_now together',
        'Create draft + add Online device',
        'Create draft + add Offline device',
        'Create draft + add Online + Offline devices together',
      ],
      expected: 'Each app/device combination is assigned and visible in the correct tab',
    });

    const context = createBulkDeploymentContext(page);

    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-digital-signage'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);

    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-counter-now'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appCounterNow]);

    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-two-apps'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage, bulkDeploymentConfig.appCounterNow]);

    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-online'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);

    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-offline'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.offlineDeviceName]);

    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-two-devices'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName]);

    setActualResult(testInfo, 'All app/device add combinations created successfully');
  });

  test('TC-BULK-CREATE-028 ~ 030: Future schedule, custom batch size, Add App no-result', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-CREATE-028~030',
      category: 'Bulk Deployment Create',
      title: 'Future schedule, custom Batch Size, and Add App modal no-result state',
      precondition: 'User is logged in',
      steps: [
        'Create with Future schedule → Start On should be populated',
        'Create with custom Batch Size 37 → verify in overview',
        'Open Add App modal, enter invalid keyword → no-result state visible, Assign disabled',
      ],
      expected: 'Future schedule populates Start On; custom batch size persists; invalid app keyword shows no-result',
    });

    const context = createBulkDeploymentContext(page);

    // future schedule
    const future = futureScheduleDate(1);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-future', {
      schedule: 'Future',
      scheduleDate: future.date,
      scheduleTime: future.time,
    }));
    const startOn = await context.bulkDeploymentPage.getOverviewValue('Start On');
    expect(startOn).not.toBe('');
    expect(startOn).not.toBe('-');

    // custom batch size
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-batch-37', { batchSize: '37' }));
    await context.bulkDeploymentPage.expectOverviewValue('Batch Size', '37');

    // Add App no-result
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-app-no-result'));
    await context.bulkDeploymentPage.openAddAppModal();
    const keyword = `zz_no_app_${Date.now()}`;
    await page.getByPlaceholder('Search and select app').fill(keyword);
    await page.waitForTimeout(700);
    await expect(page.getByText('No apps match your search.')).toBeVisible();
    await expect(context.bulkDeploymentPage.dialogByTitle('Add App').getByRole('button', { name: 'Assign' })).toBeDisabled();

    setActualResult(testInfo, `Future Start On="${startOn}"; batch 37 saved; invalid app keyword showed no-result`);
  });
});
