const { expect } = require('@playwright/test');
const { DEVICE_DETAIL } = require('../../constants/device-detail.constants');

class InstalledAppsPanel {
  constructor(page, options = {}) {
    this.page = page;
    this.timeout = options.timeout || 30000;

    this.tabButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.INSTALLED_APPS_TAB}$`, 'i'),
    });

    this.heading = this.page.getByRole('heading', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.INSTALLED_APPS_HEADING}$`, 'i'),
    });

    this.searchInput = this.page.getByPlaceholder(
      new RegExp(DEVICE_DETAIL.UI_TEXT.INSTALLED_APPS_SEARCH_PLACEHOLDER, 'i')
    );

    this.installNewAppButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.INSTALL_NEW_APP_BUTTON}$`, 'i'),
    });

    this.loadingText = this.page.getByText(
      new RegExp(DEVICE_DETAIL.UI_TEXT.INSTALLED_APPS_LOADING, 'i')
    );

    this.table = this.page.locator('table').first();
    this.rows = this.table.locator('tbody tr');

    this.uninstallAction = this.page
      .getByRole('menuitem', {
        name: new RegExp(`${DEVICE_DETAIL.UI_TEXT.UNINSTALL_APP_MENU_ITEM}|uninstall`, 'i'),
      })
      .or(
        this.page.getByText(
          new RegExp(`${DEVICE_DETAIL.UI_TEXT.UNINSTALL_APP_MENU_ITEM}|uninstall`, 'i')
        )
      )
      .first();

    this.uninstallDialog = this.page.getByRole('dialog', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.UNINSTALL_MODAL_TITLE}$`, 'i'),
    });

    this.uninstallConfirmButton = this.uninstallDialog.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.UNINSTALL_CONFIRM_BUTTON}$`, 'i'),
    });

    this.uninstallCancelButton = this.uninstallDialog.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
    });
  }

  async open() {
    await this.tabButton.click();
    await this.waitForReady();
  }

  async waitForReady() {
    await expect(
      this.heading,
      'Installed Apps heading should be visible after opening the tab.'
    ).toBeVisible({ timeout: this.timeout });

    await expect(
      this.searchInput,
      'Installed Apps search input should be visible.'
    ).toBeVisible({ timeout: this.timeout });

    await expect(
      this.installNewAppButton,
      'Installed Apps tab should expose the Install New App button.'
    ).toBeVisible({ timeout: this.timeout });

    await expect(this.table, 'Installed Apps table should be visible.').toBeVisible({
      timeout: this.timeout,
    });

    await this.waitForAppsLoaded();
  }

  async waitForAppsLoaded() {
    const loadingVisible = await this.loadingText.isVisible().catch(() => false);

    if (loadingVisible) {
      await this.loadingText.waitFor({
        state: 'hidden',
        timeout: this.timeout,
      });
    }
  }

  async search(term = '') {
    await this.waitForReady();
    await this.searchInput.fill(term);
    await expect(this.searchInput).toHaveValue(term, {
      timeout: this.timeout,
      message: `Installed Apps search input did not update to "${term}".`,
    });

    await this.waitForAppsLoaded();
  }

  async clearSearch() {
    await this.search('');
  }

  async getVisibleRowCount() {
    await this.waitForReady();
    return this.rows.count();
  }

  async extractRecordFromRow(rowLocator) {
    const appName = ((await rowLocator
      .locator('[data-ds-col-id="app"] span')
      .nth(0)
      .textContent()
      .catch(() => '')) || '').trim();

    const packageName = ((await rowLocator
      .locator('[data-ds-col-id="app"] span')
      .nth(1)
      .textContent()
      .catch(() => '')) || '').trim();

    const type = ((await rowLocator
      .locator('[data-ds-col-id="app_type"]')
      .textContent()
      .catch(() => '')) || '').trim();

    const version = ((await rowLocator
      .locator('[data-ds-col-id="version"]')
      .textContent()
      .catch(() => '')) || '').trim();

    const size = ((await rowLocator
      .locator('[data-ds-col-id="size"]')
      .textContent()
      .catch(() => '')) || '').trim();

    const installedOn = ((await rowLocator
      .locator('[data-ds-col-id="installed"]')
      .textContent()
      .catch(() => '')) || '').trim();

    return {
      name: appName,
      packageName,
      type,
      version,
      size,
      installedOn,
      rawText: ((await rowLocator.textContent().catch(() => '')) || '')
        .replace(/\s+/g, ' ')
        .trim(),
    };
  }

  getRowByPackage(packageName) {
    return this.rows.filter({ hasText: packageName }).first();
  }

  getRowByName(appName) {
    return this.rows.filter({ hasText: appName }).first();
  }

  getRowByPackageAndVersion(packageName, version) {
    return this.rows
      .filter({ hasText: packageName })
      .filter({ hasText: new RegExp(`\\b${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) })
      .first();
  }

  async findAppByPackage(packageName) {
    await this.search(packageName);
    const row = this.getRowByPackage(packageName);
    const visible = await row.isVisible().catch(() => false);
    if (!visible) {
      return null;
    }

    return this.extractRecordFromRow(row);
  }

  async findAppByName(appName) {
    await this.search(appName);
    const row = this.getRowByName(appName);
    const visible = await row.isVisible().catch(() => false);
    if (!visible) {
      return null;
    }

    return this.extractRecordFromRow(row);
  }

  async findExactApp(packageName, version) {
    await this.search(packageName);
    const row = this.getRowByPackageAndVersion(packageName, version);
    const visible = await row.isVisible().catch(() => false);
    if (!visible) {
      return null;
    }

    return this.extractRecordFromRow(row);
  }

  async isPackageVisible(packageName) {
    await this.search(packageName);
    return this.getRowByPackage(packageName).isVisible().catch(() => false);
  }

  async expectPackageAbsent(packageName, timeout = this.timeout) {
    await expect.poll(
      async () => {
        await this.search(packageName);
        return this.getRowByPackage(packageName).isVisible().catch(() => false);
      },
      {
        timeout,
        message: `Installed Apps should not contain package "${packageName}".`,
      }
    ).toBe(false);
  }

  getActionsButtonForRow(row) {
    return row
      .locator('[data-ds-col-id="actions"] button')
      .last()
      .or(row.locator('td').last().getByRole('button').last())
      .or(row.getByRole('button').last());
  }

  async openActionsForPackage(packageName) {
    await this.search(packageName);
    const row = this.getRowByPackage(packageName);

    await expect(
      row,
      `Installed Apps row for package "${packageName}" should be visible.`
    ).toBeVisible({ timeout: this.timeout });

    const actionButton = this.getActionsButtonForRow(row);
    await expect(
      actionButton,
      `Installed Apps action menu should be visible for "${packageName}".`
    ).toBeVisible({ timeout: this.timeout });

    await actionButton.click({ force: true });
  }

  async uninstallPackage(packageName) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.openActionsForPackage(packageName);

        await expect(
          this.uninstallAction,
          `Uninstall action should be visible for package "${packageName}".`
        ).toBeVisible({ timeout: this.timeout });

        await this.uninstallAction.click();

        await expect(
          this.uninstallDialog,
          `Uninstall dialog should appear for package "${packageName}".`
        ).toBeVisible({ timeout: this.timeout });

        return;
      } catch (error) {
        lastError = error;
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }

    throw lastError;
  }

  async confirmUninstall() {
    await expect(
      this.uninstallConfirmButton,
      'Uninstall confirmation button should be enabled.'
    ).toBeEnabled({ timeout: this.timeout });

    await this.uninstallConfirmButton.click();
    await this.uninstallDialog.waitFor({ state: 'hidden', timeout: this.timeout });
  }

  async cancelUninstallIfVisible() {
    const visible = await this.uninstallDialog.isVisible().catch(() => false);
    if (!visible) {
      return;
    }

    await this.uninstallCancelButton.click();
    await this.uninstallDialog.waitFor({ state: 'hidden', timeout: this.timeout });
  }
}

module.exports = InstalledAppsPanel;
