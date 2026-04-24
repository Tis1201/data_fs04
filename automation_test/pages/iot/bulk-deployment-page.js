const { expect } = require('@playwright/test');
const BasePage = require('../base-page');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[—–]/g, '-')
    .trim();
}

function extractMacAddress(value) {
  return String(value || '').match(/[0-9a-f]{2}(?::[0-9a-f]{2}){5}/i)?.[0] || '';
}

class BulkDeploymentPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.page = page;
    this.appUrl = options.appUrl;
    this.listPath = options.listPath || '/user/iot/bundles';
    this.detailPath = options.detailPath || '/user/iot/bundles';
    this.deploymentId = options.deploymentId;
    this.timeout = options.timeout || 30000;
    this.registerDeployment = typeof options.registerDeployment === 'function' ? options.registerDeployment : () => {};

    this.listTitle = this.page.getByText('Bulk Deployments', { exact: true });
    this.searchInput = this.page.getByPlaceholder('Search by Name or ID');
    this.addDeploymentButton = this.page.getByRole('button', { name: 'Add Deployment' });
    this.deploymentRows = this.page.locator('tbody tr');
    this.deploymentNameLinks = this.page.locator('a.ds-deployment-name-link');

    this.addDeploymentDialog = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Add Deployment' }) });
    this.addDeploymentModalTitle = this.addDeploymentDialog.getByRole('heading', { name: 'Add Deployment' });
    this.cancelButton = this.addDeploymentDialog.getByRole('button', { name: 'Cancel' });
    this.saveAsDraftButton = this.addDeploymentDialog.getByRole('button', { name: 'Save as Draft' });

    this.pageTitle = this.page.getByText('Deployment Details', { exact: true });
    this.overviewTitle = this.page.getByText('Deployment Overview', { exact: true });

    this.tabList = this.page.getByRole('tablist');
    this.devicesTab = this.tabList.getByRole('button', { name: 'Devices' });
    this.appsTab = this.tabList.getByRole('button', { name: 'Apps' });
    this.batchesTab = this.tabList.getByRole('button', { name: 'Batches' });

    this.editButton = this.page.getByRole('button', { name: 'Edit' });
    this.publishButton = this.page.getByRole('button', { name: 'Publish' });
    this.duplicateButton = this.page.getByRole('button', { name: 'Duplicate' });
    this.deleteButton = this.page.getByRole('button', { name: 'Delete' });

    this.deploymentDeviceTitle = this.page.getByText('Deployment Device', { exact: true });
    this.deploymentAppsTitle = this.page.getByText('Deployment Apps', { exact: true });
    this.deploymentBatchesTitle = this.page.getByText('Deployment Batches', { exact: true });

    this.importCsvButton = this.page.getByRole('button', { name: 'Import CSV' });
    this.assignByTagButton = this.page.getByRole('button', { name: 'Assign by tag' });
    this.addDeviceButton = this.page.getByRole('button', { name: 'Add Device' });
    this.addAppButton = this.page.getByRole('button', { name: 'Add App' });
  }

  async goto() {
    if (!this.deploymentId) {
      await this.gotoList();
      return;
    }

    await this.gotoDetail(this.deploymentId);
  }

  async gotoList() {
    if (!this.appUrl) {
      throw new Error('BulkDeploymentPage requires appUrl.');
    }

    await this.page.goto(`${this.appUrl}${this.listPath}`, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });

    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async gotoDetail(deploymentId) {
    if (!this.appUrl || !deploymentId) {
      throw new Error('BulkDeploymentPage requires appUrl and deploymentId.');
    }

    await this.page.goto(`${this.appUrl}${this.detailPath}/${deploymentId}`, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });

    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async waitForListReady() {
    await expect(this.listTitle.first()).toBeVisible({ timeout: this.timeout });
    await expect(this.searchInput).toBeVisible({ timeout: this.timeout });
    await expect(this.addDeploymentButton).toBeVisible({ timeout: this.timeout });

    for (const column of ['Deployment Name', 'Version', 'Start On', 'End On', 'Status', 'Actions']) {
      await expect(this.page.getByText(column, { exact: true }).first()).toBeVisible({ timeout: this.timeout });
    }
  }

  async waitForPageReady() {
    await expect(this.pageTitle).toBeVisible({ timeout: this.timeout });
    await expect(this.overviewTitle).toBeVisible({ timeout: this.timeout });
    await expect(this.devicesTab).toBeVisible({ timeout: this.timeout });
    await expect(this.appsTab).toBeVisible({ timeout: this.timeout });
    await expect(this.batchesTab).toBeVisible({ timeout: this.timeout });
  }

  async openExistingDeploymentOrCreateDraft(data) {
    if (this.deploymentId) {
      await this.gotoDetail(this.deploymentId);
      return this.deploymentId;
    }

    await this.gotoList();
    await this.waitForListReady();

    const firstLink = this.deploymentNameLinks.first();
    if (await firstLink.isVisible().catch(() => false)) {
      await firstLink.click();
      await this.waitForPageReady();
      return this.getDeploymentIdFromUrl();
    }

    const created = await this.createDraftDeployment(data);
    return created.id;
  }

  async openDevicesTab() {
    await this.devicesTab.click();
    await expect(this.deploymentDeviceTitle).toBeVisible({ timeout: this.timeout });
  }

  async openAppsTab() {
    await this.appsTab.click();
    await expect(this.deploymentAppsTitle).toBeVisible({ timeout: this.timeout });
  }

  async openBatchesTab() {
    await this.batchesTab.click();
    await expect(this.deploymentBatchesTitle).toBeVisible({ timeout: this.timeout });
  }

  inputByLabel(label) {
    return this.page
      .locator('.input-field-wrapper')
      .filter({ has: this.page.locator('.input-label-text', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
      .locator('input')
      .first();
  }

  textareaByLabel(label) {
    return this.page
      .locator('.textarea-field-wrapper')
      .filter({ has: this.page.locator('.textarea-label-text', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
      .locator('textarea')
      .first();
  }

  dropdownByLabel(label) {
    return this.page
      .locator('.dropdown-container')
      .filter({ has: this.page.locator('.label-text', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
      .first();
  }

  async fillInput(label, value) {
    await this.inputByLabel(label).fill(String(value));
  }

  async fillTextarea(label, value) {
    await this.textareaByLabel(label).fill(String(value));
  }

  async selectDropdown(label, optionLabel) {
    const dropdown = this.dropdownByLabel(label);
    await dropdown.locator('.dropdown-trigger').click();
    await this.page
      .locator('.dropdown-option')
      .filter({ has: this.page.locator('.dropdown-option-text', { hasText: new RegExp(`^${escapeRegExp(optionLabel)}$`) }) })
      .first()
      .click();
  }

  dialogByTitle(title) {
    return this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: title }) })
      .last();
  }

  rowByText(text) {
    return this.page.locator('tbody tr').filter({ hasText: text }).first();
  }

  async waitForToastOrNetwork() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async setBatchSize(batchSize) {
    const value = String(batchSize);
    if (['100', '200', '300', '400', '500'].includes(value)) {
      await this.selectDropdown('Batch Size', value);
      return;
    }

    await this.selectDropdown('Batch Size', 'Custom');
    await this.inputByLabel('Batch Size').fill(value);
  }

  async setFutureSchedule(date, time = '09:00') {
    await this.selectDropdown('Schedule', 'Future');
    await this.page.locator('input[type="date"]').last().fill(date);
    await this.page.locator('input[type="time"]').last().fill(time);
  }

  async setSwitch(label, enabled) {
    const switchButton = this.page
      .locator('.toggle-card')
      .filter({ hasText: label })
      .getByRole('switch')
      .first();
    const checked = await switchButton.getAttribute('aria-checked');
    if ((checked === 'true') !== enabled) {
      await switchButton.click();
    }
  }

  async openAddDeploymentModal() {
    await this.gotoList();
    await this.waitForListReady();
    await this.addDeploymentButton.click();
    await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
    await expect(this.saveAsDraftButton).toBeVisible({ timeout: this.timeout });
  }

  async fillDeploymentForm(data) {
    if (data.name !== undefined) {
      await this.fillInput('Deployment Name', data.name);
    }
    if (data.targetOS !== undefined) {
      await this.selectDropdown('Target to Operating System', data.targetOS);
    }
    if (data.version !== undefined) {
      await this.fillInput('Version', data.version);
    }
    if (data.batchSize !== undefined) {
      await this.setBatchSize(data.batchSize);
    }
    if (data.schedule === 'Future' && data.scheduleDate) {
      await this.setFutureSchedule(data.scheduleDate, data.scheduleTime);
    } else if (data.schedule !== undefined) {
      await this.selectDropdown('Schedule', data.schedule);
    }
    if (data.description !== undefined) {
      await this.fillTextarea('Description', data.description);
    }
    if (data.rebootDevice !== undefined) {
      await this.setSwitch('Reboot Device', Boolean(data.rebootDevice));
    }
    if (data.forceUpdate !== undefined) {
      await this.setSwitch('Force Update', Boolean(data.forceUpdate));
    }
  }

  async saveAsDraftExpectDetail() {
    await expect(this.saveAsDraftButton).toBeEnabled({ timeout: this.timeout });
    await this.saveAsDraftButton.click();
    await expect(this.pageTitle).toBeVisible({ timeout: this.timeout });
    return this.getDeploymentIdFromUrl();
  }

  async saveAsDraftExpectBlocked() {
    await expect(this.saveAsDraftButton).toBeDisabled({ timeout: this.timeout });
    await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
  }

  async createDraftDeployment(data) {
    await this.openAddDeploymentModal();
    await this.fillDeploymentForm(data);
    const id = await this.saveAsDraftExpectDetail();
    const created = { id, name: data.name };
    this.registerDeployment(created);
    return created;
  }

  async openEditDeploymentModal() {
    await expect(this.editButton.first()).toBeVisible({ timeout: this.timeout });
    await this.editButton.first().click();
    const dialog = this.dialogByTitle('Edit Deployment');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async fillEditDeploymentForm(data) {
    return this.fillDeploymentForm(data);
  }

  async saveEditExpectDetail() {
    const dialog = this.dialogByTitle('Edit Deployment');
    const saveButton = dialog.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: this.timeout });
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    await this.waitForToastOrNetwork();
    return this.getDeploymentIdFromUrl();
  }

  async saveEditExpectBlocked() {
    const dialog = this.dialogByTitle('Edit Deployment');
    await expect(dialog.getByRole('button', { name: 'Save Changes' })).toBeDisabled({ timeout: this.timeout });
    await expect(dialog).toBeVisible({ timeout: this.timeout });
  }

  async cancelEdit() {
    const dialog = this.dialogByTitle('Edit Deployment');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
  }

  getDeploymentIdFromUrl() {
    const match = this.page.url().match(/\/user\/iot\/bundles\/([^/?#]+)/);
    return match ? match[1] : '';
  }

  async getOverviewValue(label) {
    const field = this.page
      .locator('.overview-field')
      .filter({ has: this.page.locator('.overview-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i') }) })
      .first();

    const value = field.locator('.overview-value, .badge, [class*="badge"]').first();
    return normalizeText((await value.textContent().catch(() => '')) || '');
  }

  async expectOverviewFieldVisible(label) {
    await expect(
      this.page
        .locator('.overview-field')
        .filter({ has: this.page.locator('.overview-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i') }) })
        .first()
    ).toBeVisible({ timeout: this.timeout });
  }

  async expectOverviewValue(label, expectedValue) {
    await expect
      .poll(async () => this.getOverviewValue(label), {
        timeout: this.timeout,
        message: `Expected overview field "${label}" to contain "${expectedValue}"`,
      })
      .toContain(normalizeText(expectedValue));
  }

  async expectStatusBadgeVisible() {
    const badges = ['Draft', 'Failed', 'In Progress', 'Completed', 'Scheduled', 'Stopped', 'Cancelled', 'Canceled'];

    for (const badge of badges) {
      const locator = this.page.getByText(badge, { exact: true }).first();
      if (await locator.isVisible().catch(() => false)) {
        return badge;
      }
    }

    throw new Error('No deployment status badge was visible.');
  }

  async expectAuditInfoVisible() {
    await expect(this.page.getByText(/Created by/i)).toBeVisible({ timeout: this.timeout });
    await expect(this.page.getByText(/Last updated by/i)).toBeVisible({ timeout: this.timeout });
  }

  async searchDeployment(keyword) {
    await this.searchInput.fill('');
    await this.searchInput.fill(keyword);
    await this.page.waitForTimeout(700);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async getVisibleDeploymentRowCount() {
    return await this.deploymentRows.count();
  }

  async expectNoDeploymentResults() {
    const noResults = this.page.getByText('No deployments found');
    if (await noResults.isVisible().catch(() => false)) {
      return;
    }

    await noResults.waitFor({ state: 'visible', timeout: this.timeout }).catch(() => null);
    if (await noResults.isVisible().catch(() => false)) {
      return;
    }

    const rowTexts = await this.deploymentRows
      .evaluateAll((rows) => rows.map((row) => (row.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
      .catch(() => []);
    throw new Error(
      `Expected no deployment results, but ${rowTexts.length || 0} table row(s) remained visible: ${
        rowTexts.join(' || ') || 'no empty-state text was rendered'
      }`
    );
  }

  async expectDevicesEmptyState() {
    await expect(this.page.getByText('No devices added to this bundle yet')).toBeVisible({ timeout: this.timeout });
  }

  async expectAppsEmptyState() {
    await expect(this.page.getByText('No apps added to this bundle yet')).toBeVisible({ timeout: this.timeout });
  }

  async expectBatchesEmptyState() {
    await expect(this.page.getByText('No Data Available.')).toBeVisible({ timeout: this.timeout });
  }

  async openDeploymentFromListByName(name) {
    await this.gotoList();
    await this.waitForListReady();
    await this.searchDeployment(name);
    await this.page.getByRole('link', { name }).first().click();
    await this.waitForPageReady();
  }

  async clickListColumnHeader(columnName) {
    await this.page.locator('thead th').filter({ hasText: columnName }).first().click();
    await this.waitForToastOrNetwork();
  }

  async getListCellText(rowText, columnId) {
    const row = this.rowByText(rowText);
    await expect(row).toBeVisible({ timeout: this.timeout });
    return normalizeText((await row.locator(`td[data-ds-col-id="${columnId}"]`).first().textContent()) || '');
  }

  deviceRowByNameOrMac(deviceNameOrMac) {
    const macAddress = extractMacAddress(deviceNameOrMac);
    if (macAddress) {
      return this.page.locator('tbody tr').filter({ hasText: macAddress }).first();
    }
    return this.rowByText(deviceNameOrMac);
  }

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
  }

  async expectDeviceRowHidden(deviceNameOrMac) {
    await expect(this.deviceRowByNameOrMac(deviceNameOrMac)).toHaveCount(0, { timeout: this.timeout });
  }

  async openRowActionMenu(rowText) {
    await this.page.keyboard.press('Escape').catch(() => {});
    const macAddress = extractMacAddress(rowText);
    const row = macAddress
      ? this.page
          .locator('tbody tr')
          .filter({ hasText: new RegExp(`${escapeRegExp(rowText)}|${escapeRegExp(macAddress)}`) })
          .first()
      : this.rowByText(rowText);
    await expect(row).toBeVisible({ timeout: this.timeout });
    const trigger = row
      .locator('td[data-ds-col-id="actions"] button[aria-haspopup="menu"], td[data-ds-col-id="actions"] button')
      .last();
    await expect(trigger).toBeVisible({ timeout: this.timeout });
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    const menu = this.page.getByRole('menu').last();
    await trigger.click().catch(async () => {
      await trigger.click({ force: true });
    });
    if (!(await menu.isVisible().catch(() => false))) {
      await trigger.dispatchEvent('click');
    }
    await expect(menu).toBeVisible({ timeout: this.timeout });
  }

  async selectRowAction(rowText, actionName) {
    await this.openRowActionMenu(rowText);
    await this.page.getByRole('menuitem', { name: new RegExp(`^${escapeRegExp(actionName)}$`) }).click();
    await this.waitForToastOrNetwork();
  }

  async getRowActionLabels(rowText) {
    await this.openRowActionMenu(rowText);
    const labels = await this.page.getByRole('menuitem').evaluateAll((items) =>
      items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim())
    );
    await this.page.keyboard.press('Escape').catch(() => {});
    return labels;
  }

  async isDetailActionVisible(actionName) {
    return this.page.getByRole('button', { name: actionName }).first().isVisible().catch(() => false);
  }

  async publishFromDetail() {
    await expect(this.publishButton.first()).toBeVisible({ timeout: this.timeout });
    await expect(this.publishButton.first()).toBeEnabled({ timeout: this.timeout });
    const responsePromise = this.page
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/v2/bundles/') &&
          response.url().includes('/publish'),
        { timeout: this.timeout }
      )
      .catch(() => null);
    await this.publishButton.first().click();
    const response = await responsePromise;
    await this.waitForToastOrNetwork();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return response;
  }

  async runDeploymentFromDetail() {
    const runButton = this.page.getByRole('button', { name: 'Run Deployment' }).first();
    await expect(runButton).toBeVisible({ timeout: this.timeout });
    await runButton.click();
    const dialog = this.dialogByTitle('Run Deployment');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Run' }).click();
    await this.waitForToastOrNetwork();
  }

  async duplicateFromDetail() {
    const currentUrl = this.page.url();
    await expect(this.duplicateButton.first()).toBeVisible({ timeout: this.timeout });
    await this.duplicateButton.first().click();
    const dialog = this.dialogByTitle('Duplicate Deployment');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Duplicate' }).click();
    await this.page.waitForFunction((url) => window.location.href !== url, currentUrl, { timeout: this.timeout });
    await this.waitForPageReady();
    const duplicatedId = this.getDeploymentIdFromUrl();
    const duplicatedName = await this.getOverviewValue('Deployment Name').catch(() => '');
    this.registerDeployment({ id: duplicatedId, name: duplicatedName });
    return duplicatedId;
  }

  async cancelDuplicateFromDetail() {
    const currentUrl = this.page.url();
    await this.duplicateButton.first().click();
    const dialog = this.dialogByTitle('Duplicate Deployment');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    expect(this.page.url()).toBe(currentUrl);
  }

  async deleteFromDetail(confirm = true) {
    await expect(this.deleteButton.first()).toBeVisible({ timeout: this.timeout });
    await this.deleteButton.first().click();
    const dialog = this.dialogByTitle('Delete Deployment');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    if (!confirm) {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden({ timeout: this.timeout });
      return;
    }
    const navigationPromise = this.page
      .waitForURL((url) => url.pathname === this.listPath, { timeout: this.timeout })
      .catch(() => null);
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await navigationPromise;
    await this.waitForListReady();
  }

  async deleteFromListByName(name, confirm = true) {
    await this.gotoList();
    await this.waitForListReady();
    await this.searchDeployment(name);
    await this.selectRowAction(name, 'Delete');
    const dialog = this.dialogByTitle('Delete Deployment');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    if (!confirm) {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden({ timeout: this.timeout });
      return;
    }
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await this.waitForToastOrNetwork();
  }

  async openImportCsvModal() {
    await this.openDevicesTab();
    await this.importCsvButton.click();
    const dialog = this.dialogByTitle('Import CSV');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async openAssignByTagModal() {
    await this.openDevicesTab();
    await this.assignByTagButton.click();
    const dialog = this.dialogByTitle('Assign by tag');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async openAddDeviceModal() {
    await this.openDevicesTab();
    await this.addDeviceButton.click();
    const dialog = this.dialogByTitle('Add Device');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await expect(this.page.getByPlaceholder('Search and select device')).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async selectDeviceInModal(deviceName) {
    const searchInput = this.page.getByPlaceholder('Search and select device');
    const macAddress = extractMacAddress(deviceName);
    const searchTerms = [deviceName, macAddress].filter((term, index, values) => term && values.indexOf(term) === index);
    let option = null;
    let lastResultSummary = '';

    for (const searchTerm of searchTerms) {
      await searchInput.fill('');
      await searchInput.fill(searchTerm);
      await this.page.waitForTimeout(700);

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
      lastResultSummary = resultTexts.length ? resultTexts.join('; ') : 'No devices found';
    }

    if (!option) {
      throw new Error(
        `Required Bulk Deployment device test data was not found in Add Device modal. Expected device="${deviceName}". ` +
          `Searched="${searchTerms.join(', ')}". Results="${lastResultSummary || 'No devices found'}". ` +
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
  }

  async addDevicesByNames(deviceNames) {
    await this.openAddDeviceModal();
    for (const deviceName of deviceNames) {
      await this.selectDeviceInModal(deviceName);
    }
    const dialog = this.dialogByTitle('Add Device');
    const addButton = dialog.getByRole('button', { name: /^Add$/ });
    await expect(addButton).toBeEnabled({ timeout: this.timeout });
    await addButton.click();
    await this.waitForToastOrNetwork();
    for (const deviceName of deviceNames) {
      await this.expectDeviceRowVisible(deviceName);
    }
  }

  async removeDeviceByName(deviceName) {
    await this.openDevicesTab();
    await this.selectRowAction(deviceName, 'Remove');
    const dialog = this.dialogByTitle('Remove Device');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await this.waitForToastOrNetwork();
    await this.expectDeviceRowHidden(deviceName);
  }

  async searchDeviceInDeployment(keyword) {
    await this.openDevicesTab();
    const searchInput = this.page.getByPlaceholder('Search by device name or ID...');
    await searchInput.fill('');
    await searchInput.fill(keyword);
    await this.page.waitForTimeout(500);
  }

  async openAddAppModal() {
    await this.openAppsTab();
    await this.addAppButton.click();
    const dialog = this.dialogByTitle('Add App');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await expect(this.page.getByPlaceholder('Search and select app')).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async selectAppInModal(appName) {
    const searchInput = this.page.getByPlaceholder('Search and select app');
    await searchInput.fill('');
    await searchInput.fill(appName);
    await this.page.waitForTimeout(700);
    const option = this.page
      .locator('.add-app-result-option')
      .filter({
        has: this.page.locator('.add-app-result-option-text', {
          hasText: new RegExp(`^${escapeRegExp(appName)}$`),
        }),
      })
      .first();
    if (!(await option.isVisible().catch(() => false))) {
      const resultTexts = await this.page
        .locator('.add-app-result-option, .empty-state, [class*="empty"]')
        .evaluateAll((items) => items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
        .catch(() => []);
      throw new Error(
        `Required Bulk Deployment app test data was not found or selectable in Add App modal. Expected app="${appName}". ` +
          `Results="${resultTexts.join('; ') || 'No apps found'}".`
      );
    }
    await option.click();
    const selectedApp = this.page
      .locator('.add-app-selected-name', { hasText: new RegExp(`^${escapeRegExp(appName)}$`) })
      .first();
    if (!(await selectedApp.isVisible().catch(() => false))) {
      await option.dispatchEvent('click');
    }
    await expect(selectedApp).toBeVisible({ timeout: this.timeout });
  }

  async addAppsByNames(appNames) {
    await this.openAddAppModal();
    for (const appName of appNames) {
      await this.selectAppInModal(appName);
    }
    const dialog = this.dialogByTitle('Add App');
    const assignButton = dialog.getByRole('button', { name: 'Assign' });
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await this.waitForToastOrNetwork();
    for (const appName of appNames) {
      await expect(this.rowByText(appName)).toBeVisible({ timeout: this.timeout });
    }
  }

  async removeAppByName(appName) {
    await this.openAppsTab();
    await this.selectRowAction(appName, 'Remove');
    const dialog = this.dialogByTitle('Remove App');
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await this.waitForToastOrNetwork();
    await expect(this.rowByText(appName)).toHaveCount(0, { timeout: this.timeout });
  }

  async getBatchMetricValue(label) {
    const metric = this.page
      .locator('.batches-datas-wrap')
      .filter({ has: this.page.locator('.batches-datas-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
      .first();
    await expect(metric).toBeVisible({ timeout: this.timeout });
    const text = normalizeText((await metric.locator('.batches-datas-value').textContent()) || '0');
    return Number.parseInt(text, 10);
  }

  async getBatchMetrics() {
    return {
      total: await this.getBatchMetricValue('Total Batches'),
      completed: await this.getBatchMetricValue('Batches Completed'),
      inProgress: await this.getBatchMetricValue('Batches In-Progress'),
      failed: await this.getBatchMetricValue('Batches Failed'),
      canceled: await this.getBatchMetricValue('Batches Canceled'),
    };
  }

  async addFirstAvailableDevice(searchKeyword = '') {
    await this.openDevicesTab();
    await this.addDeviceButton.click();
    await expect(this.page.getByText('Add Device', { exact: true }).last()).toBeVisible({ timeout: this.timeout });

    const searchInput = this.page.getByPlaceholder('Search and select device');
    await expect(searchInput).toBeVisible({ timeout: this.timeout });
    if (searchKeyword) {
      await searchInput.fill(searchKeyword);
      await this.page.waitForTimeout(700);
    } else {
      await searchInput.click();
    }

    const option = this.page.locator('.device-selector-option').filter({ hasNotText: 'Select All' }).first();
    await expect(option).toBeVisible({ timeout: this.timeout });
    const selectedName = normalizeText((await option.locator('.device-selector-option-name').first().textContent()) || '');
    await option.click();
    await expect(this.page.getByText('Selected (1 items)')).toBeVisible({ timeout: this.timeout });

    const addButton = this.page.getByRole('button', { name: /^Add$/ }).last();
    await expect(addButton).toBeEnabled({ timeout: this.timeout });
    await addButton.dispatchEvent('click');
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.page.getByText(selectedName, { exact: true }).first()).toBeVisible({ timeout: this.timeout });
    return selectedName;
  }

  async addFirstAvailableApp(searchKeyword = '') {
    await this.openAppsTab();
    await this.addAppButton.click();
    await expect(this.page.getByText('Add App', { exact: true }).last()).toBeVisible({ timeout: this.timeout });

    const searchInput = this.page.getByPlaceholder('Search and select app');
    await expect(searchInput).toBeVisible({ timeout: this.timeout });
    if (searchKeyword) {
      await searchInput.fill(searchKeyword);
      await this.page.waitForTimeout(700);
    } else {
      await searchInput.click();
    }

    const option = this.page.locator('.add-app-result-option').first();
    await expect(option).toBeVisible({ timeout: this.timeout });
    const selectedName = normalizeText((await option.locator('.add-app-result-option-text').first().textContent()) || '');
    await option.click();
    await expect(this.page.getByText('Selected (1 item)')).toBeVisible({ timeout: this.timeout });

    const assignButton = this.page.getByRole('button', { name: /^Assign$/ }).last();
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await expect(this.page.getByText(selectedName, { exact: true }).first()).toBeVisible({ timeout: this.timeout });
    return selectedName;
  }
}

module.exports = BulkDeploymentPage;
