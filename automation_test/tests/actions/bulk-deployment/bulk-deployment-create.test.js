const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  futureScheduleDate,
  makeString,
  setActualResult,
} = require('./bulk-deployment-test-helpers');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

test.describe('Bulk Deployment - Create - Success', () => {
  test('TC-BULK-CREATE-001 ~ 002: Create draft with minimum data and full data', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);

        const minData = createDeploymentData('create-minimum', { description: '', rebootDevice: true, forceUpdate: false });
        await context.bulkDeploymentPage.createDraftDeployment(minData);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, minData.name);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_STATUS, T.STATUS_DRAFT);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_TARGET_OS, minData.targetOS);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, minData.version);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, minData.batchSize);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, '-');
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE, 'Enable');
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE, 'Disable');
        const startOn1 = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
        const endOn1 = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_END_ON);
        expect(['', '-']).toContain(startOn1);
        expect(['', '-']).toContain(endOn1);

        const fullData = createDeploymentData('create-full', {
          description: 'Automation draft deployment with app and device',
          rebootDevice: true,
          forceUpdate: true,
        });
        await context.bulkDeploymentPage.createDraftDeployment(fullData);
        const addedDeviceName = await context.bulkDeploymentPage.addFirstAvailableDevice(bulkDeploymentConfig.deviceSearchKeyword);
        const addedAppName = await context.bulkDeploymentPage.addFirstAvailableApp(bulkDeploymentConfig.appSearchKeyword);

        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, fullData.name);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_STATUS, T.STATUS_DRAFT);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, fullData.description);
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE, 'Enable');
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE, 'Enable');
        await context.bulkDeploymentPage.openDevicesTab();
        await expect(context.bulkDeploymentPage.rowByText(addedDeviceName)).toBeVisible();
        await context.bulkDeploymentPage.openAppsTab();
        await expect(context.bulkDeploymentPage.rowByText(addedAppName)).toBeVisible();
        await context.bulkDeploymentPage.openBatchesTab();
        await context.bulkDeploymentPage.expectBatchesEmptyState();

        setActualResult(testInfo, `Minimum-data draft and full-data draft (device="${addedDeviceName}", app="${addedAppName}") created successfully`);
    });
});
});

test.describe('Bulk Deployment - Create - Validation', () => {
  test('TC-BULK-CREATE-003 ~ 004, 012: Required fields block Save as Draft', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);

        await context.bulkDeploymentPage.openAddDeploymentModal();
        await context.bulkDeploymentPage.fillDeploymentForm({
          targetOS: bulkDeploymentConfig.defaultTargetOS,
          batchSize: bulkDeploymentConfig.defaultBatchSize,
          schedule: bulkDeploymentConfig.defaultSchedule,
        });
        await context.bulkDeploymentPage.saveAsDraftExpectBlocked();

        await context.bulkDeploymentPage.openAddDeploymentModal();
        await context.bulkDeploymentPage.fillDeploymentForm({
          name: createDeploymentData('missing-os').name,
          batchSize: bulkDeploymentConfig.defaultBatchSize,
          schedule: bulkDeploymentConfig.defaultSchedule,
        });
        await context.bulkDeploymentPage.saveAsDraftExpectBlocked();

        await context.bulkDeploymentPage.openAddDeploymentModal();
        await context.bulkDeploymentPage.fillDeploymentForm({
          name: createDeploymentData('missing-batch').name,
          targetOS: bulkDeploymentConfig.defaultTargetOS,
          schedule: bulkDeploymentConfig.defaultSchedule,
        });
        await context.bulkDeploymentPage.saveAsDraftExpectBlocked();

        setActualResult(testInfo, 'Save as Draft remained disabled for each missing required field (Name, OS, Batch Size)');
    });
});

  test('TC-BULK-CREATE-007, 010, 011, 013: Field max-length, defaults, and Schedule None', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);

        await context.bulkDeploymentPage.openAddDeploymentModal();
        const nameInput = context.bulkDeploymentPage.inputByLabel(T.FORM.NAME_LABEL);
        await nameInput.fill(makeString(55, 'N'));
        expect((await nameInput.inputValue()).length).toBe(BULK_DEPLOYMENT.LIMITS.DEPLOYMENT_NAME_MAX);
        await expect(context.bulkDeploymentPage.getCharCounterNameMax()).toBeVisible();

        const descTextarea = context.bulkDeploymentPage.textareaByLabel(T.FORM.DESCRIPTION_LABEL);
        await descTextarea.fill(makeString(205, 'D'));
        expect((await descTextarea.inputValue()).length).toBe(BULK_DEPLOYMENT.LIMITS.DESCRIPTION_MAX);
        await expect(context.bulkDeploymentPage.getCharCounterDescMax()).toBeVisible();

        const versionValue = await context.bulkDeploymentPage.inputByLabel(T.FORM.VERSION_LABEL).inputValue();
        expect(versionValue).toBe(bulkDeploymentConfig.defaultVersion);

        const noneData = createDeploymentData('schedule-none');
        await context.bulkDeploymentPage.createDraftDeployment(noneData);
        expect(['', '-']).toContain(await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON));
        expect(['', '-']).toContain(await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_END_ON));

        setActualResult(testInfo, 'Name/Description limits enforced; Version defaulted correctly; Schedule None accepted');
    });
});
});

test.describe('Bulk Deployment - Create - Known Issues', () => {
  test('TC-BULK-CREATE-005: Cannot create deployment without app (known issue)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system creates draft without apps and Publish remains enabled.');    const context = createBulkDeploymentContext(page);
await test.step('Run main flow', async () => {
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('known-no-app'));
        await context.bulkDeploymentPage.openAppsTab();
        await context.bulkDeploymentPage.expectAppsEmptyState();
        const publishEnabled = await context.bulkDeploymentPage.publishButton.isEnabled();
        setActualResult(testInfo, `Publish enabled=${publishEnabled}. Defect candidate.`);
        expect(publishEnabled).toBe(false);
    });
});

  test('TC-BULK-CREATE-006: Cannot create deployment without device (known issue)', async ({ page }, testInfo) => {
    test.fail(true, 'Known issue: system creates draft without devices and Publish remains enabled.');    const context = createBulkDeploymentContext(page);
await test.step('Run main flow', async () => {
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('known-no-device'));
        await context.bulkDeploymentPage.openDevicesTab();
        await context.bulkDeploymentPage.expectDevicesEmptyState();
        const publishEnabled = await context.bulkDeploymentPage.publishButton.isEnabled();
        setActualResult(testInfo, `Publish enabled=${publishEnabled}. Defect candidate.`);
        expect(publishEnabled).toBe(false);
    });
});
});

test.describe('Bulk Deployment - Create - Optional Fields and Edge Cases', () => {
  test('TC-BULK-CREATE-008: Empty Description shows dash in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('empty-desc', { description: '' }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, '-');

        setActualResult(testInfo, 'Empty description shows dash in overview');
    });
});

  test('TC-BULK-CREATE-009: Two deployments with duplicate names are created with different IDs', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const dupName = createDeploymentData('dup-name').name;
        const first = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-first', { name: dupName }));
        const second = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-second', { name: dupName }));
        expect(first.id).toBeTruthy();
        expect(second.id).toBeTruthy();
        expect(second.id).not.toBe(first.id);

        setActualResult(testInfo, `Two drafts with same name created with different IDs: ${first.id} vs ${second.id}`);
    });
});

  test('TC-BULK-CREATE-014: Cancelling Add Deployment modal does not create a deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const cancelData = createDeploymentData('cancel-create');
        await context.bulkDeploymentPage.openAddDeploymentModal();
        await context.bulkDeploymentPage.fillDeploymentForm(cancelData);
        await context.bulkDeploymentPage.cancelButton.click();
        await expect(context.bulkDeploymentPage.addDeploymentModalTitle.first()).toBeHidden();
        await context.bulkDeploymentPage.searchDeployment(cancelData.name);
        await context.bulkDeploymentPage.expectNoDeploymentResults();

        setActualResult(testInfo, 'Cancel did not create deployment; no results found in list');
    });
});

  test('TC-BULK-CREATE-015: Enabling Reboot Device and Force Update shows Enable in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('device-behavior', { rebootDevice: true, forceUpdate: true }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE, 'Enable');
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE, 'Enable');

        setActualResult(testInfo, 'Reboot Device and Force Update both shown as Enable');
    });
});

  test('TC-BULK-CREATE-016: Deployment name with leading/trailing spaces is trimmed on save', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const trimmedName = createDeploymentData('trim-name').name;
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('trim-submit', { name: `  ${trimmedName}  ` }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, trimmedName);

        setActualResult(testInfo, `Name trimmed correctly to "${trimmedName}"`);
    });
});

  test('TC-BULK-CREATE-017: Deployment name with special characters is displayed correctly', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const specialName = `Bulk_Auto-01.Test_${Date.now()}`.slice(0, 50);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('special-name', { name: specialName }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, specialName);

        setActualResult(testInfo, `Special char name "${specialName}" displayed correctly`);
    });
});
});

test.describe('Bulk Deployment - Create - Extended Coverage', () => {
  test('TC-BULK-CREATE-018: Custom version is saved and shown in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-custom', { version: '2.0.5' }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '2.0.5');

        setActualResult(testInfo, 'Custom version 2.0.5 saved and visible');
    });
});

  test('TC-BULK-CREATE-019: Empty version input defaults to 1.0.0', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-empty', { version: '' }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, bulkDeploymentConfig.defaultVersion);

        setActualResult(testInfo, `Empty version defaulted to ${bulkDeploymentConfig.defaultVersion}`);
    });
});

  test('TC-BULK-CREATE-020: Version with surrounding spaces is trimmed on save', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('ver-trim', { version: '  3.1.4  ' }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '3.1.4');

        setActualResult(testInfo, 'Version trimmed to 3.1.4');
    });
});

  test('TC-BULK-CREATE-021: Version is consistent between detail and list', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const listVerData = createDeploymentData('ver-list', { version: '4.0.1' });
        await context.bulkDeploymentPage.createDraftDeployment(listVerData);
        await context.bulkDeploymentPage.gotoList();
        await context.bulkDeploymentPage.waitForListReady();
        await context.bulkDeploymentPage.searchDeployment(listVerData.name);
        expect(await context.bulkDeploymentPage.getListCellText(listVerData.name, 'version')).toContain(listVerData.version);

        setActualResult(testInfo, 'Version 4.0.1 consistent in detail and list');
    });
});

  test('TC-BULK-CREATE-022: Digital Signage app can be added to a new deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-digital-signage'));
        await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeVisible();

        setActualResult(testInfo, 'Digital Signage added and visible in Apps tab');
    });
});

  test('TC-BULK-CREATE-023: counter_now app can be added to a new deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-counter-now'));
        await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appCounterNow]);
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toBeVisible();

        setActualResult(testInfo, 'counter_now added and visible in Apps tab');
    });
});

  test('TC-BULK-CREATE-024: Digital Signage and counter_now can be added together', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-two-apps'));
        await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage, bulkDeploymentConfig.appCounterNow]);
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeVisible();
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toBeVisible();

        setActualResult(testInfo, 'Digital Signage and counter_now both visible in Apps tab');
    });
});

  test('TC-BULK-CREATE-025: Online device can be added to a new deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-online'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);

        setActualResult(testInfo, 'Online device added and visible in Devices tab');
    });
});

  test('TC-BULK-CREATE-026: Offline device can be added to a new deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-offline'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.offlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName);

        setActualResult(testInfo, 'Offline device added and visible in Devices tab');
    });
});

  test('TC-BULK-CREATE-027: Online and Offline devices can be added together to a new deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-two-devices'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName);

        setActualResult(testInfo, 'Online and Offline devices both visible in Devices tab');
    });
});

  test('TC-BULK-CREATE-028: Future schedule populates Start On in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        const future = futureScheduleDate(1);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-future', {
          schedule: T.FORM.FUTURE,
          scheduleDate: future.date,
          scheduleTime: future.time,
        }));
        const startOn = await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
        expect(startOn).not.toBe('');
        expect(startOn).not.toBe('-');

        setActualResult(testInfo, `Future schedule populated Start On="${startOn}"`);
    });
});

  test('TC-BULK-CREATE-029: Custom Batch Size is saved and shown in overview', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-batch-37', { batchSize: '37' }));
        await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '37');

        setActualResult(testInfo, 'Batch Size 37 saved and visible');
    });
});

  test('TC-BULK-CREATE-030: Invalid app keyword in Add App modal shows no-result state and disables Assign', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('cr-app-no-result'));
        await context.bulkDeploymentPage.openAddAppModal();
        const keyword = `zz_no_app_${Date.now()}`;
        await context.bulkDeploymentPage.searchAppInAddModal(keyword);
        await expect(context.bulkDeploymentPage.getNoAppsMatchText()).toBeVisible();
        await expect(context.bulkDeploymentPage.dialogByTitle(T.DIALOG_ADD_APP).getByRole('button', { name: T.ASSIGN })).toBeDisabled();

        setActualResult(testInfo, `Invalid keyword "${keyword}" showed no-result; Assign disabled`);
    });
});
});
