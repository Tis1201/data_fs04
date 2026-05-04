const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

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
    this.listPath = options.listPath || BULK_DEPLOYMENT.URLS.LIST_PATH;
    this.detailPath = options.detailPath || BULK_DEPLOYMENT.URLS.DETAIL_PATH;
    this.deploymentId = options.deploymentId;
    this.timeout = options.timeout || 30000;
    this.registerDeployment = typeof options.registerDeployment === 'function' ? options.registerDeployment : () => {};

    this.listTitle = this.page.getByRole('heading', { name: T.PAGE_TITLE }).or(this.page.getByText(T.PAGE_TITLE, { exact: true }));
    this.searchInput = this.page.getByPlaceholder(T.SEARCH_LIST_PLACEHOLDER);
    this.addDeploymentButton = this.page.getByRole('button', { name: T.ADD_DEPLOYMENT });
    this.deploymentRows = this.page.locator('tbody tr');
    this.deploymentNameLinks = this.page.locator('a.ds-deployment-name-link');

    this.addDeploymentDialog = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: T.DIALOG_ADD_DEPLOYMENT }) });
    this.addDeploymentModalTitle = this.addDeploymentDialog.getByRole('heading', { name: T.ADD_DEPLOYMENT });
    this.cancelButton = this.addDeploymentDialog.getByRole('button', { name: T.CANCEL });
    this.saveAsDraftButton = this.addDeploymentDialog.getByRole('button', { name: T.SAVE_AS_DRAFT });

    this.pageTitle = this.page.getByRole('heading', { name: T.DETAIL_TITLE }).or(this.page.getByText(T.DETAIL_TITLE, { exact: true }));
    this.overviewTitle = this.page.getByText(T.OVERVIEW_TITLE, { exact: true });

    this.tabList = this.page.getByRole('tablist');
    this.devicesTab = this.tabList.getByRole('button', { name: T.DEVICES_TAB });
    this.appsTab = this.tabList.getByRole('button', { name: T.APPS_TAB });
    this.batchesTab = this.tabList.getByRole('button', { name: T.BATCHES_TAB });

    this.editButton = this.page.getByRole('button', { name: T.EDIT });
    this.publishButton = this.page.getByRole('button', { name: T.PUBLISH });
    this.duplicateButton = this.page.getByRole('button', { name: T.DUPLICATE });
    this.deleteButton = this.page.getByRole('button', { name: T.DELETE });

    this.deploymentDeviceTitle = this.page.getByText(T.DEPLOYMENT_DEVICE_TITLE, { exact: true });
    this.deploymentAppsTitle = this.page.getByText(T.DEPLOYMENT_APPS_TITLE, { exact: true });
    this.deploymentBatchesTitle = this.page.getByText(T.DEPLOYMENT_BATCHES_TITLE, { exact: true });

    this.importCsvButton = this.page.getByRole('button', { name: T.IMPORT_CSV });
    this.assignByTagButton = this.page.getByRole('button', { name: T.ASSIGN_BY_TAG });
    this.addDeviceButton = this.page.getByRole('button', { name: T.ADD_DEVICE });
    this.addAppButton = this.page.getByRole('button', { name: T.ADD_APP });
  }

  async dismissBlockingDialogs(maxAttempts = 3) {
    const dialogLocator = this.page.locator('[role="dialog"][aria-modal="true"]');
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const hasDialog = (await dialogLocator.count().catch(() => 0)) > 0;
      if (!hasDialog) return;

      const dialog = dialogLocator.last();
      const closeBtn = dialog.getByRole('button', { name: /close|cancel|×/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(async () => closeBtn.click({ force: true }));
      } else {
        await this.page.keyboard.press('Escape').catch(() => {});
      }

      await dialog.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      await this.waitForUiSettled();
    }
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
  }

  async gotoDetail(deploymentId) {
    if (!this.appUrl || !deploymentId) {
      throw new Error('BulkDeploymentPage requires appUrl and deploymentId.');
    }

    await this.page.goto(`${this.appUrl}${this.detailPath}/${deploymentId}`, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });
  }

  async waitForListReady() {
    await expect(this.listTitle.first()).toBeVisible({ timeout: this.timeout });
    await expect(this.searchInput).toBeVisible({ timeout: this.timeout });
    await expect(this.addDeploymentButton).toBeVisible({ timeout: this.timeout });

    for (const column of [
      T.LIST_COL_DEPLOYMENT_NAME,
      T.LIST_COL_VERSION,
      T.LIST_COL_START_ON,
      T.LIST_COL_END_ON,
      T.LIST_COL_STATUS,
      T.LIST_COL_ACTIONS,
    ]) {
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
    const alreadyOnApps = await this.deploymentAppsTitle.isVisible().catch(() => false);
    if (alreadyOnApps) return;

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

  getAddDeviceSearchInput() {
    return this.page.getByPlaceholder(T.SEARCH_DEVICE_PLACEHOLDER);
  }

  getAddAppSearchInput() {
    return this.page.getByPlaceholder(T.SEARCH_APP_PLACEHOLDER);
  }

  getDeviceTableSearchInput() {
    return this.page.getByPlaceholder(T.SEARCH_DEVICE_IN_TABLE_PLACEHOLDER);
  }

  getTagSearchInput() {
    return this.page.locator(`input[placeholder="${T.SEARCH_TAG_PLACEHOLDER}"]`);
  }

  getAddDeviceSelectedCount() {
    return this.page.getByText(T.SELECTED_ZERO_ITEMS);
  }

  getAddAppSelectedCount() {
    return this.page.getByText(T.SELECTED_ZERO_ITEMS);
  }

  getNoDeploymentsFoundText() {
    return this.page.getByText(T.NO_DEPLOYMENTS_FOUND);
  }

  getNoAppsMatchText() {
    return this.page.getByText(T.NO_APPS_MATCH);
  }

  getNoDevicesFoundText() {
    return this.page.getByText(T.NO_DEVICES_FOUND);
  }

  getCharCounterNameMax() {
    return this.page.getByText(T.CHAR_COUNTER_NAME_MAX);
  }

  getCharCounterDescMax() {
    return this.page.getByText(T.CHAR_COUNTER_DESC_MAX);
  }

  getListColumnHeaderText(columnName) {
    return this.page.getByText(columnName, { exact: true }).first();
  }

  getBatchMetricLabel(label) {
    return this.page.getByText(label, { exact: true });
  }

  getBatchTableColumnHeader(columnName) {
    return this.page.getByText(columnName, { exact: true }).first();
  }

  getAppsTableColumnHeader(columnName) {
    return this.page.getByText(columnName, { exact: true }).first();
  }

  getAppResultOptions() {
    return this.page.locator('.add-app-result-option');
  }

  getAppResultOptionByName(appName) {
    return this.page
      .locator('.add-app-result-option')
      .filter({ hasText: appName })
      .first();
  }

  getDeviceSelectorOptions() {
    return this.page.locator('.device-selector-option');
  }

  getDeviceSelectorOptionByText(text) {
    return this.page.locator('.device-selector-option').filter({ hasText: text }).first();
  }

  async waitForUiSettled() {
    await expect.poll(
      async () => this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count(),
      {
        timeout: Math.min(this.timeout, 10000),
        message: 'Expected Bulk Deployment UI to finish loading',
      }
    ).toBe(0).catch(() => {});
  }

  async searchAndWait(searchInput, keyword, resultLocator, emptyLocator) {
    await searchInput.fill('');
    await searchInput.fill(keyword);
    await expect.poll(async () => {
      const resultCount = await resultLocator.count().catch(() => 0);
      const emptyVisible = emptyLocator ? await emptyLocator.isVisible().catch(() => false) : false;
      return resultCount > 0 || emptyVisible;
    }, {
      timeout: this.timeout,
      message: `Expected search results or empty state for keyword "${keyword}"`,
    }).toBe(true);
  }

  async visibleTexts(locator) {
    return locator.evaluateAll((items) =>
      items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    ).catch(() => []);
  }

  async waitForToastOrNetwork() {
    await this.waitForUiSettled();
  }

  async setBatchSize(batchSize) {
    const value = String(batchSize);
    if (['100', '200', '300', '400', '500'].includes(value)) {
      await this.selectDropdown(T.FORM.BATCH_SIZE_LABEL, value);
      return;
    }

    await this.selectDropdown(T.FORM.BATCH_SIZE_LABEL, 'Custom');
    await this.inputByLabel(T.FORM.BATCH_SIZE_LABEL).fill(value);
  }

  async setFutureSchedule(date, time = '09:00') {
    await this.selectDropdown(T.FORM.SCHEDULE_LABEL, T.FORM.FUTURE);
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

    // Dismiss any stale dialogs/overlays that might block the button
    const staleDialogs = this.page.getByRole('dialog');
    if (await staleDialogs.count() > 0) {
      for (const dialog of await staleDialogs.all()) {
        const closeBtn = dialog.getByRole('button', { name: /close|cancel|×/i }).first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
          await expect(dialog).toBeHidden({ timeout: 5000 }).catch(() => {});
        }
      }
    }

    await this.addDeploymentButton.click();

    // Retry if modal doesn't appear within timeout
    try {
      await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
      await expect(this.saveAsDraftButton).toBeVisible({ timeout: this.timeout });
    } catch (e) {
      // Retry once: re-navigate and try again
      await this.gotoList();
      await this.waitForListReady();
      await this.addDeploymentButton.click();
      await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
      await expect(this.saveAsDraftButton).toBeVisible({ timeout: this.timeout });
    }
  }

  async fillDeploymentForm(data) {
    if (data.name !== undefined) {
      await this.fillInput(T.FORM.NAME_LABEL, data.name);
    }
    if (data.targetOS !== undefined) {
      await this.selectDropdown(T.FORM.TARGET_OS_LABEL, data.targetOS);
    }
    if (data.version !== undefined) {
      await this.fillInput(T.FORM.VERSION_LABEL, data.version);
    }
    if (data.batchSize !== undefined) {
      await this.setBatchSize(data.batchSize);
    }
    if (data.schedule === T.FORM.FUTURE && data.scheduleDate) {
      await this.setFutureSchedule(data.scheduleDate, data.scheduleTime);
    } else if (data.schedule !== undefined) {
      await this.selectDropdown(T.FORM.SCHEDULE_LABEL, data.schedule);
    }
    if (data.description !== undefined) {
      await this.fillTextarea(T.FORM.DESCRIPTION_LABEL, data.description);
    }
    if (data.rebootDevice !== undefined) {
      await this.setSwitch(T.FORM.REBOOT_DEVICE, Boolean(data.rebootDevice));
    }
    if (data.forceUpdate !== undefined) {
      await this.setSwitch(T.FORM.FORCE_UPDATE, Boolean(data.forceUpdate));
    }
  }

  async saveAsDraftExpectDetail() {
    await expect(this.saveAsDraftButton).toBeEnabled({ timeout: this.timeout });
    await this.saveAsDraftButton.click();
    await expect(this.pageTitle).toBeVisible({ timeout: this.timeout });
    await expect(this.addDeploymentDialog).toBeHidden({ timeout: this.timeout }).catch(() => {});
    await this.waitForUiSettled();
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
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async fillEditDeploymentForm(data) {
    return this.fillDeploymentForm(data);
  }

  async saveEditExpectDetail() {
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    const saveButton = dialog.getByRole('button', { name: T.SAVE_CHANGES });
    await expect(saveButton).toBeEnabled({ timeout: this.timeout });
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    await this.waitForToastOrNetwork();
    return this.getDeploymentIdFromUrl();
  }

  async saveEditExpectBlocked() {
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    await expect(dialog.getByRole('button', { name: T.SAVE_CHANGES })).toBeDisabled({ timeout: this.timeout });
    await expect(dialog).toBeVisible({ timeout: this.timeout });
  }

  async cancelEdit() {
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    await dialog.getByRole('button', { name: T.CANCEL }).click();
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
    const badges = [
      T.STATUS_DRAFT,
      T.STATUS_PUBLISHED,
      T.STATUS_FAILED,
      T.STATUS_IN_PROGRESS,
      T.STATUS_COMPLETED,
      T.STATUS_SCHEDULED,
      T.STATUS_STOPPED,
      T.STATUS_CANCELLED,
      T.STATUS_CANCELED,
    ];

    for (const badge of badges) {
      const locator = this.page.getByText(badge, { exact: true }).first();
      if (await locator.isVisible().catch(() => false)) {
        return badge;
      }
    }

    throw new Error('No deployment status badge was visible.');
  }

  async expectAuditInfoVisible() {
    await expect(this.page.getByText(new RegExp(T.CREATED_BY, 'i'))).toBeVisible({ timeout: this.timeout });
    await expect(this.page.getByText(new RegExp(T.LAST_UPDATED_BY, 'i'))).toBeVisible({ timeout: this.timeout });
  }

  async searchDeployment(keyword) {
    await this.searchInput.fill('');
    await this.searchInput.fill(keyword);
    await this.waitForUiSettled();
  }

  async getVisibleDeploymentRowCount() {
    return await this.deploymentRows.count();
  }

  async expectNoDeploymentResults() {
    const noResults = this.getNoDeploymentsFoundText();
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
    await expect(this.page.getByText(T.NO_DEVICE_EMPTY)).toBeVisible({ timeout: this.timeout });
  }

  async expectAppsEmptyState() {
    await expect(this.page.getByText(T.NO_APP_EMPTY)).toBeVisible({ timeout: this.timeout });
  }

  async expectBatchesEmptyState() {
    await expect(this.page.getByText(T.NO_BATCH_EMPTY)).toBeVisible({ timeout: this.timeout });
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
    await responsePromise;
    await this.waitForToastOrNetwork();
  }

  /**
   * List page: row Actions → Publish → Deployment Confirm modal.
   * @param {string} rowSearchText deployment name (or unique row match text)
   * @param {{ confirm?: boolean }} options confirm false clicks Cancel
   */
  async publishFromListByName(rowSearchText, options = {}) {
    const { confirm = true } = options;
    await this.gotoList();
    await this.waitForListReady();
    await this.searchDeployment(rowSearchText);
    await this.selectRowAction(rowSearchText, T.ROW_ACTION_PUBLISH);
    const dialog = this.dialogByTitle(T.DIALOG_DEPLOYMENT_CONFIRM);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    if (!confirm) {
      await dialog.getByRole('button', { name: T.CANCEL }).click();
      await expect(dialog).toBeHidden({ timeout: this.timeout });
      return;
    }
    const responsePromise = this.page
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/v2/bundles/') &&
          response.url().includes('/publish'),
        { timeout: this.timeout }
      )
      .catch(() => null);
    await dialog.getByRole('button', { name: T.CONFIRM }).click();
    await responsePromise;
    await this.waitForToastOrNetwork();
  }

  async runDeploymentFromDetail() {
    const runButton = this.page.getByRole('button', { name: T.RUN_DEPLOYMENT }).first();
    await expect(runButton).toBeVisible({ timeout: this.timeout });
    await runButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_RUN_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.RUN }).click();
    await this.waitForToastOrNetwork();
  }

  async duplicateFromDetail() {
    const currentUrl = this.page.url();
    await expect(this.duplicateButton.first()).toBeVisible({ timeout: this.timeout });
    await this.duplicateButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_DUPLICATE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.DUPLICATE }).click();
    await this.page.waitForFunction((url) => window.location.href !== url, currentUrl, { timeout: this.timeout });
    await this.waitForPageReady();
    const duplicatedId = this.getDeploymentIdFromUrl();
    const duplicatedName = await this.getOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME).catch(() => '');
    this.registerDeployment({ id: duplicatedId, name: duplicatedName });
    return duplicatedId;
  }

  async cancelDuplicateFromDetail() {
    const currentUrl = this.page.url();
    await this.duplicateButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_DUPLICATE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.CANCEL }).click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    expect(this.page.url()).toBe(currentUrl);
  }

  async deleteFromDetail(confirm = true) {
    await expect(this.deleteButton.first()).toBeVisible({ timeout: this.timeout });
    await this.deleteButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_DELETE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    if (!confirm) {
      await dialog.getByRole('button', { name: T.CANCEL }).click();
      await expect(dialog).toBeHidden({ timeout: this.timeout });
      return;
    }
    const navigationPromise = this.page
      .waitForURL((url) => url.pathname === this.listPath, { timeout: this.timeout })
      .catch(() => null);
    await dialog.getByRole('button', { name: T.DELETE }).click();
    await navigationPromise;
    await this.waitForListReady();
  }

  async deleteFromListByName(name, confirm = true) {
    await this.gotoList();
    await this.waitForListReady();
    await this.searchDeployment(name);
    await this.selectRowAction(name, T.ROW_ACTION_DELETE);
    const dialog = this.dialogByTitle(T.DIALOG_DELETE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    if (!confirm) {
      await dialog.getByRole('button', { name: T.CANCEL }).click();
      await expect(dialog).toBeHidden({ timeout: this.timeout });
      return;
    }
    await dialog.getByRole('button', { name: T.DELETE }).click();
    await this.waitForToastOrNetwork();
  }

  async openImportCsvModal() {
    await this.openDevicesTab();
    await this.importCsvButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_IMPORT_CSV);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async openAssignByTagModal() {
    await this.openDevicesTab();
    await this.assignByTagButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_ASSIGN_BY_TAG);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async openAddDeviceModal() {
    await this.openDevicesTab();
    await this.addDeviceButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_ADD_DEVICE);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await expect(this.getAddDeviceSearchInput()).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async selectDeviceInModal(deviceName) {
    const searchInput = this.getAddDeviceSearchInput();
    const macAddress = extractMacAddress(deviceName);
    const searchTerms = [deviceName, macAddress].filter((term, index, values) => term && values.indexOf(term) === index);
    let option = null;
    let lastResultSummary = '';

    for (const searchTerm of searchTerms) {
      await searchInput.fill('');
      await searchInput.fill(searchTerm);
      await this.waitForUiSettled();

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
  }

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
  }

  async removeDeviceByName(deviceName) {
    await this.openDevicesTab();
    await this.selectRowAction(deviceName, T.REMOVE);
    const dialog = this.dialogByTitle(T.DIALOG_REMOVE_DEVICE);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.REMOVE }).click();
    await this.waitForToastOrNetwork();
    await this.expectDeviceRowHidden(deviceName);
  }

  async searchDeviceInDeployment(keyword) {
    await this.openDevicesTab();
    const searchInput = this.getDeviceTableSearchInput();
    await searchInput.fill('');
    await searchInput.fill(keyword);
    await this.waitForUiSettled();
  }

  async openAddAppModal() {
    await this.openAppsTab();
    await this.addAppButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_ADD_APP);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await expect(this.getAddAppSearchInput()).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async selectAppInModal(appName) {
    const searchInput = this.getAddAppSearchInput();
    await searchInput.fill('');
    await searchInput.fill(appName);

    // Wait for search results to finish loading (not just UI spinners)
    await expect.poll(async () => {
      const loadingCount = await this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count();
      const loadingText = await this.page.locator('.add-app-result-option, .empty-state, [class*="empty"]').filter({ hasText: /loading/i }).count();
      return loadingCount + loadingText;
    }, {
      timeout: this.timeout,
      message: `Waiting for app search results to finish loading for "${appName}"`,
    }).toBe(0).catch(() => {});

    const option = this.page
      .locator('.add-app-result-option')
      .filter({
        has: this.page.locator('.add-app-result-option-text', {
          hasText: new RegExp(`^${escapeRegExp(appName)}$`),
        }),
      })
      .first();

    // Retry: if option not visible, wait and try again
    if (!(await option.isVisible().catch(() => false))) {
      // Wait for UI to settle before retry
      await expect.poll(async () => this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count(), {
        timeout: 3000,
        message: `Waiting before retry for app "${appName}"`,
      }).toBe(0).catch(() => {});
      await searchInput.fill('');
      await searchInput.fill(appName);
      await expect.poll(async () => {
        const loadingCount = await this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count();
        return loadingCount;
      }, {
        timeout: this.timeout,
        message: `Retry: waiting for app search results for "${appName}"`,
      }).toBe(0).catch(() => {});
    }

    if (!(await option.isVisible().catch(() => false))) {
      const resultTexts = await this.page
        .locator('.add-app-result-option, .empty-state, [class*="empty"]')
        .evaluateAll((items) => items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
        .catch(() => []);
      throw new Error(
        `Required Bulk Deployment app test data was not found or selectable in Add App modal. Expected app="${appName}". ` +
          `Results="${resultTexts.join('; ') || T.NO_APPS_MATCH}".`
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
    const dialog = this.dialogByTitle(T.DIALOG_ADD_APP);
    const assignButton = dialog.getByRole('button', { name: T.ASSIGN });
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await this.waitForToastOrNetwork();
    for (const appName of appNames) {
      await expect(this.rowByText(appName)).toBeVisible({ timeout: this.timeout });
    }
  }

  async removeAppByName(appName) {
    await this.openAppsTab();
    await this.selectRowAction(appName, T.REMOVE);
    const dialog = this.dialogByTitle(T.DIALOG_REMOVE_APP);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.REMOVE }).click();
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
      total: await this.getBatchMetricValue(T.BATCH_METRIC_TOTAL),
      completed: await this.getBatchMetricValue(T.BATCH_METRIC_COMPLETED),
      inProgress: await this.getBatchMetricValue(T.BATCH_METRIC_IN_PROGRESS),
      failed: await this.getBatchMetricValue(T.BATCH_METRIC_FAILED),
      canceled: await this.getBatchMetricValue(T.BATCH_METRIC_CANCELED),
    };
  }

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
  }

  async searchAppInAddModal(keyword) {
    const searchInput = this.getAddAppSearchInput();
    const results = this.getAppResultOptions();
    const empty = this.getNoAppsMatchText();
    await this.searchAndWait(searchInput, keyword, results, empty);
  }

  async expectAppSearchResultVisible(appName) {
    await expect(this.getAppResultOptionByName(appName)).toBeVisible({ timeout: this.timeout });
  }

  async searchDeviceInAddModal(keyword) {
    const searchInput = this.getAddDeviceSearchInput();
    const results = this.getDeviceSelectorOptions();
    const empty = this.getNoDevicesFoundText();
    await this.searchAndWait(searchInput, keyword, results, empty);
  }

  async expectDeviceSearchResultVisible(deviceNameOrMac) {
    await expect(this.getDeviceSelectorOptionByText(deviceNameOrMac)).toBeVisible({ timeout: this.timeout });
  }

  async addFirstAvailableApp(searchKeyword = '') {
    await this.openAppsTab();
    await this.dismissBlockingDialogs();
    await this.addAppButton.click();
    await expect(this.page.getByText(T.ADD_APP, { exact: true }).last()).toBeVisible({ timeout: this.timeout });

    const searchInput = this.getAddAppSearchInput();
    await expect(searchInput).toBeVisible({ timeout: this.timeout });
    if (searchKeyword) {
      await searchInput.fill(searchKeyword);
      await this.waitForUiSettled();
    } else {
      await searchInput.click();
    }

    const option = this.getAppResultOptions().first();
    await expect(option).toBeVisible({ timeout: this.timeout });
    const selectedName = normalizeText((await option.locator('.add-app-result-option-text').first().textContent()) || '');
    await option.click();

    const assignButton = this.page.getByRole('button', { name: new RegExp(`^${escapeRegExp(T.ASSIGN)}$`) }).last();
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await expect(this.page.getByText(selectedName, { exact: true }).first()).toBeVisible({ timeout: this.timeout });
    return selectedName;
  }
}

module.exports = BulkDeploymentPage;
