const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp, normalizeText } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Apps tab: empty state, add/remove app, search in Add App modal. */
const bulkDeploymentApps = {
  async expectAppsEmptyState() {
    await expect(this.page.getByText(T.NO_APP_EMPTY)).toBeVisible({ timeout: this.timeout });
  },

  async openAddAppModal() {
    await this.openAppsTab();
    await this.addAppButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_ADD_APP);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await expect(this.getAddAppSearchInput()).toBeVisible({ timeout: this.timeout });
    return dialog;
  },

  async selectAppInModal(appName) {
    const searchInput = this.getAddAppSearchInput();
    await searchInput.fill('');
    await searchInput.fill(appName);

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

    if (!(await option.isVisible().catch(() => false))) {
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
  },

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
  },

  async removeAppByName(appName) {
    await this.openAppsTab();
    await this.selectRowAction(appName, T.REMOVE);
    const dialog = this.dialogByTitle(T.DIALOG_REMOVE_APP);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: T.REMOVE }).click();
    await this.waitForToastOrNetwork();
    await expect(this.rowByText(appName)).toHaveCount(0, { timeout: this.timeout });
  },

  async searchAppInAddModal(keyword) {
    const searchInput = this.getAddAppSearchInput();
    const results = this.getAppResultOptions();
    const empty = this.getNoAppsMatchText();
    await this.searchAndWait(searchInput, keyword, results, empty);
  },

  async expectAppSearchResultVisible(appName) {
    await expect(this.getAppResultOptionByName(appName)).toBeVisible({ timeout: this.timeout });
  },

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
  },
};

module.exports = bulkDeploymentApps;
