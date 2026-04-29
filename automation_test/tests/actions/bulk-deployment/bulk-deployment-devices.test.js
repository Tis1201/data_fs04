const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  setActualResult,
} = require('./bulk-deployment-test-helpers');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

test.describe('Bulk Deployment - Devices', () => {
  test('TC-BULK-DEVICES-001: Add Device modal shows search input, Selected section, Cancel, and disabled Add', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-modal'));
        const dialog = await context.bulkDeploymentPage.openAddDeviceModal();
        await expect(context.bulkDeploymentPage.getAddDeviceSearchInput()).toBeVisible();
        await expect(context.bulkDeploymentPage.getAddDeviceSelectedCount()).toBeVisible();
        await expect(dialog.getByRole('button', { name: T.CANCEL })).toBeVisible();
        await expect(dialog.getByRole('button', { name: new RegExp(`^${T.ADD}$`) })).toBeDisabled();

        setActualResult(testInfo, 'Add Device modal structure verified: search, selected count, Cancel visible, Add disabled');
    });
});

  test('TC-BULK-DEVICES-002: Online device can be added to a deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-online'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);

        setActualResult(testInfo, `Online device assigned and visible`);
    });
});

  test('TC-BULK-DEVICES-003: Offline device can be added to a deployment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-offline'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.offlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName);

        setActualResult(testInfo, `Offline device assigned and visible`);
    });
});

  test('TC-BULK-DEVICES-004: Online and Offline devices can be added together in one assignment', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-two'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName);

        setActualResult(testInfo, 'Online and Offline devices both assigned and visible');
    });
});

  test('TC-BULK-DEVICES-005: Removing a device removes it from the Devices table', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-remove'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
        await context.bulkDeploymentPage.removeDeviceByName(bulkDeploymentConfig.onlineDeviceName);
        await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.onlineDeviceName)).toBeHidden();

        setActualResult(testInfo, 'Online device removed and row is no longer visible');
    });
});

  test('TC-BULK-DEVICES-006: Searching by MAC address keeps the device row visible', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-search'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
        await context.bulkDeploymentPage.searchDeviceInDeployment(bulkDeploymentConfig.onlineDeviceMac);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName);

        setActualResult(testInfo, `Device visible after MAC search "${bulkDeploymentConfig.onlineDeviceMac}"`);
    });
});

  test('TC-BULK-DEVICES-007: Import CSV modal shows CSV Template button and disabled Import button', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-import-csv'));
        const csvDialog = await context.bulkDeploymentPage.openImportCsvModal();
        await expect(csvDialog.getByRole('button', { name: T.CSV_TEMPLATE })).toBeVisible();
        await expect(csvDialog.getByText(T.UPLOAD_FILE)).toBeVisible();
        await expect(csvDialog.getByRole('button', { name: T.IMPORT_CSV })).toBeDisabled();

        setActualResult(testInfo, 'Import CSV modal: CSV Template visible, Upload File text visible, Import CSV disabled');
    });
});

  test('TC-BULK-DEVICES-008: Assign by tag modal shows tag search input and disabled Add button', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-tag'));
        const tagDialog = await context.bulkDeploymentPage.openAssignByTagModal();
        await expect(context.bulkDeploymentPage.getTagSearchInput()).toBeVisible();
        await expect(tagDialog.getByRole('button', { name: new RegExp(`^${T.ADD}$`) })).toBeDisabled();

        setActualResult(testInfo, 'Assign by tag modal: tag search visible, Add disabled');
    });
});

  test('TC-BULK-DEVICES-009: Already-assigned device cannot be added again — Add button stays disabled', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-duplicate'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName]);
        const dupDialog = await context.bulkDeploymentPage.openAddDeviceModal();
        await context.bulkDeploymentPage.searchDeviceInAddModal(bulkDeploymentConfig.onlineDeviceName);
        const dupOptions = context.bulkDeploymentPage.getDeviceSelectorOptionByText(bulkDeploymentConfig.onlineDeviceName);
        if (await dupOptions.count()) {
          await expect(dupOptions.first()).toContainText(/Already assigned|Online|Offline/);
          await dupOptions.first().click();
        }
        await expect(dupDialog.getByRole('button', { name: new RegExp(`^${T.ADD}$`) })).toBeDisabled();

        setActualResult(testInfo, 'Add button disabled when already-assigned device selected');
    });
});

  test('TC-BULK-DEVICES-010: Online and Offline device status is shown correctly in Devices table', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-status'));
        await context.bulkDeploymentPage.addDevicesByNames([bulkDeploymentConfig.onlineDeviceName, bulkDeploymentConfig.offlineDeviceName]);
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.onlineDeviceName, 'Online');
        await context.bulkDeploymentPage.expectDeviceRowVisible(bulkDeploymentConfig.offlineDeviceName, 'Offline');

        setActualResult(testInfo, 'Online/Offline status displayed correctly for both devices');
    });
});

  test('TC-BULK-DEVICES-011: Invalid device keyword in Add Device modal shows no-result state and disables Add', async ({ page }, testInfo) => {await test.step('Run main flow', async () => {
        const context = createBulkDeploymentContext(page);
        await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('devices-no-result'));
        const noResDialog = await context.bulkDeploymentPage.openAddDeviceModal();
        const keyword = `zz_no_device_${Date.now()}`;
        await context.bulkDeploymentPage.searchDeviceInAddModal(keyword);
        await expect(context.bulkDeploymentPage.getNoDevicesFoundText()).toBeVisible();
        await expect(noResDialog.getByRole('button', { name: new RegExp(`^${T.ADD}$`) })).toBeDisabled();

        setActualResult(testInfo, `Invalid keyword "${keyword}" showed no-result state; Add disabled`);
    });
});
});
