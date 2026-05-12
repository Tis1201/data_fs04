const { expect } = require('@playwright/test');

class DeviceTagsPage {
  constructor(page, options = {}) {
    this.page = page;
    this.appUrl = options.appUrl;
    this.timeout = options.timeout || 30000;

    this.listTitle = this.page.locator('h1, h2, h3').filter({ hasText: /^Tags$/i }).first();
    this.listSubtitle = this.page.getByText('Manage tags for organizing devices').first();
    this.searchInput = this.page.getByPlaceholder('Search by name');
    this.addTagButton = this.page.getByRole('button', { name: /Add Tag/i });
    this.table = this.page.locator('table').first();
    this.tableRows = this.page.locator('table tbody tr');
    this.noTagsFound = this.page.getByText('No tags found');
    this.paginationDetails = this.page.locator('text=/\\d+\\s*-\\s*\\d+\\s+of\\s+\\d+/').first();

    this.addDeviceButton = this.page.getByRole('button', { name: /Add device/i });
    this.deleteDetailButton = this.page.getByRole('button', { name: /^Delete$/i }).first();
    this.editDetailButton = this.page.getByRole('button', { name: /Edit Tag/i });
    this.detailOverviewCard = this.page.locator('[class*="card"], .ds-card').filter({ hasText: 'Tag Overview' }).first();
    this.assignedDevicesTable = this.page.locator('table').last();
  }

  get listUrl() {
    return `${this.appUrl}/user/iot/device_tags`;
  }

  async gotoList() {
    await this.page.goto(this.listUrl, { waitUntil: 'domcontentloaded' });
    await this.waitForListReady();
  }

  async waitForListReady() {
    await expect(this.addTagButton).toBeVisible({ timeout: this.timeout });
    await expect(this.searchInput).toBeVisible({ timeout: this.timeout });
    await expect(this.table).toBeVisible({ timeout: this.timeout });
  }

  rowByText(text) {
    return this.tableRows.filter({ hasText: text }).first();
  }

  columnHeader(headerText) {
    return this.page.locator('thead th').filter({ hasText: headerText }).first();
  }

  async searchByName(name) {
    await this.searchInput.click();
    await this.searchInput.fill(name);
    await expect
      .poll(
        () => new URL(this.page.url()).searchParams.get('search') || '',
        { timeout: this.timeout, message: `Expected Tags search to apply for "${name}"` },
      )
      .toBe(name);
  }

  async expectNoResults() {
    await expect(this.noTagsFound).toBeVisible({ timeout: this.timeout });
  }

  tagDialog() {
    return this.page.getByRole('dialog').filter({ hasText: /Add Tag|Edit Tag|Tag Name|Description/i }).last();
  }

  deleteDialog() {
    return this.page.getByRole('dialog').filter({ hasText: /Delete Tag/i }).last();
  }

  async openAddTagModal() {
    await this.addTagButton.click();
    const dialog = this.tagDialog();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  }

  async fillTagDialog(dialog, { name, description = '' }) {
    const fields = dialog.locator('input, textarea');
    await expect(fields.first()).toBeVisible({ timeout: this.timeout });
    await fields.nth(0).fill(name);
    if ((await fields.count()) > 1) {
      await fields.nth(1).fill(description);
    }
  }

  async submitTagDialog(dialog, submitName = /Add|Save|Create/i) {
    await dialog.getByRole('button', { name: submitName }).last().click();
  }

  async createTag({ name, description = '' }) {
    const dialog = await this.openAddTagModal();
    await this.fillTagDialog(dialog, { name, description });
    await this.submitTagDialog(dialog, /^Add$|^Save$|Create/i);
    await expect(this.rowByText(name)).toBeVisible({ timeout: this.timeout });
  }

  async openRowActionMenu(rowText) {
    await this.page.keyboard.press('Escape').catch(() => {});
    const row = this.rowByText(rowText);
    await expect(row).toBeVisible({ timeout: this.timeout });
    await row.locator('td').last().locator('button').first().click();
    const menu = this.page.getByRole('menu').last();
    await expect(menu).toBeVisible({ timeout: this.timeout });
    return menu;
  }

  async openDetailByName(name) {
    const row = this.rowByText(name);
    await expect(row).toBeVisible({ timeout: this.timeout });
    await row.locator('a').first().click();
    await expect(this.page).toHaveURL(/\/user\/iot\/device_tags\/[^/]+\/?$/);
    await expect(this.detailOverviewCard).toBeVisible({ timeout: this.timeout });
  }

  async openDetailFromActionMenu(name) {
    const menu = await this.openRowActionMenu(name);
    await menu.getByText('View', { exact: true }).click();
    await expect(this.page).toHaveURL(/\/user\/iot\/device_tags\/[^/]+\/?$/);
    await expect(this.detailOverviewCard).toBeVisible({ timeout: this.timeout });
  }

  async editTagFromDetail({ name, description = '' }) {
    await this.editDetailButton.click();
    const dialog = this.tagDialog();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await this.fillTagDialog(dialog, { name, description });
    await this.submitTagDialog(dialog, /^Save$|Update/i);
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    await expect(this.detailOverviewCard).toContainText(name, { timeout: this.timeout });
  }

  async addDeviceBySearch(searchTerm) {
    await this.addDeviceBySearchAndPick(searchTerm, searchTerm);
  }

  async addDeviceBySearchAndPick(searchTerm, pickMatch) {
    await this.addDeviceButton.click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: /Add Device|Select Devices|Device/i }).last();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    const search = dialog.locator('input').first();
    await expect(search).toBeVisible({ timeout: this.timeout });
    await search.fill(searchTerm);
    const option =
      pickMatch instanceof RegExp
        ? dialog.getByText(pickMatch).first()
        : dialog.getByText(new RegExp(escapeRegExp(String(pickMatch)), 'i')).first();
    await expect(option).toBeVisible({ timeout: this.timeout });
    await option.click();
    await dialog.getByRole('button', { name: /^Add$/i }).click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    const assertNeedle = pickMatch instanceof RegExp ? pickMatch.source : String(pickMatch);
    await expect(this.assignedDevicesTable).toContainText(new RegExp(escapeRegExp(assertNeedle), 'i'), {
      timeout: this.timeout,
    });
  }

  async expectDeviceDetailDoesNotShowTag(deviceId, tagName) {
    await this.page.goto(`${this.appUrl}/user/iot/devices/${encodeURIComponent(deviceId)}`, {
      waitUntil: 'domcontentloaded',
    });
    const tagHit = this.page.locator('.tags-row').filter({ hasText: tagName });
    await expect(tagHit).toHaveCount(0);
  }

  async deleteFromDetail() {
    await this.deleteDetailButton.click();
    const dialog = this.deleteDialog();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: /^Delete$/i }).click();
    await expect(this.page).toHaveURL(/\/user\/iot\/device_tags/);
    await this.waitForListReady();
  }

  async deleteTagFromList(name) {
    await this.gotoList();
    await this.searchByName(name);
    const row = this.rowByText(name);
    if (!(await row.isVisible().catch(() => false))) {
      return;
    }
    const menu = await this.openRowActionMenu(name);
    await menu.getByText('Delete', { exact: true }).click();
    const dialog = this.deleteDialog();
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    await dialog.getByRole('button', { name: /^Delete$/i }).click();
    await expect(row).toBeHidden({ timeout: this.timeout });
  }

  async cleanupTagNames(names) {
    const uniqueNames = [...new Set(names.filter(Boolean))].reverse();
    for (const name of uniqueNames) {
      await this.deleteTagFromList(name).catch(() => {});
    }
  }

  async clickColumnHeader(headerText) {
    await this.columnHeader(headerText).click();
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = DeviceTagsPage;
