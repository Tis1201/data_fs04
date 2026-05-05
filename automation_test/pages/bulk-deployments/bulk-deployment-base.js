const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

class BulkDeploymentBase extends BasePage {
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
}

module.exports = BulkDeploymentBase;
