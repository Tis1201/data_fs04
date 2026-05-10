const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp, normalizeText, extractMacAddress } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Devices tab: empty state, table rows, CSV/tag modals, add/remove device. */
const bulkDeploymentDevices = {
  async expectDevicesEmptyState() {
    await expect(this.page.getByText(T.NO_DEVICE_EMPTY)).toBeVisible({ timeout: this.timeout });
  },

  deviceRowByNameOrMac(deviceNameOrMac) {
    const macAddress = extractMacAddress(deviceNameOrMac);
    if (macAddress) {
      return this.page.locator('tbody tr').filter({ hasText: macAddress }).first();
    }
    return this.rowByText(deviceNameOrMac);
  },

  async expectDeviceRowVisible(deviceNameOrMac, expectedStatus = '') {
    const row = this.deviceRowByNameOrMac(deviceNameOrMac);
    await expect(row).toBeVisible({ timeout: this.timeout });
    if (expectedStatus) {
      const statusMatched = await expect(row).toContainText(expectedStatus, { timeout: this.timeout }).then(
        () => true,
        () => false
      );
      if (!statusMatched) {
        const rowText = normalizeText((await row.textContent().catch(() => '')) || '');
        throw new Error(
          `Expected device row "${deviceNameOrMac}" to contain status "${expectedStatus}", but actual row text was "${rowText}".`
        );
      }
    }
    return row;
  },

  async openDeviceDetailFromDevicesTab(deviceNameOrMac) {
    const row = await this.expectDeviceRowVisible(deviceNameOrMac);
    const detailLink = row.locator('a[href*="/devices/"]').first();
    await expect(detailLink).toBeVisible({ timeout: this.timeout });
    await detailLink.click();
    await this.page.waitForURL(/\/user\/iot\/devices\/[^/?#]+/, { timeout: this.timeout });
    const deploymentsTab = this.page
      .getByRole('button', { name: 'Deployments', exact: true })
      .or(this.page.getByRole('tab', { name: 'Deployments' }));
    await expect(deploymentsTab).toBeVisible({ timeout: this.timeout });
  },

  async getDeviceDeploymentStatusText(deviceNameOrMac) {
    await this.openDevicesTab();
    const row = await this.expectDeviceRowVisible(deviceNameOrMac);
    const statusCell = row.locator('td[data-ds-col-id="deploymentStatus"]').first();
    await expect(statusCell).toBeVisible({ timeout: this.timeout });
    return normalizeText((await statusCell.textContent()) || '');
  },

  async expectDeviceRowHidden(deviceNameOrMac) {
    await expect(this.deviceRowByNameOrMac(deviceNameOrMac)).toHaveCount(0, { timeout: this.timeout });
  },

  async openImportCsvModal() {
    await this.openDevicesTab();
    await this.importCsvButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_IMPORT_CSV);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  },

  async openAssignByTagModal() {
    await this.openDevicesTab();
    await this.assignByTagButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_ASSIGN_BY_TAG);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  },

  async openAddDeviceModal() {
    await this.openDevicesTab();
    await this.addDeviceButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_ADD_DEVICE);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await expect(this.getAddDeviceSearchInput()).toBeVisible({ timeout: this.timeout });
    return dialog;
  },

  async selectDeviceInModal(deviceName) {
    const searchInput = this.getAddDeviceSearchInput();
    const macAddress = extractMacAddress(deviceName);
    const searchTerms = [deviceName, macAddress].filter((term, index, values) => term && values.indexOf(term) === index);
    let option = null;
    let lastResultSummary = '';

    for (const searchTerm of searchTerms) {
      await searchInput.fill('');
      await searchInput.fill(searchTerm);

      const exactNameOption = this.page
        .locator('.device-selector-option')
        .filter({
          has: this.page.locator('.device-selector-option-name', {
            hasText: new RegExp(escapeRegExp(deviceName)),
          }),
        })
        .first();
      const macOption = macAddress
        ? this.page.locator('.device-selector-option').filter({ hasText: macAddress }).first()
        : exactNameOption;

      await expect
        .poll(
          async () => {
            const exactVisible = await exactNameOption.isVisible().catch(() => false);
            const macVisible = await macOption.isVisible().catch(() => false);
            const emptyVisible = await this.getNoDevicesFoundText().isVisible().catch(() => false);
            const loadingVisible = await this.page.getByText(/Loading/i).isVisible().catch(() => false);
            return exactVisible || macVisible || (emptyVisible && !loadingVisible);
          },
          {
            timeout: this.timeout,
            message: `Expected Add Device search to finish for "${searchTerm}"`,
          }
        )
        .toBe(true);

      if (await exactNameOption.isVisible().catch(() => false)) {
        option = exactNameOption;
        break;
      }
      if (await macOption.isVisible().catch(() => false)) {
        option = macOption;
        break;
      }

      const resultTexts = await this.page
        .locator('.device-selector-option, .device-selector-empty')
        .evaluateAll((items) => items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
        .catch(() => []);
      lastResultSummary = resultTexts.length ? resultTexts.join('; ') : T.NO_DEVICES_FOUND;
    }

    if (!option) {
      throw new Error(
        `Required Bulk Deployment device test data was not found in Add Device modal. Expected device="${deviceName}". ` +
          `Searched="${searchTerms.join(', ')}". Results="${lastResultSummary || T.NO_DEVICES_FOUND}". ` +
          'Check the DEV account/device assignment or the BULK_DEVICE_* environment variables.'
      );
    }

    await option.click();
    const selectedDevice = this.page
      .locator('.device-selector-selected-name')
      .filter({ hasText: macAddress ? new RegExp(`${escapeRegExp(deviceName)}|${escapeRegExp(macAddress)}`) : deviceName })
      .first();
    if (!(await selectedDevice.isVisible().catch(() => false))) {
      await option.dispatchEvent('click');
    }
    await expect(selectedDevice).toBeVisible({ timeout: this.timeout });
  },

  async addDevicesByNames(deviceNames) {
    await this.openAddDeviceModal();
    for (const deviceName of deviceNames) {
      await this.selectDeviceInModal(deviceName);
    }
    const dialog = this.dialogByTitle(T.DIALOG_ADD_DEVICE);
    const addButton = dialog.getByRole('button', { name: new RegExp(`^${escapeRegExp(T.ADD)}$`) });
    await expect(addButton).toBeEnabled({ timeout: this.timeout });
    await addButton.click();
    await this.waitForToastOrNetwork();
    for (const deviceName of deviceNames) {
      await this.expectDeviceRowVisible(deviceName);
    }
  },

  async removeDeviceByName(deviceName) {
    await this.openDevicesTab();
    await this.selectRowAction(deviceName, T.REMOVE);
    const dialog = this.dialogByTitle(T.DIALOG_REMOVE_DEVICE);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.REMOVE }).click();
    await this.waitForToastOrNetwork();
    await this.expectDeviceRowHidden(deviceName);
  },

  async searchDeviceInDeployment(keyword) {
    await this.openDevicesTab();
    const searchInput = this.getDeviceTableSearchInput();
    await searchInput.fill('');
    await searchInput.fill(keyword);
    await this.waitForUiSettled();
  },

  async addFirstAvailableDevice(searchKeyword = '') {
    await this.openDevicesTab();
    await this.addDeviceButton.click();
    await expect(this.page.getByText(T.ADD_DEVICE, { exact: true }).last()).toBeVisible({ timeout: this.timeout });

    const searchInput = this.getAddDeviceSearchInput();
    await expect(searchInput).toBeVisible({ timeout: this.timeout });
    if (searchKeyword) {
      await searchInput.fill(searchKeyword);
      await this.waitForUiSettled();
    } else {
      await searchInput.click();
    }

    const option = this.page.locator('.device-selector-option').filter({ hasNotText: 'Select All' }).first();
    await expect(option).toBeVisible({ timeout: this.timeout });
    const selectedName = normalizeText((await option.locator('.device-selector-option-name').first().textContent()) || '');
    await option.click();
    await expect(this.page.getByText(T.SELECTED_ONE_ITEMS)).toBeVisible({ timeout: this.timeout });

    const addButton = this.page.getByRole('button', { name: new RegExp(`^${escapeRegExp(T.ADD)}$`) }).last();
    await expect(addButton).toBeEnabled({ timeout: this.timeout });
    await addButton.dispatchEvent('click');
    await expect(this.page.getByText(selectedName, { exact: true }).first()).toBeVisible({ timeout: this.timeout });
    return selectedName;
  },

  async searchDeviceInAddModal(keyword) {
    const searchInput = this.getAddDeviceSearchInput();
    const results = this.getDeviceSelectorOptions();
    const empty = this.getNoDevicesFoundText();
    await this.searchAndWait(searchInput, keyword, results, empty);
  },

  async expectDeviceSearchResultVisible(deviceNameOrMac) {
    await expect(this.getDeviceSelectorOptionByText(deviceNameOrMac)).toBeVisible({ timeout: this.timeout });
  },
};

module.exports = bulkDeploymentDevices;
