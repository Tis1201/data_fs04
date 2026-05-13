const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Primary actions from deployment detail (publish, run, duplicate, delete). */
const bulkDeploymentActions = {
  async isDetailActionVisible(actionName) {
    return this.getDetailActionButton(actionName).isVisible().catch(() => false);
  },

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
  },

  async runDeploymentFromDetail() {
    const runButton = this.getRunDeploymentButton();
    await expect(runButton).toBeVisible({ timeout: this.timeout });
    await runButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_RUN_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await this.getRunButton(dialog).click();
    await this.waitForToastOrNetwork();
  },

  async retryDeploymentFromDetail() {
    const retryButton = this.getRetryButton();
    await expect(retryButton).toBeVisible({ timeout: this.timeout });
    await retryButton.click();
    const dialog = this.dialogByTitle(T.DIALOG_RETRY_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    const responsePromise = this.page
      .waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/v2/bundles/') &&
          response.url().includes('/retry'),
        { timeout: this.timeout }
      )
      .catch(() => null);
    await this.getRetryDialogButton(dialog).click();
    await responsePromise;
    await this.waitForToastOrNetwork();
  },

  async duplicateFromDetail() {
    const currentUrl = this.page.url();
    await expect(this.duplicateButton.first()).toBeVisible({ timeout: this.timeout });
    await this.duplicateButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_DUPLICATE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await this.getDuplicateDialogButton(dialog).click();
    await this.page.waitForFunction((url) => window.location.href !== url, currentUrl, { timeout: this.timeout });
    await this.waitForPageReady();
    const duplicatedId = this.getDeploymentIdFromUrl();
    const duplicatedName = await this.getOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME).catch(() => '');
    this.registerDeployment({ id: duplicatedId, name: duplicatedName });
    return duplicatedId;
  },

  async cancelDuplicateFromDetail() {
    const currentUrl = this.page.url();
    await this.duplicateButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_DUPLICATE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await this.getCancelButton(dialog).click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    expect(this.page.url()).toBe(currentUrl);
  },

  async deleteFromDetail(confirm = true) {
    await expect(this.deleteButton.first()).toBeVisible({ timeout: this.timeout });
    await this.deleteButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_DELETE_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    if (!confirm) {
      await this.getCancelButton(dialog).click();
      await expect(dialog).toBeHidden({ timeout: this.timeout });
      return;
    }
    const navigationPromise = this.page
      .waitForURL((url) => url.pathname === this.listPath, { timeout: this.timeout })
      .catch(() => null);
    await this.getDeleteDialogButton(dialog).click();
    await navigationPromise;
    await this.waitForListReady();
  },
};

module.exports = bulkDeploymentActions;
