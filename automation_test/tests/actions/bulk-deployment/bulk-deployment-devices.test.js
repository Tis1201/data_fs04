const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  setActualResult,
  setTestCaseMetadata,
} = require('./bulk-deployment-test-helpers');

test.describe('Bulk Deployment - Devices', () => {
  test('TC-BULK-DEVICES-001 ~ 004: Add Device modal structure and device assignment', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-DEVICES-001~004',
      category: 'Bulk Deployment Devices',
      title: 'Add Device modal structure and single/multiple device assignment',
      precondition: 'Online and Offline test devices are available',
      steps: [
        'Create Draft, open Add Device modal → verify search input, Selected section, Cancel, disabled Add',
        'Add Online device',
        'Add Offline device',
        'Add Online + Offline devices together',
      ],
      expected: 'Modal structure correct; each device combination is added and visible in Devices table',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-DEVICES-001: modal structure
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-modal'));
    const dialog = await context.bulkDeploymentPage.openAddDeviceModal();
    await expect(page.getByPlaceholder('Search and select device')).toBeVisible();
    await expect(page.getByText('Selected (0 items)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Add$/ })).toBeDisabled();

    // TC-BULK-DEVICES-002: Online
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-online'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);

    // TC-BULK-DEVICES-003: Offline
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-offline'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.offlineDeviceName]);

    // TC-BULK-DEVICES-004: both
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-two'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName]);

    setActualResult(testInfo, 'Add Device modal verified; Online, Offline, and both together assigned');
  });

  test('TC-BULK-DEVICES-005 ~ 011: Remove, search, Import CSV, Assign by tag, duplicate, status, no-result', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-DEVICES-005~011',
      category: 'Bulk Deployment Devices',
      title: 'Remove device, search, Import CSV, Assign by tag, duplicate block, Online/Offline status, no-result',
      precondition: 'Online and Offline test devices are available',
      steps: [
        'Add then remove Online device → verify removed',
        'Add Online device, search by MAC → verify stays visible',
        'Open Import CSV modal → verify CSV Template and disabled Import',
        'Open Assign by tag modal → verify tag search and disabled Add',
        'Add Online device, re-open modal, search same device → Add stays disabled (duplicate blocked)',
        'Add both devices → verify Online/Offline status displayed correctly',
        'Open Add Device modal, enter invalid keyword → No devices found, Add disabled',
      ],
      expected: 'All device management operations work correctly',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-DEVICES-005: remove
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-remove'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
    await context.bulkDeploymentPage.removeDeviceByName(bulkDeploymentConfig.onlineDeviceName);

    // TC-BULK-DEVICES-006: search by MAC
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-search'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
    await context.bulkDeploymentPage.searchDeviceInDeployment(bulkDeploymentConfig.onlineDeviceMac);
    await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);

    // TC-BULK-DEVICES-007: Import CSV modal
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-import-csv'));
    const csvDialog = await context.bulkDeploymentPage.openImportCsvModal();
    await expect(csvDialog.getByRole('button', { name: 'CSV Template' })).toBeVisible();
    await expect(csvDialog.getByText('Upload File')).toBeVisible();
    await expect(csvDialog.getByRole('button', { name: 'Import' })).toBeDisabled();

    // TC-BULK-DEVICES-008: Assign by tag modal
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-tag'));
    const tagDialog = await context.bulkDeploymentPage.openAssignByTagModal();
    await expect(tagDialog.locator('input[placeholder="Search and select tag"]')).toBeVisible();
    await expect(tagDialog.getByRole('button', { name: 'Add' })).toBeDisabled();

    // TC-BULK-DEVICES-009: duplicate blocked
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-duplicate'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
    const dupDialog = await context.bulkDeploymentPage.openAddDeviceModal();
    await page.getByPlaceholder('Search and select device').fill(bulkDeploymentConfig.onlineDeviceName);
    await page.waitForTimeout(700);
    const dupOptions = page.locator('.device-selector-option').filter({ hasText: bulkDeploymentConfig.onlineDeviceName });
    if (await dupOptions.count()) {
      await expect(dupOptions.first()).toContainText(/Already assigned|Online|Offline/);
      await dupOptions.first().click();
    }
    await expect(dupDialog.getByRole('button', { name: /^Add$/ })).toBeDisabled();

    // TC-BULK-DEVICES-010: Online/Offline status
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-status'));
    await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName]);
    await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName, 'Online');
    await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName, 'Offline');

    // TC-BULK-DEVICES-011: no-result
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-no-result'));
    const noResDialog = await context.bulkDeploymentPage.openAddDeviceModal();
    const keyword = `zz_no_device_${Date.now()}`;
    await page.getByPlaceholder('Search and select device').fill(keyword);
    await page.waitForTimeout(700);
    await expect(page.getByText('No devices found')).toBeVisible();
    await expect(noResDialog.getByRole('button', { name: /^Add$/ })).toBeDisabled();

    setActualResult(testInfo, 'Remove, search, CSV, tag, duplicate, status, and no-result all verified');
  });
});
