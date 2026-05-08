const { expect } = require('@playwright/test');

class AppPinningRulesPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{ appUrl: string, timeout?: number }} options
   */
  constructor(page, options) {
    this.page = page;
    this.appUrl = options.appUrl;
    this.timeout = options.timeout || 30000;
    this.listPath = '/user/iot/pin-rules';

    this.pageTitle = this.page.getByRole('heading', { name: 'App Pinning Rules' });
    this.searchInput = this.page.getByPlaceholder('Search by Name or ID');
    this.addRuleButton = this.page.getByRole('button', { name: /^Add Rule$/ });
    this.rows = this.page.locator('tbody tr');
  }

  async gotoList(searchParams = '') {
    const suffix = searchParams ? `?${searchParams}` : '';
    await this.page.goto(`${this.appUrl}${this.listPath}${suffix}`, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeout,
    });
  }

  async waitForListReady() {
    await expect(this.pageTitle).toBeVisible({ timeout: this.timeout });
    await expect(this.searchInput).toBeVisible({ timeout: this.timeout });
    await expect(this.addRuleButton).toBeVisible({ timeout: this.timeout });
    for (const header of ['Name', 'Pinned Apps', 'Applied to', 'Last Updated On', 'Status', 'Actions']) {
      await expect(this.page.getByText(header, { exact: true }).first()).toBeVisible({ timeout: this.timeout });
    }
  }

  rowByText(text) {
    return this.rows.filter({ hasText: text }).first();
  }

  async searchRule(keyword) {
    await this.searchInput.fill('');
    await this.searchInput.fill(keyword);
    await expect
      .poll(() => new URL(this.page.url()).searchParams.get('search') || '', {
        timeout: this.timeout,
        message: `Expected pin rule search query to become "${keyword}"`,
      })
      .toBe(keyword);
  }

  async expectNoRulesFound() {
    await expect(this.rowByText('No pin rules found')).toBeVisible({ timeout: this.timeout });
  }

  async clickColumnHeader(header) {
    await this.page.locator('thead th').filter({ hasText: header }).first().click();
    await this.waitForUiSettled();
  }

  async waitForUiSettled() {
    await expect
      .poll(() => this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count(), {
        timeout: Math.min(this.timeout, 10000),
      })
      .toBe(0)
      .catch(() => {});
  }

  async openAddRuleModal() {
    await this.addRuleButton.click();
    const dialog = this.getDialogByText('Add Rule').last();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  getDialogByText(text) {
    return this.page.getByRole('dialog').filter({ hasText: text });
  }

  async fillRuleBasics(dialog, name, description = '') {
    await dialog.getByPlaceholder('Rule name').fill(name);
    if (description) {
      await dialog.getByPlaceholder('Description (optional)').fill(description);
    }
  }

  async addFirstAvailableApp(dialog) {
    await dialog.getByRole('button', { name: 'Add App' }).click();
    const appDialog = this.getDialogByText('Add App').last();
    await expect(appDialog).toBeVisible({ timeout: this.timeout });

    const firstAppOption = this.page.locator('.app-picker-option').filter({ hasText: /com\./ }).first();
    await expect(firstAppOption).toBeVisible({ timeout: this.timeout });
    const optionText = ((await firstAppOption.innerText()) || '').replace(/\s+/g, ' ').trim();
    await firstAppOption.click();
    await expect(appDialog.getByText(/Selected \(1 items?\)/)).toBeVisible({ timeout: this.timeout });
    await appDialog.getByRole('button', { name: 'Assign' }).click();

    await expect(dialog.locator('.pinned-app-selected')).toContainText(/com\./, { timeout: this.timeout });
    return optionText;
  }

  async saveAndPublish(dialog) {
    const responsePromise = this.page
      .waitForResponse((response) => (
        response.url().includes('/api/v2/pin-rules') &&
        response.request().method() === 'POST'
      ), { timeout: this.timeout })
      .catch(() => null);
    await dialog.getByRole('button', { name: 'Save & Publish' }).click();
    await responsePromise;
    await expect(dialog).toBeHidden({ timeout: this.timeout });
  }

  async saveAsDraft(dialog) {
    const responsePromise = this.page
      .waitForResponse((response) => (
        response.url().includes('/api/v2/pin-rules') &&
        response.request().method() === 'POST'
      ), { timeout: this.timeout })
      .catch(() => null);
    await dialog.getByRole('button', { name: 'Save as Draft' }).click();
    await responsePromise;
    await expect(dialog).toBeHidden({ timeout: this.timeout });
  }

  async openRowActionMenu(rowText) {
    await this.page.keyboard.press('Escape').catch(() => {});
    const row = this.rowByText(rowText);
    await expect(row).toBeVisible({ timeout: this.timeout });
    const trigger = row.locator('button[aria-haspopup="menu"]').last();
    await expect(trigger).toBeVisible({ timeout: this.timeout });
    await trigger.click({ force: true });
    const menu = this.page.locator('[role="menu"]').last();
    await expect(menu)
      .toBeVisible({ timeout: 3000 })
      .catch(async () => {
        await trigger.click({ force: true });
        await expect(menu).toBeVisible({ timeout: this.timeout });
      });
    return menu;
  }

  async getRowActionLabels(rowText) {
    const menu = await this.openRowActionMenu(rowText);
    const labels = await menu.getByRole('menuitem').allTextContents();
    await this.page.keyboard.press('Escape').catch(() => {});
    return labels.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  async selectRowAction(rowText, actionName) {
    const menu = await this.openRowActionMenu(rowText);
    await menu.getByRole('menuitem', { name: new RegExp(`^${actionName}$`) }).click();
  }

  async duplicateRule(rowText) {
    await this.selectRowAction(rowText, 'Duplicate');
    const dialog = this.getDialogByText('Duplicate Rule').last();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Duplicate' }).click();
    await this.waitForUiSettled();
  }

  async deleteRule(rowText) {
    await this.selectRowAction(rowText, 'Delete');
    const dialog = this.getDialogByText('Delete Rule').last();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await this.waitForUiSettled();
  }
}

module.exports = AppPinningRulesPage;
