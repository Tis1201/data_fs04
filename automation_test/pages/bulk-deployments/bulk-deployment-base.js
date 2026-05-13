const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

const SELECTORS = {
  activeModalDialog: '[role="dialog"][aria-modal="true"]',
  addAppResultOption: '.add-app-result-option',
  addAppResultOptionText: '.add-app-result-option-text',
  addAppResultsOrEmpty: '.add-app-result-option, .empty-state, [class*="empty"]',
  addAppSelectedName: '.add-app-selected-name',
  batchMetricLabel: '.batches-datas-label',
  batchMetricValue: '.batches-datas-value',
  batchMetricWrap: '.batches-datas-wrap',
  dateInput: 'input[type="date"]',
  deploymentNameLink: 'a.ds-deployment-name-link',
  deviceDetailLink: 'a[href*="/devices/"]',
  deviceSelectorOption: '.device-selector-option',
  deviceSelectorOptionName: '.device-selector-option-name',
  deviceSelectorResultsOrEmpty: '.device-selector-option, .device-selector-empty',
  deviceSelectorSelectedName: '.device-selector-selected-name',
  dropdownContainer: '.dropdown-container',
  dropdownLabelText: '.label-text',
  dropdownOption: '.dropdown-option',
  dropdownOptionText: '.dropdown-option-text',
  dropdownTrigger: '.dropdown-trigger',
  input: 'input',
  inputFieldWrapper: '.input-field-wrapper',
  inputLabelText: '.input-label-text',
  loading: '[aria-busy="true"], .loading, [class*="loading"]',
  overviewField: '.overview-field',
  overviewLabel: '.overview-label',
  overviewValue: '.overview-value, .badge, [class*="badge"]',
  rowActionTrigger: 'td[data-ds-col-id="actions"] button[aria-haspopup="menu"], td[data-ds-col-id="actions"] button',
  tableHeaderCell: 'thead th',
  tableRow: 'tbody tr',
  textarea: 'textarea',
  textareaFieldWrapper: '.textarea-field-wrapper',
  textareaLabelText: '.textarea-label-text',
  timeInput: 'input[type="time"]',
  toggleCard: '.toggle-card',
};

const LOCATOR_TEXT = {
  closeOrCancel: /close|cancel|×/i,
  deviceDetailDeploymentsTab: 'Deployments',
  importButton: /^import$/i,
  loading: /loading/i,
  selectAll: 'Select All',
};

function exactRegex(value, flags = '') {
  return new RegExp(`^${escapeRegExp(value)}$`, flags);
}

function columnCellSelector(columnId) {
  return `td[data-ds-col-id="${columnId}"]`;
}

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

    this.listTitle = this.getPageTitle(T.PAGE_TITLE);
    this.searchInput = this.getListSearchInput();
    this.addDeploymentButton = this.getButton(T.ADD_DEPLOYMENT);
    this.deploymentRows = this.getTableRows();
    this.deploymentNameLinks = this.getDeploymentNameLinks();

    this.addDeploymentDialog = this.dialogByTitle(T.DIALOG_ADD_DEPLOYMENT);
    this.addDeploymentModalTitle = this.getDialogHeading(this.addDeploymentDialog, T.ADD_DEPLOYMENT);
    this.cancelButton = this.getCancelButton(this.addDeploymentDialog);
    this.saveAsDraftButton = this.getDialogButton(this.addDeploymentDialog, T.SAVE_AS_DRAFT);

    this.pageTitle = this.getPageTitle(T.DETAIL_TITLE);
    this.overviewTitle = this.getExactText(T.OVERVIEW_TITLE);

    this.tabList = this.getTabList();
    this.devicesTab = this.getTabButton(T.DEVICES_TAB);
    this.appsTab = this.getTabButton(T.APPS_TAB);
    this.batchesTab = this.getTabButton(T.BATCHES_TAB);

    this.editButton = this.getDetailActionButton(T.EDIT);
    this.publishButton = this.getDetailActionButton(T.PUBLISH);
    this.duplicateButton = this.getDetailActionButton(T.DUPLICATE);
    this.deleteButton = this.getDetailActionButton(T.DELETE);

    this.deploymentDeviceTitle = this.getExactText(T.DEPLOYMENT_DEVICE_TITLE);
    this.deploymentAppsTitle = this.getExactText(T.DEPLOYMENT_APPS_TITLE);
    this.deploymentBatchesTitle = this.getExactText(T.DEPLOYMENT_BATCHES_TITLE);

    this.importCsvButton = this.getButton(T.IMPORT_CSV);
    this.assignByTagButton = this.getButton(T.ASSIGN_BY_TAG);
    this.addDeviceButton = this.getButton(T.ADD_DEVICE);
    this.addAppButton = this.getButton(T.ADD_APP);
  }

  getPageTitle(title) {
    return this.page.getByRole('heading', { name: title }).or(this.getExactText(title));
  }

  getExactText(text) {
    return this.page.getByText(text, { exact: true });
  }

  getFirstExactText(text) {
    return this.getExactText(text).first();
  }

  getTextByPattern(pattern) {
    return this.page.getByText(pattern);
  }

  getButton(name, options = {}) {
    return this.page.getByRole('button', { name, ...options });
  }

  getDetailActionButton(actionName) {
    return this.getButton(actionName).first();
  }

  getRunDeploymentButton() {
    return this.getDetailActionButton(T.RUN_DEPLOYMENT);
  }

  getRetryButton() {
    return this.getDetailActionButton(T.RETRY);
  }

  getTabList() {
    return this.page.getByRole('tablist');
  }

  getTabButton(tabName) {
    return this.getTabList().getByRole('button', { name: tabName });
  }

  getDialogList() {
    return this.page.getByRole('dialog');
  }

  getActiveModalDialogs() {
    return this.page.locator(SELECTORS.activeModalDialog);
  }

  getDialogHeading(dialog, title) {
    return dialog.getByRole('heading', { name: title });
  }

  getDialogButton(dialog, name, options = {}) {
    return dialog.getByRole('button', { name, ...options });
  }

  getCancelButton(dialog) {
    return this.getDialogButton(dialog, T.CANCEL);
  }

  getAddButton(dialog) {
    return this.getDialogButton(dialog, exactRegex(T.ADD));
  }

  getLastAddButton() {
    return this.getButton(exactRegex(T.ADD)).last();
  }

  getAssignButton(dialog) {
    return this.getDialogButton(dialog, T.ASSIGN);
  }

  getLastAssignButton() {
    return this.getButton(exactRegex(T.ASSIGN)).last();
  }

  getSaveChangesButton(dialog) {
    return this.getDialogButton(dialog, T.SAVE_CHANGES);
  }

  getRemoveButton(dialog) {
    return this.getDialogButton(dialog, T.REMOVE);
  }

  getRunButton(dialog) {
    return this.getDialogButton(dialog, T.RUN);
  }

  getRetryDialogButton(dialog) {
    return this.getDialogButton(dialog, T.RETRY);
  }

  getDuplicateDialogButton(dialog) {
    return this.getDialogButton(dialog, T.DUPLICATE);
  }

  getDeleteDialogButton(dialog) {
    return this.getDialogButton(dialog, T.DELETE);
  }

  getConfirmButton(dialog) {
    return this.getDialogButton(dialog, T.CONFIRM);
  }

  getDialogCloseButton(dialog) {
    return this.getDialogButton(dialog, LOCATOR_TEXT.closeOrCancel).first();
  }

  getDialogText(dialog, text) {
    return dialog.getByText(text);
  }

  getImportDialogButton(dialog) {
    return this.getDialogButton(dialog, LOCATOR_TEXT.importButton);
  }

  getLinkByName(name) {
    return this.page.getByRole('link', { name }).first();
  }

  getMenu() {
    return this.page.getByRole('menu').last();
  }

  getMenuItems() {
    return this.page.getByRole('menuitem');
  }

  getMenuItemByName(name) {
    return this.page.getByRole('menuitem', { name: exactRegex(name) });
  }

  getListSearchInput() {
    return this.page.getByPlaceholder(T.SEARCH_LIST_PLACEHOLDER);
  }

  getDeploymentNameLinks() {
    return this.page.locator(SELECTORS.deploymentNameLink);
  }

  getTableRows() {
    return this.page.locator(SELECTORS.tableRow);
  }

  getFirstTableRow() {
    return this.getTableRows().first();
  }

  getTableRowsByText(text) {
    return this.getTableRows().filter({ hasText: text });
  }

  rowByText(text) {
    return this.getTableRowsByText(text).first();
  }

  getTableHeaderByName(columnName) {
    return this.page.locator(SELECTORS.tableHeaderCell).filter({ hasText: columnName }).first();
  }

  getTableCell(row, columnId) {
    return row.locator(columnCellSelector(columnId)).first();
  }

  getRowActionTrigger(row) {
    return row.locator(SELECTORS.rowActionTrigger).last();
  }

  getDeviceDetailLink(row) {
    return row.locator(SELECTORS.deviceDetailLink).first();
  }

  getDeviceDeploymentStatusCell(row) {
    return this.getTableCell(row, 'deploymentStatus');
  }

  getDeploymentStatusCell(row) {
    return this.getTableCell(row, 'status');
  }

  getDeviceDetailDeploymentsTab() {
    return this.getButton(LOCATOR_TEXT.deviceDetailDeploymentsTab, { exact: true }).or(
      this.page.getByRole('tab', { name: LOCATOR_TEXT.deviceDetailDeploymentsTab })
    );
  }

  inputByLabel(label) {
    return this.page
      .locator(SELECTORS.inputFieldWrapper)
      .filter({ has: this.page.locator(SELECTORS.inputLabelText, { hasText: exactRegex(label) }) })
      .locator(SELECTORS.input)
      .first();
  }

  textareaByLabel(label) {
    return this.page
      .locator(SELECTORS.textareaFieldWrapper)
      .filter({ has: this.page.locator(SELECTORS.textareaLabelText, { hasText: exactRegex(label) }) })
      .locator(SELECTORS.textarea)
      .first();
  }

  dropdownByLabel(label) {
    return this.page
      .locator(SELECTORS.dropdownContainer)
      .filter({ has: this.page.locator(SELECTORS.dropdownLabelText, { hasText: exactRegex(label) }) })
      .first();
  }

  getDropdownTrigger(dropdown) {
    return dropdown.locator(SELECTORS.dropdownTrigger);
  }

  getDropdownOptionByLabel(optionLabel) {
    return this.page
      .locator(SELECTORS.dropdownOption)
      .filter({ has: this.page.locator(SELECTORS.dropdownOptionText, { hasText: exactRegex(optionLabel) }) })
      .first();
  }

  getDateInput() {
    return this.page.locator(SELECTORS.dateInput).last();
  }

  getTimeInput() {
    return this.page.locator(SELECTORS.timeInput).last();
  }

  getSwitchByLabel(label) {
    return this.page
      .locator(SELECTORS.toggleCard)
      .filter({ hasText: label })
      .getByRole('switch')
      .first();
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
    return this.page.getByPlaceholder(T.SEARCH_TAG_PLACEHOLDER);
  }

  getAddDeviceSelectedCount() {
    return this.page.getByText(T.SELECTED_ZERO_ITEMS);
  }

  getAddAppSelectedCount() {
    return this.page.getByText(T.SELECTED_ZERO_ITEMS);
  }

  getSelectedOneItemsText() {
    return this.page.getByText(T.SELECTED_ONE_ITEMS);
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

  getNoDeviceEmptyText() {
    return this.page.getByText(T.NO_DEVICE_EMPTY);
  }

  getNoAppEmptyText() {
    return this.page.getByText(T.NO_APP_EMPTY);
  }

  getNoBatchEmptyText() {
    return this.page.getByText(T.NO_BATCH_EMPTY);
  }

  getCharCounterNameMax() {
    return this.page.getByText(T.CHAR_COUNTER_NAME_MAX);
  }

  getCharCounterDescMax() {
    return this.page.getByText(T.CHAR_COUNTER_DESC_MAX);
  }

  getListColumnHeaderText(columnName) {
    return this.getFirstExactText(columnName);
  }

  getBatchMetricLabel(label) {
    return this.getFirstExactText(label);
  }

  getBatchTableColumnHeader(columnName) {
    return this.getFirstExactText(columnName);
  }

  getAppsTableColumnHeader(columnName) {
    return this.getFirstExactText(columnName);
  }

  getOverviewField(label) {
    return this.page
      .locator(SELECTORS.overviewField)
      .filter({ has: this.page.locator(SELECTORS.overviewLabel, { hasText: exactRegex(label, 'i') }) })
      .first();
  }

  getOverviewValueLocator(field) {
    return field.locator(SELECTORS.overviewValue).first();
  }

  getStatusBadgeText(badge) {
    return this.getFirstExactText(badge);
  }

  getCreatedByText() {
    return this.getTextByPattern(new RegExp(T.CREATED_BY, 'i'));
  }

  getLastUpdatedByText() {
    return this.getTextByPattern(new RegExp(T.LAST_UPDATED_BY, 'i'));
  }

  getBatchMetric(label) {
    return this.page
      .locator(SELECTORS.batchMetricWrap)
      .filter({ has: this.page.locator(SELECTORS.batchMetricLabel, { hasText: exactRegex(label) }) })
      .first();
  }

  getBatchMetricValueLocator(metric) {
    return metric.locator(SELECTORS.batchMetricValue);
  }

  getAppResultOptions() {
    return this.page.locator(SELECTORS.addAppResultOption);
  }

  getAppResultOptionByName(appName) {
    return this.getAppResultOptions().filter({ hasText: appName }).first();
  }

  getAppResultOptionByExactName(appName) {
    return this.getAppResultOptions()
      .filter({
        has: this.page.locator(SELECTORS.addAppResultOptionText, {
          hasText: exactRegex(appName),
        }),
      })
      .first();
  }

  getAppResultOptionText(option) {
    return option.locator(SELECTORS.addAppResultOptionText).first();
  }

  getAddAppResultsOrEmpty() {
    return this.page.locator(SELECTORS.addAppResultsOrEmpty);
  }

  getAddAppLoadingText() {
    return this.getAddAppResultsOrEmpty().filter({ hasText: LOCATOR_TEXT.loading });
  }

  getAddAppSelectedNameByExactName(appName) {
    return this.page.locator(SELECTORS.addAppSelectedName, { hasText: exactRegex(appName) }).first();
  }

  getAddAppSelectedNameByText(text) {
    return this.page.locator(SELECTORS.addAppSelectedName).filter({ hasText: text }).first();
  }

  getFirstAddAppSelectedName() {
    return this.page.locator(SELECTORS.addAppSelectedName).first();
  }

  getDeviceSelectorOptions() {
    return this.page.locator(SELECTORS.deviceSelectorOption);
  }

  getDeviceSelectorOptionByText(text) {
    return this.getDeviceSelectorOptions().filter({ hasText: text }).first();
  }

  getDeviceSelectorOptionByDeviceName(deviceName) {
    return this.getDeviceSelectorOptions()
      .filter({
        has: this.page.locator(SELECTORS.deviceSelectorOptionName, {
          hasText: new RegExp(escapeRegExp(deviceName)),
        }),
      })
      .first();
  }

  getDeviceSelectorOptionByMac(macAddress) {
    return this.getDeviceSelectorOptions().filter({ hasText: macAddress }).first();
  }

  getDeviceSelectorResultsOrEmpty() {
    return this.page.locator(SELECTORS.deviceSelectorResultsOrEmpty);
  }

  getDeviceSelectorSelectedName(textMatcher) {
    return this.page.locator(SELECTORS.deviceSelectorSelectedName).filter({ hasText: textMatcher }).first();
  }

  getFirstSelectableDeviceOption() {
    return this.getDeviceSelectorOptions().filter({ hasNotText: LOCATOR_TEXT.selectAll }).first();
  }

  getDeviceSelectorOptionName(option) {
    return option.locator(SELECTORS.deviceSelectorOptionName).first();
  }

  getLoadingLocator() {
    return this.page.locator(SELECTORS.loading);
  }

  getLoadingText() {
    return this.page.getByText(LOCATOR_TEXT.loading);
  }

  async dismissBlockingDialogs(maxAttempts = 3) {
    const dialogLocator = this.getActiveModalDialogs();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const hasDialog = (await dialogLocator.count().catch(() => 0)) > 0;
      if (!hasDialog) return;

      const dialog = dialogLocator.last();
      const closeBtn = this.getDialogCloseButton(dialog);
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
      await expect(this.getFirstExactText(column)).toBeVisible({ timeout: this.timeout });
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

  async fillInput(label, value) {
    await this.inputByLabel(label).fill(String(value));
  }

  async fillTextarea(label, value) {
    await this.textareaByLabel(label).fill(String(value));
  }

  async selectDropdown(label, optionLabel) {
    const dropdown = this.dropdownByLabel(label);
    await this.getDropdownTrigger(dropdown).click();
    await this.getDropdownOptionByLabel(optionLabel).click();
  }

  dialogByTitle(title) {
    return this.getDialogList().filter({ has: this.page.getByRole('heading', { name: title }) }).last();
  }

  async waitForUiSettled() {
    await expect
      .poll(
        async () => this.getLoadingLocator().count(),
        {
          timeout: Math.min(this.timeout, 10000),
          message: 'Expected Bulk Deployment UI to finish loading',
        }
      )
      .toBe(0)
      .catch(() => {});
  }

  async searchAndWait(searchInput, keyword, resultLocator, emptyLocator) {
    await searchInput.fill('');
    await searchInput.fill(keyword);
    await expect
      .poll(
        async () => {
          const resultCount = await resultLocator.count().catch(() => 0);
          const emptyVisible = emptyLocator ? await emptyLocator.isVisible().catch(() => false) : false;
          return resultCount > 0 || emptyVisible;
        },
        {
          timeout: this.timeout,
          message: `Expected search results or empty state for keyword "${keyword}"`,
        }
      )
      .toBe(true);
  }

  async visibleTexts(locator) {
    return locator
      .evaluateAll((items) =>
        items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
      )
      .catch(() => []);
  }

  async waitForToastOrNetwork() {
    await this.waitForUiSettled();
  }
}

module.exports = BulkDeploymentBase;
