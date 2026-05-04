const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp, normalizeText, extractMacAddress } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** List page navigation, search, column sort, row action menu, publish/delete from list. */
const bulkDeploymentListPage = {
  async openAddDeploymentModal() {
    await this.gotoList();
    await this.waitForListReady();

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

    try {
      await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
      await expect(this.saveAsDraftButton).toBeVisible({ timeout: this.timeout });
    } catch {
      await this.gotoList();
      await this.waitForListReady();
      await this.addDeploymentButton.click();
      await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
      await expect(this.saveAsDraftButton).toBeVisible({ timeout: this.timeout });
    }
  },

  async searchDeployment(keyword) {
    await this.searchInput.fill('');
    await this.searchInput.fill(keyword);
    await this.waitForUiSettled();
  },

  async getVisibleDeploymentRowCount() {
    return await this.deploymentRows.count();
  },

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
  },

  async openDeploymentFromListByName(name) {
    await this.gotoList();
    await this.waitForListReady();
    await this.searchDeployment(name);
    await this.page.getByRole('link', { name }).first().click();
    await this.waitForPageReady();
  },

  async clickListColumnHeader(columnName) {
    await this.page.locator('thead th').filter({ hasText: columnName }).first().click();
    await this.waitForToastOrNetwork();
  },

  async getListCellText(rowText, columnId) {
    const row = this.rowByText(rowText);
    await expect(row).toBeVisible({ timeout: this.timeout });
    return normalizeText((await row.locator(`td[data-ds-col-id="${columnId}"]`).first().textContent()) || '');
  },

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
  },

  async selectRowAction(rowText, actionName) {
    await this.openRowActionMenu(rowText);
    await this.page.getByRole('menuitem', { name: new RegExp(`^${escapeRegExp(actionName)}$`) }).click();
    await this.waitForToastOrNetwork();
  },

  async getRowActionLabels(rowText) {
    await this.openRowActionMenu(rowText);
    const labels = await this.page.getByRole('menuitem').evaluateAll((items) =>
      items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim())
    );
    await this.page.keyboard.press('Escape').catch(() => {});
    return labels;
  },

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
  },

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
  },
};

module.exports = bulkDeploymentListPage;
