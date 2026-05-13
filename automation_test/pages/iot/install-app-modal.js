const { expect } = require('@playwright/test');
const { DEVICE_DETAIL } = require('../../constants/device-detail.constants');

class InstallAppModal {
  constructor(page, options = {}) {
    this.page = page;
    this.timeout = options.timeout || 30000;
    this.searchDelayMs = options.searchDelayMs || 800;

    this.dialog = this.page.getByRole('dialog', {
      name: new RegExp(DEVICE_DETAIL.UI_TEXT.INSTALL_MODAL_TITLE, 'i'),
    });

    this.searchInput = this.dialog.getByRole('textbox', {
      name: new RegExp(DEVICE_DETAIL.UI_TEXT.INSTALL_SEARCH_INPUT_LABEL, 'i'),
    });

    this.combobox = this.dialog.getByRole('combobox').first();
    this.confirmButton = this.dialog.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CONFIRM_BUTTON}$`, 'i'),
    });
    this.cancelButton = this.dialog.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
    });
    this.closeButton = this.dialog.getByRole('button', {
      name: new RegExp(DEVICE_DETAIL.UI_TEXT.CLOSE_MODAL_BUTTON, 'i'),
    });

    this.listbox = this.page.locator('#app-picker-listbox[role="listbox"]').first();
    this.selectAllOption = this.listbox.locator('.app-picker-select-all').first();
    this.appOptions = this.listbox.locator('.app-picker-option:not(.app-picker-select-all)');
    this.loadingText = this.listbox.getByText(/^Loading(?:…|\.{3})?$/i).first();
    this.loadingMoreText = this.listbox.getByText(/^Loading more(?:…|\.{3})?$/i).first();
    this.noAppsFoundText = this.listbox.getByText(
      new RegExp(DEVICE_DETAIL.UI_TEXT.INSTALL_NO_APPS_FOUND, 'i')
    );
  }

  static escapeRegex(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static normalizeText(value = '') {
    return value.replace(/\s+/g, ' ').trim();
  }

  static parseOptionText(rawText = '') {
    const normalizedRawText = InstallAppModal.normalizeText(rawText);
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let name = lines[0] || '';
    const metaLine = lines[1] || '';
    const packageLine = lines.slice(2).join(' ');

    const metaMatch = metaLine.match(/^(.+?)\s+-\s+(.+)$/);
    const resourceId = metaMatch?.[1]?.trim() || '';
    const createdAt = metaMatch?.[2]?.trim() || '';

    const packageMatch = packageLine.match(/^(.+?)\s*·\s*(.+)$/);
    let packageName = packageMatch?.[1]?.trim() || packageLine.trim();
    const versionLabel = packageMatch?.[2]?.trim() || '';
    const version = versionLabel.replace(/^v/i, '').trim();

    if (!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(packageName)) {
      const fallbackPackageMatch = normalizedRawText.match(
        /\b[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+\b/
      );
      if (fallbackPackageMatch) {
        packageName = fallbackPackageMatch[0];

        if (!name || name === normalizedRawText || name.includes(packageName)) {
          name = normalizedRawText
            .slice(0, fallbackPackageMatch.index || 0)
            .replace(/\s*[·-]\s*$/, '')
            .trim();
        }
      }
    }

    return {
      name,
      resourceId,
      createdAt,
      packageName,
      version,
      versionLabel,
      alreadyOnDevice: /already on device/i.test(rawText),
      rawText: normalizedRawText,
    };
  }

  buildRecordKey(record = {}) {
    const packageName = record.packageName || record.name || 'unknown-package';
    const version = record.version || record.versionLabel || 'unknown-version';
    return `${packageName}@${version}`;
  }

  async waitForVisible() {
    await expect(
      this.dialog,
      'Install App modal should be displayed after clicking Install App button.'
    ).toBeVisible({ timeout: this.timeout });

    await expect(
      this.searchInput,
      'Install App search input should be visible in the modal.'
    ).toBeVisible({ timeout: this.timeout });

    await this.ensureListboxVisible();
    return this.dialog;
  }

  async ensureListboxVisible() {
    const visible = await this.listbox.isVisible().catch(() => false);
    if (visible) {
      return this.listbox;
    }

    await expect(
      this.combobox,
      'Install App combobox should be visible before opening the app list.'
    ).toBeVisible({ timeout: this.timeout });

    await this.combobox.click();
    await expect(this.listbox).toBeVisible({ timeout: this.timeout });
    return this.listbox;
  }

  async getSearchValue() {
    await this.waitForVisible();
    return this.searchInput.inputValue();
  }

  async getVisibleAppRecords() {
    await this.ensureListboxVisible();

    const texts = await this.appOptions.allTextContents();

    return texts
      .map((text) => InstallAppModal.parseOptionText(text))
      .filter((record) => record.name || record.packageName);
  }

  async getSelectableAppCount() {
    await this.ensureListboxVisible();
    return this.appOptions.count();
  }

  async getControlState() {
    await this.waitForVisible();

    return {
      searchVisible: await this.searchInput.isVisible().catch(() => false),
      listboxVisible: await this.listbox.isVisible().catch(() => false),
      selectAllVisible: await this.selectAllOption.isVisible().catch(() => false),
      confirmVisible: await this.confirmButton.isVisible().catch(() => false),
      cancelVisible: await this.cancelButton.isVisible().catch(() => false),
      confirmEnabled: await this.confirmButton.isEnabled().catch(() => false),
    };
  }

  async search(keyword = '') {
    await this.waitForVisible();
    await this.ensureListboxVisible();

    await this.searchInput.click();
    await this.searchInput.fill(keyword);
    await expect(this.searchInput).toHaveValue(keyword, {
      timeout: this.timeout,
      message: `Install App search input did not update to "${keyword}".`,
    });

    await this.waitForSearchResultsToSettle();
  }

  async clearSearch() {
    await this.search('');
  }

  getAppOptionByRecord(record = {}) {
    let locator = this.appOptions;

    if (record.resourceId) {
      locator = locator.filter({ hasText: record.resourceId });
    }

    if (record.packageName) {
      locator = locator.filter({ hasText: record.packageName });
    }

    if (record.versionLabel) {
      locator = locator.filter({ hasText: record.versionLabel });
    } else if (record.version) {
      locator = locator.filter({
        hasText: new RegExp(`v?${InstallAppModal.escapeRegex(record.version)}`),
      });
    }

    if (record.name) {
      locator = locator.filter({ hasText: record.name });
    }

    return locator.first();
  }

  getAppOptionByText(appName) {
    return this.appOptions
      .filter({ hasText: new RegExp(InstallAppModal.escapeRegex(appName), 'i') })
      .first();
  }

  async extractRecordFromOption(optionLocator) {
    const rawText = (await optionLocator.textContent().catch(() => '')) || '';
    return InstallAppModal.parseOptionText(rawText);
  }

  async selectAppByRecord(record) {
    await this.ensureListboxVisible();
    const option = this.getAppOptionByRecord(record);

    await expect(
      option,
      `Install App option for "${record.packageName || record.name}" should be visible.`
    ).toBeVisible({ timeout: this.timeout });

    await option.scrollIntoViewIfNeeded().catch(() => {});
    await option.click();

    return this.extractRecordFromOption(option);
  }

  async selectAppByName(appName) {
    await this.ensureListboxVisible();
    const option = this.getAppOptionByText(appName);

    await expect(
      option,
      `Install App option containing "${appName}" should be visible.`
    ).toBeVisible({ timeout: this.timeout });

    await option.scrollIntoViewIfNeeded().catch(() => {});
    await option.click();

    return this.extractRecordFromOption(option);
  }

  async selectFirstInstallApp() {
    await this.ensureListboxVisible();

    await expect(
      this.appOptions.first(),
      'At least one installable app should be visible in the Install App list.'
    ).toBeVisible({ timeout: this.timeout });

    await this.appOptions.first().click();
    return this.extractRecordFromOption(this.appOptions.first());
  }

  async selectAll() {
    await this.ensureListboxVisible();

    await expect(
      this.selectAllOption,
      'Select All option should be visible in the Install App list.'
    ).toBeVisible({ timeout: this.timeout });

    await this.selectAllOption.click();
  }

  async waitForSearchResultsToSettle() {
    let lastSnapshot = '';
    let stablePollCount = 0;
    const settlePollInterval = Math.max(100, Math.round(this.searchDelayMs / 4));

    await expect.poll(
      async () => {
        await this.ensureListboxVisible();

        const loadingVisible = await this.loadingText.isVisible().catch(() => false);
        const loadingMoreVisible = await this.loadingMoreText.isVisible().catch(() => false);
        const noResultsVisible = await this.noAppsFoundText.isVisible().catch(() => false);
        const optionTexts = loadingVisible
          ? []
          : (await this.appOptions.allTextContents().catch(() => []))
              .map((text) => InstallAppModal.normalizeText(text))
              .filter(Boolean);

        const snapshot = JSON.stringify({
          loadingVisible,
          loadingMoreVisible,
          noResultsVisible,
          optionTexts,
        });

        if (snapshot === lastSnapshot) {
          stablePollCount += 1;
        } else {
          lastSnapshot = snapshot;
          stablePollCount = 1;
        }

        return !loadingVisible && !loadingMoreVisible && stablePollCount >= 3
          ? snapshot
          : '__pending__';
      },
      {
        timeout: this.timeout,
        intervals: [settlePollInterval, settlePollInterval, settlePollInterval],
        message: 'Install App search results did not settle in time.',
      }
    ).not.toBe('__pending__');
  }

  async hasNoResults() {
    await this.ensureListboxVisible();
    return this.noAppsFoundText.isVisible().catch(() => false);
  }

  async getNoResultsText() {
    await this.ensureListboxVisible();
    const visible = await this.noAppsFoundText.isVisible().catch(() => false);
    if (!visible) {
      return '';
    }

    return ((await this.noAppsFoundText.textContent().catch(() => '')) || '').trim();
  }

  async isConfirmDisabled() {
    await this.waitForVisible();
    return !(await this.confirmButton.isEnabled());
  }

  async confirm() {
    await this.waitForVisible();
    await expect(
      this.confirmButton,
      'Confirm button should become enabled before submitting Install App.'
    ).toBeEnabled({ timeout: this.timeout });
    await this.confirmButton.click();
  }

  async cancel() {
    await this.waitForVisible();
    await this.cancelButton.click();
    await this.dialog.waitFor({ state: 'hidden', timeout: this.timeout });
  }

  async closeIfVisible() {
    const visible = await this.dialog.isVisible().catch(() => false);
    if (!visible) {
      return;
    }

    if (await this.cancelButton.isVisible().catch(() => false)) {
      await this.cancelButton.click();
    } else if (await this.closeButton.isVisible().catch(() => false)) {
      await this.closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }

    await this.dialog.waitFor({ state: 'hidden', timeout: this.timeout });
  }

  async collectAllUniqueAppRecords() {
    await this.waitForVisible();
    await this.ensureListboxVisible();

    const recordsByKey = new Map();
    let previousScrollTop = -1;

    for (let attempt = 0; attempt < 20; attempt++) {
      const visibleRecords = await this.getVisibleAppRecords();
      for (const record of visibleRecords) {
        recordsByKey.set(this.buildRecordKey(record), record);
      }

      const scrollState = await this.listbox.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));

      const reachedBottom =
        scrollState.scrollTop + scrollState.clientHeight >= scrollState.scrollHeight - 4;

      if (reachedBottom || scrollState.scrollTop === previousScrollTop) {
        break;
      }

      previousScrollTop = scrollState.scrollTop;
      await this.listbox.evaluate((element) => {
        element.scrollTop = Math.min(
          element.scrollTop + element.clientHeight,
          element.scrollHeight
        );
      });
      await this.page.waitForTimeout(300);
    }

    return Array.from(recordsByKey.values());
  }
}

module.exports = InstallAppModal;
