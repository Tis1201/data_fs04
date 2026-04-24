const { expect } = require('@playwright/test');
const { DEVICE_DETAIL } = require('../../../constants/device-detail.constants');

const deviceDetailModals = {
  // ── Push File ──────────────────────────────────────────────────────

  getPushFileRelatedPatterns() {
    return DEVICE_DETAIL?.PATTERNS?.PUSH_FILE_RELATED || [/push file/i, /file push/i, /pushing/i];
  },

  getPushFileUiText(key, fallback) {
    return DEVICE_DETAIL?.UI_TEXT?.[key] || fallback;
  },

  async clickPushFile() {
    await this.clickActionButton(this.pushFileButton, 'Push File');
  },

  getPushFileModal() {
    const dialogCandidates = this.page.locator(DEVICE_DETAIL.SELECTORS.DIALOG);

    const modalTitleRegex = new RegExp(
      this.getPushFileUiText('PUSH_FILE_MODAL_TITLE', 'Push File'),
      'i'
    );

    const searchPlaceholderRegex = new RegExp(
      this.getPushFileUiText('PUSH_FILE_SEARCH_PLACEHOLDER', 'Search files'),
      'i'
    );

    const destinationPlaceholderRegex = new RegExp(
      this.getPushFileUiText('PUSH_FILE_DESTINATION_PLACEHOLDER', 'eg: /home/user/downloads/'),
      'i'
    );

    const modalByTitle = dialogCandidates
      .filter({ has: this.page.getByText(modalTitleRegex) })
      .first();

    const modalBySearchInput = dialogCandidates
      .filter({ has: this.page.getByPlaceholder(searchPlaceholderRegex) })
      .first();

    const modalByDestinationInput = dialogCandidates
      .filter({ has: this.page.getByPlaceholder(destinationPlaceholderRegex) })
      .first();

    return modalByTitle.or(modalBySearchInput).or(modalByDestinationInput).first();
  },

  async waitForPushFileModalVisible() {
    return this.waitForModalVisible(
      () => this.getPushFileModal(),
      'Push File modal'
    );
  },

  getPushFileDestinationInput(modal) {
    return modal.getByPlaceholder(
      new RegExp(
        this.getPushFileUiText('PUSH_FILE_DESTINATION_PLACEHOLDER', 'eg: /home/user/downloads/'),
        'i'
      )
    );
  },

  getPushFileSearchInput(modal) {
    return modal.getByPlaceholder(
      new RegExp(
        this.getPushFileUiText('PUSH_FILE_SEARCH_PLACEHOLDER', 'Search files'),
        'i'
      )
    );
  },

  getPushFileConfirmButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CONFIRM_BUTTON}$`, 'i'),
    });
  },

  getPushFileCancelButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
    });
  },

  getPushFileCloseButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
  },

  getPushFileResourceItems(modal) {
    const selector =
      DEVICE_DETAIL?.SELECTORS?.PUSH_FILE_ITEM ||
      'label, [role="listitem"], [role="radio"], .cursor-pointer';
    return modal.locator(selector);
  },

  async fillPushFileDestinationPath(destinationPath) {
    const modal = await this.waitForPushFileModalVisible();
    const destinationInput = this.getPushFileDestinationInput(modal);

    await expect(
      destinationInput,
      'Push File destination path input should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await destinationInput.fill(destinationPath);
  },

  async searchPushFileResource(keyword) {
    const modal = await this.waitForPushFileModalVisible();
    const searchInput = this.getPushFileSearchInput(modal);

    await expect(
      searchInput,
      'Push File search input should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await searchInput.fill(keyword);
    await this.waitForPushFileResourcesReady();
  },

  async waitForPushFileResourcesReady() {
    const modal = await this.waitForPushFileModalVisible();

    const loadingText = modal.getByText(
      this.getPushFileUiText('PUSH_FILE_LOADING', 'Loading files...'),
      { exact: true }
    );

    const emptyText = modal.getByText(
      this.getPushFileUiText('PUSH_FILE_EMPTY', 'No files found'),
      { exact: true }
    );

    const items = this.getPushFileResourceItems(modal);

    const loadingVisible = await loadingText.isVisible().catch(() => false);
    if (loadingVisible) {
      await loadingText.waitFor({
        state: 'hidden',
        timeout: this.timeouts.pageLoad,
      });
    }

    await expect.poll(
      async () => {
        const count = await items.count().catch(() => 0);
        const emptyVisible = await emptyText.isVisible().catch(() => false);
        return count > 0 || emptyVisible;
      },
      {
        timeout: this.timeouts.pageLoad,
        message: 'Push File resources did not finish loading.',
      }
    ).toBe(true);
  },

  async selectPushFileResourceByName(resourceName) {
    const modal = await this.waitForPushFileModalVisible();

    const item = this.getPushFileResourceItems(modal)
      .filter({ has: this.page.getByText(resourceName, { exact: false }) })
      .first();

    await expect(
      item,
      `Push File resource containing "${resourceName}" should be visible.`
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    const selectedName = ((await item.textContent().catch(() => '')) || '').trim();
    await item.click();

    return selectedName;
  },

  async selectFirstPushFileResource() {
    const modal = await this.waitForPushFileModalVisible();
    const items = this.getPushFileResourceItems(modal);

    await expect(
      items.first(),
      'At least one Push File resource should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    const firstItem = items.first();
    const selectedName = ((await firstItem.textContent().catch(() => '')) || '').trim();
    await firstItem.click();

    return selectedName;
  },

  async cancelPushFileIfVisible() {
    return this.cancelModalIfVisible({
      getModal: () => this.getPushFileModal(),
    });
  },

  async isPushFileConfirmDisabled() {
    return this.isModalConfirmDisabled(
      () => this.waitForPushFileModalVisible(),
      (modal) => this.getPushFileConfirmButton(modal)
    );
  },

  async confirmPushFile() {
    return this.confirmModalAction(
      () => this.waitForPushFileModalVisible(),
      (modal) => this.getPushFileConfirmButton(modal),
      'Push File Confirm button should become enabled after valid input and resource selection.'
    );
  },

  // ── Pull File ──────────────────────────────────────────────────────

  async clickPullFile() {
    await this.clickActionButton(this.pullFileButton, 'Pull File');
  },

  getPullFileModal() {
    const dialogCandidates = this.page.locator(DEVICE_DETAIL.SELECTORS.DIALOG);

    const modalTitleRegex = new RegExp(
      DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_MODAL_TITLE || 'Pull File',
      'i'
    );

    const sourcePlaceholderRegex = new RegExp(
      DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_SOURCE_PLACEHOLDER ||
        'eg: /home/user/documents/file.txt',
      'i'
    );

    const modalByTitle = dialogCandidates
      .filter({ has: this.page.getByText(modalTitleRegex) })
      .first();

    const modalBySourceInput = dialogCandidates
      .filter({ has: this.page.getByPlaceholder(sourcePlaceholderRegex) })
      .first();

    return modalByTitle.or(modalBySourceInput).first();
  },

  async waitForPullFileModalVisible() {
    return this.waitForModalVisible(
      () => this.getPullFileModal(),
      'Pull File modal'
    );
  },

  getPullFileSourceInput(modal) {
    return modal.getByPlaceholder(
      new RegExp(
        DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_SOURCE_PLACEHOLDER ||
          'eg: /home/user/documents/file.txt',
        'i'
      )
    );
  },

  async fillPullFileSourcePath(sourcePath) {
    const modal = await this.waitForPullFileModalVisible();
    const sourceInput = this.getPullFileSourceInput(modal);

    await expect(
      sourceInput,
      'Pull File source path input should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await sourceInput.fill(sourcePath);
  },

  getPullFileConfirmButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(
        `^${DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_CONFIRM_BUTTON || 'Pull File'}$`,
        'i'
      ),
    });
  },

  async isPullFileConfirmDisabled() {
    return this.isModalConfirmDisabled(
      () => this.waitForPullFileModalVisible(),
      (modal) => this.getPullFileConfirmButton(modal)
    );
  },

  async confirmPullFile() {
    return this.confirmModalAction(
      () => this.waitForPullFileModalVisible(),
      (modal) => this.getPullFileConfirmButton(modal),
      'Pull File button should become enabled after entering a valid source file path.'
    );
  },

  async cancelPullFileIfVisible() {
    return this.cancelModalIfVisible({
      getModal: () => this.getPullFileModal(),
    });
  },

  // ── Install App ────────────────────────────────────────────────────

  async clickInstallApp() {
    await expect(
      this.installAppButton,
      'Install App button should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await this.installAppButton.scrollIntoViewIfNeeded().catch(() => {});

    await expect(
      this.installAppButton,
      'Install App button should be enabled before clicking.'
    ).toBeEnabled();

    try {
      await this.installAppButton.click({ timeout: this.timeouts.pageLoad });
    } catch {
      await this.installAppButton.click({ force: true });
    }
  },

  getInstallModal() {
    return this.installAppModal.dialog;
  },

  async waitForInstallModalVisible() {
    return this.installAppModal.waitForVisible();
  },

  getInstallSearchInput(modal) {
    return this.installAppModal.searchInput;
  },

  getInstallConfirmButton(modal) {
    return this.installAppModal.confirmButton;
  },

  getInstallCancelButton(modal) {
    return this.installAppModal.cancelButton;
  },

  getInstallCloseButton(modal) {
    return this.installAppModal.closeButton;
  },

  getInstallCheckboxes(modal) {
    return this.installAppModal.listbox.locator('input[type="checkbox"]');
  },

  async searchInstallApp(keyword) {
    await this.installAppModal.search(keyword);
  },

  async selectInstallAppByName(appName) {
    const record = await this.installAppModal.selectAppByName(appName);
    return record.rawText;
  },

  async selectFirstInstallApp() {
    const record = await this.installAppModal.selectFirstInstallApp();
    return record.rawText;
  },

  async selectAllInstallApps() {
    await this.installAppModal.selectAll();
  },

  async isInstallConfirmDisabled() {
    return this.installAppModal.isConfirmDisabled();
  },

  async confirmInstallApp() {
    await this.installAppModal.confirm();
  },

  async cancelInstallAppIfVisible() {
    await this.installAppModal.closeIfVisible();
  },
};

module.exports = deviceDetailModals;
