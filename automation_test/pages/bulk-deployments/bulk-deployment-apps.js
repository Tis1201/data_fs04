const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { normalizeText } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Apps tab: empty state, add/remove app, search in Add App modal. */
const bulkDeploymentApps = {
  async expectAppsEmptyState() {
    await expect(this.getNoAppEmptyText()).toBeVisible({ timeout: this.timeout });
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
      const loadingCount = await this.getLoadingLocator().count();
      const loadingText = await this.getAddAppLoadingText().count();
      return loadingCount + loadingText;
    }, {
      timeout: this.timeout,
      message: `Waiting for app search results to finish loading for "${appName}"`,
    }).toBe(0).catch(() => {});

    const option = this.getAppResultOptionByExactName(appName);

    if (!(await option.isVisible().catch(() => false))) {
      await expect.poll(async () => this.getLoadingLocator().count(), {
        timeout: 3000,
        message: `Waiting before retry for app "${appName}"`,
      }).toBe(0).catch(() => {});
      await searchInput.fill('');
      await searchInput.fill(appName);
      await expect.poll(async () => {
        const loadingCount = await this.getLoadingLocator().count();
        return loadingCount;
      }, {
        timeout: this.timeout,
        message: `Retry: waiting for app search results for "${appName}"`,
      }).toBe(0).catch(() => {});
    }

    if (!(await option.isVisible().catch(() => false))) {
      const resultTexts = await this.getAddAppResultsOrEmpty()
        .evaluateAll((items) => items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
        .catch(() => []);
      throw new Error(
        `Required Bulk Deployment app test data was not found or selectable in Add App modal. Expected app="${appName}". ` +
          `Results="${resultTexts.join('; ') || T.NO_APPS_MATCH}".`
      );
    }
    await option.click();
    const selectedApp = this.getAddAppSelectedNameByExactName(appName);
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
    const assignButton = this.getAssignButton(dialog);
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await this.waitForToastOrNetwork();
    for (const appName of appNames) {
      await expect(this.rowByText(appName)).toBeVisible({ timeout: this.timeout });
    }
  },

  /**
   * Pick catalog apps when the Add App row label is not a simple exact name match (e.g. version-specific catalog entries).
   * Tries strict name match first, then first result whose row text contains `matcher`.
   */
  async selectAppInModalFlexible(matcher) {
    const searchInput = this.getAddAppSearchInput();
    await searchInput.fill('');
    await searchInput.fill(matcher);

    await expect
      .poll(async () => {
        const loadingCount = await this.getLoadingLocator().count();
        return loadingCount;
      }, {
        timeout: this.timeout,
        message: `Waiting for app search to settle for "${matcher}"`,
      })
      .toBe(0)
      .catch(() => {});

    const exactOption = this.getAppResultOptionByExactName(matcher);

    if (await exactOption.isVisible().catch(() => false)) {
      await exactOption.click();
    } else {
      const loose = this.getAppResultOptionByName(matcher);
      await expect(loose).toBeVisible({
        timeout: this.timeout,
        message: `No Add App result matched "${matcher}"`,
      });
      await loose.click();
    }

    const selectedApp = this.getAddAppSelectedNameByText(matcher);
    if (!(await selectedApp.isVisible().catch(() => false))) {
      await expect(this.getFirstAddAppSelectedName()).toBeVisible({ timeout: this.timeout });
    }
  },

  async addAppsByFlexibleNames(matchers) {
    await this.openAddAppModal();
    for (const m of matchers) {
      await this.selectAppInModalFlexible(m);
    }
    const dialog = this.dialogByTitle(T.DIALOG_ADD_APP);
    const assignButton = this.getAssignButton(dialog);
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await this.waitForToastOrNetwork();
    for (const m of matchers) {
      await expect(this.rowByText(m)).toBeVisible({ timeout: this.timeout });
    }
  },

  async removeAppByName(appName) {
    await this.openAppsTab();
    await this.selectRowAction(appName, T.REMOVE);
    const dialog = this.dialogByTitle(T.DIALOG_REMOVE_APP);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await this.getRemoveButton(dialog).click();
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
    await expect(this.getExactText(T.ADD_APP).last()).toBeVisible({ timeout: this.timeout });

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
    const selectedName = normalizeText((await this.getAppResultOptionText(option).textContent()) || '');
    await option.click();

    const assignButton = this.getLastAssignButton();
    await expect(assignButton).toBeEnabled({ timeout: this.timeout });
    await assignButton.click();
    await expect(this.getFirstExactText(selectedName)).toBeVisible({ timeout: this.timeout });
    return selectedName;
  },
};

module.exports = bulkDeploymentApps;
