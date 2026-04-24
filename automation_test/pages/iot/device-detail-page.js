const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const config = require('../../config/config-loader');
const { DEVICE_DETAIL } = require('../../constants/device-detail.constants');
const InstallAppModal = require('./install-app-modal');

class DeviceDetailPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    const appUrl = options.appUrl || config.appURL;
    const devicePath = options.devicePath || config.pageURL?.devices?.detailPath;
    const deviceId =
      options.deviceId ||
      config.pageURL?.devices?.reboot?.targetDeviceId ||
      config.pageURL?.devices?.terminal?.targetDeviceId ||
      config.pageURL?.devices?.pullFile?.targetDeviceId ||
      config.pageURL?.devices?.pushFile?.targetDeviceId ||
      config.pageURL?.devices?.installApp?.targetDeviceId ||
      config.pageURL?.devices?.snapshotTargetDeviceId;
      

    if (!appUrl) {
      throw new Error('Missing config.appURL');
    }

    if (!devicePath) {
      throw new Error('Missing config.pageURL.devices.detailPath');
    }

    if (!deviceId) {
      throw new Error(
        'DeviceDetailPage requires a deviceId. Please set config.pageURL.devices.pushFile.targetDeviceId, installApp.targetDeviceId, snapshotTargetDeviceId, or pass deviceId via constructor.'
      );
    }

    this.deviceId = deviceId;
    this.url = options.url || `${appUrl}${devicePath}/${deviceId}`;

    this.timeouts = {
      pageLoad: options.timeouts?.pageLoad || config.timeouts?.pageLoadMs || 30000,
      snapshotImage:
        options.timeouts?.snapshotImage || config.timeouts?.snapshotImageMs || 90000,
      activityLog:
        options.timeouts?.activityLog || config.timeouts?.activityLogMs || 90000,
      installFinalStatus:
        options.timeouts?.installFinalStatus ||
        config.pageURL?.devices?.installApp?.finalStatusTimeoutMs ||
        config.timeouts?.installFinalStatusMs ||
        180000,
      rebootFinalStatus:
        options.timeouts?.rebootFinalStatus ||
        config.pageURL?.devices?.reboot?.finalStatusTimeoutMs ||
        config.timeouts?.rebootFinalStatusMs ||
        240000,
    };

    this.installAppModal = new InstallAppModal(page, {
      timeout: this.timeouts.pageLoad,
      searchDelayMs: 800,
    });

    this.maxActivityLogRows =
      options.maxActivityLogRows || DEVICE_DETAIL.DEFAULTS.ACTIVITY_LOG_MAX_ROWS;

    this.snapshotButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.SNAPSHOT_BUTTON}$`, 'i'),
    });

    this.installAppButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.INSTALL_APP_BUTTON}$`, 'i'),
    });

    this.controlButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CONTROL_BUTTON}$`, 'i'),
    });

    this.terminalButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.TERMINAL_BUTTON}$`, 'i'),
    });

    this.rebootButton = this.page.getByRole('button', {
      name: new RegExp(
        `^${DEVICE_DETAIL?.UI_TEXT?.REBOOT_BUTTON || 'Reboot'}$`,
        'i'
      ),
    });

    this.pushFileButton = this.page.getByRole('button', {
      name: new RegExp(
        `^${DEVICE_DETAIL?.UI_TEXT?.PUSH_FILE_BUTTON || 'Push File'}$`,
        'i'
      ),
    });

    this.activityLogsHeading = this.page.getByRole('heading', {
      name: DEVICE_DETAIL.UI_TEXT.ACTIVITY_LOGS_HEADING,
    });

    this.activityLogsLoadingText = this.page.getByText(
      DEVICE_DETAIL.UI_TEXT.ACTIVITY_LOGS_LOADING
    );

    this.activityLogsEmptyText = this.page.getByText(
      DEVICE_DETAIL.UI_TEXT.ACTIVITY_LOGS_EMPTY
    );

    this.connectionStatusRow = this.page
      .locator(DEVICE_DETAIL.SELECTORS.INFO_ROW, {
        has: this.page.getByText(DEVICE_DETAIL.UI_TEXT.CONNECTION_STATUS_LABEL, {
          exact: true,
        }),
      })
      .first();

    this.onlineBadge = this.connectionStatusRow.getByText(
      DEVICE_DETAIL.UI_TEXT.ONLINE_STATUS,
      { exact: true }
    );

    this.activityLogRows = this.page.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_ROW);

    this.screenshotModal = this.page
      .locator(DEVICE_DETAIL.SELECTORS.DIALOG)
      .filter({
        has: this.page.locator(`img[alt="${DEVICE_DETAIL.UI_TEXT.SCREENSHOT_ALT}"]`),
      })
      .first();

    this.screenshotImage = this.screenshotModal.locator(
      `img[alt="${DEVICE_DETAIL.UI_TEXT.SCREENSHOT_ALT}"]`
    );

    this.closeScreenshotButton = this.screenshotModal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
    this.pullFileButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_BUTTON || 'Pull File'}$`, 'i'),
    });

    this.rebootSuccessToast = this.page.getByText(
      new RegExp(
        DEVICE_DETAIL?.UI_TEXT?.REBOOT_SUCCESS_TOAST || 'Reboot command sent to device',
        'i'
      )
    ).first();
  }

  getInProgressStatusPattern() {
    return DEVICE_DETAIL?.PATTERNS?.IN_PROGRESS_STATUS || /in\s*progress|pending|initiated/i;
  }

  getRebootRelatedPatterns() {
    return DEVICE_DETAIL?.PATTERNS?.REBOOT_RELATED || [/reboot/i, /reboot initiated/i];
  }

  getRebootUiText(key, fallback) {
    return DEVICE_DETAIL?.UI_TEXT?.[key] || fallback;
  }

  getPushFileUiText(key, fallback) {
    return DEVICE_DETAIL?.UI_TEXT?.[key] || fallback;
  }

  getFailedStatusPattern() {
    return DEVICE_DETAIL?.PATTERNS?.FAILED_STATUS || /failed|error/i;
  }

  getPushFileRelatedPatterns() {
    return DEVICE_DETAIL?.PATTERNS?.PUSH_FILE_RELATED || [/push file/i, /file push/i, /pushing/i];
  }

  normalizeActivityLogText(text = '') {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  getActivityLogStatusPattern() {
    return /success|failed|error|progress|pending|initiated|queued|cancel/i;
  }

  async goto(query = {}) {
    const targetUrl = new URL(this.url);

    for (const [key, value] of Object.entries(query)) {
      targetUrl.searchParams.set(key, String(value));
    }

    await this.page.goto(targetUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: this.timeouts.pageLoad,
    });

    await this.page.waitForLoadState('networkidle', {
      timeout: Math.min(this.timeouts.pageLoad, 3000),
    }).catch(() => {});
  }

  async openActivityTab() {
    await this.goto({
      [DEVICE_DETAIL.QUERY_PARAMS.TAB]: DEVICE_DETAIL.QUERY_PARAMS.ACTIVITY,
    });
  }

  async waitForPageReady() {
    await expect(
      this.connectionStatusRow,
      'Connection Status row should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect.poll(
      async () => {
        const snapshotVisible = await this.snapshotButton.isVisible().catch(() => false);
        const installVisible = await this.installAppButton.isVisible().catch(() => false);
        const pushFileVisible = await this.pushFileButton.isVisible().catch(() => false);
        const terminalVisible = await this.terminalButton.isVisible().catch(() => false);

        return snapshotVisible || installVisible || pushFileVisible || terminalVisible;
      },
      {
        timeout: this.timeouts.pageLoad,
        message:
          'Expected device action buttons did not become visible on Device detail page.',
      }
    ).toBe(true);
  }

  async verifyDeviceIsOnline() {
    await expect(
      this.onlineBadge,
      'Precondition failed: target device is Offline, device action flow cannot be validated correctly.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });
  }

  async waitForActivityLogsReady() {
    await expect(
      this.activityLogsHeading,
      'Activity Logs section should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    const loadingVisible = await this.activityLogsLoadingText.isVisible().catch(() => false);

    if (loadingVisible) {
      await this.activityLogsLoadingText.waitFor({
        state: 'hidden',
        timeout: this.timeouts.activityLog,
      });
    }

    await expect.poll(
      async () => {
        const rowCount = await this.activityLogRows.count().catch(() => 0);
        const emptyVisible = await this.activityLogsEmptyText.isVisible().catch(() => false);
        return rowCount > 0 || emptyVisible;
      },
      {
        timeout: this.timeouts.activityLog,
        message: 'Activity Logs did not finish rendering rows or empty state.',
      }
    ).toBe(true);
  }

  async triggerSnapshot() {
    await expect(
      this.snapshotButton,
      'Snapshot button should be enabled before clicking.'
    ).toBeEnabled();

    await this.snapshotButton.click();
  }

  async waitForSnapshotImage() {
    await expect(
      this.screenshotImage,
      'Snapshot image was not displayed after triggering Snapshot action.'
    ).toBeVisible({ timeout: this.timeouts.snapshotImage });

    await expect.poll(
      async () =>
        this.screenshotImage.evaluate((img) => {
          return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
        }),
      {
        timeout: this.timeouts.snapshotImage,
        message: 'Snapshot image is visible but did not finish loading properly.',
      }
    ).toBe(true);

    const src = await this.screenshotImage.getAttribute('src');
    expect(src, 'Snapshot image src should not be empty.').toBeTruthy();

    const isValidSrc = DEVICE_DETAIL.PATTERNS.VALID_IMAGE_SRC.some((pattern) =>
      pattern.test(src)
    );

    expect(isValidSrc, 'Snapshot image src should be a valid image source.').toBeTruthy();
  }

  async closeSnapshotModalIfVisible() {
    const modalVisible = await this.screenshotModal.isVisible().catch(() => false);

    if (!modalVisible) {
      return;
    }

    await this.closeScreenshotButton.click();
    await this.screenshotModal.waitFor({
      state: 'hidden',
      timeout: this.timeouts.pageLoad,
    });
  }

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
}

getInstallModal() {
  return this.installAppModal.dialog;
}

async waitForInstallModalVisible() {
  return this.installAppModal.waitForVisible();
}

getInstallSearchInput(modal) {
  return this.installAppModal.searchInput;
}

getInstallConfirmButton(modal) {
  return this.installAppModal.confirmButton;
}

getInstallCancelButton(modal) {
  return this.installAppModal.cancelButton;
}

getInstallCloseButton(modal) {
  return this.installAppModal.closeButton;
}

getInstallCheckboxes(modal) {
  return this.installAppModal.listbox.locator('input[type="checkbox"]');
}

async searchInstallApp(keyword) {
  await this.installAppModal.search(keyword);
}

async selectInstallAppByName(appName) {
  const record = await this.installAppModal.selectAppByName(appName);
  return record.rawText;
}

async selectFirstInstallApp() {
  const record = await this.installAppModal.selectFirstInstallApp();
  return record.rawText;
}

async selectAllInstallApps() {
  await this.installAppModal.selectAll();
}

async isInstallConfirmDisabled() {
  return this.installAppModal.isConfirmDisabled();
}

async confirmInstallApp() {
  await this.installAppModal.confirm();
}

async cancelInstallAppIfVisible() {
  await this.installAppModal.closeIfVisible();
}

async waitForNewInstallInProgressLog(
  previousSignatures = [],
  maxRows = this.maxActivityLogRows
) {
  return this.waitForNewInstallLogByStatus(
    previousSignatures,
    this.getInstallInProgressStatusPattern(),
    'Activity Log did not show a new Install App entry with In Progress status.',
    this.timeouts.activityLog,
    maxRows
  );
}

async waitForNewInstallFinalLog(
  previousSignatures = [],
  maxRows = this.maxActivityLogRows
) {
  return this.waitForNewInstallLogByStatus(
    previousSignatures,
    /success|failed|error/i,
    'Activity Log did not show a new Install App entry with a final status.',
    this.timeouts.activityLog,
    maxRows
  );
}

  async clickPushFile() {
    await expect(
      this.pushFileButton,
      'Push File button should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      this.pushFileButton,
      'Push File button should be enabled before clicking.'
    ).toBeEnabled();

    await this.pushFileButton.click();
  }

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
      .filter({
        has: this.page.getByText(modalTitleRegex),
      })
      .first();

    const modalBySearchInput = dialogCandidates
      .filter({
        has: this.page.getByPlaceholder(searchPlaceholderRegex),
      })
      .first();

    const modalByDestinationInput = dialogCandidates
      .filter({
        has: this.page.getByPlaceholder(destinationPlaceholderRegex),
      })
      .first();

    return modalByTitle.or(modalBySearchInput).or(modalByDestinationInput).first();
  }

  async waitForPushFileModalVisible() {
    return this.waitForModalVisible(
      () => this.getPushFileModal(),
      'Push File modal'
    );
  }

  getPushFileDestinationInput(modal) {
    return modal.getByPlaceholder(
      new RegExp(
        this.getPushFileUiText(
          'PUSH_FILE_DESTINATION_PLACEHOLDER',
          'eg: /home/user/downloads/'
        ),
        'i'
      )
    );
  }

  getPushFileSearchInput(modal) {
    return modal.getByPlaceholder(
      new RegExp(
        this.getPushFileUiText('PUSH_FILE_SEARCH_PLACEHOLDER', 'Search files'),
        'i'
      )
    );
  }

  getPushFileConfirmButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CONFIRM_BUTTON}$`, 'i'),
    });
  }

  getPushFileCancelButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
    });
  }

  getPushFileCloseButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
  }

  getPushFileResourceItems(modal) {
    const selector =
      DEVICE_DETAIL?.SELECTORS?.PUSH_FILE_ITEM ||
      'label, [role="listitem"], [role="radio"], .cursor-pointer';

    return modal.locator(selector);
  }

  async fillPushFileDestinationPath(destinationPath) {
    const modal = await this.waitForPushFileModalVisible();
    const destinationInput = this.getPushFileDestinationInput(modal);

    await expect(
      destinationInput,
      'Push File destination path input should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await destinationInput.fill(destinationPath);
  }

  async searchPushFileResource(keyword) {
    const modal = await this.waitForPushFileModalVisible();
    const searchInput = this.getPushFileSearchInput(modal);

    await expect(
      searchInput,
      'Push File search input should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await searchInput.fill(keyword);
    await this.waitForPushFileResourcesReady();
  }

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
  }

  async selectPushFileResourceByName(resourceName) {
    const modal = await this.waitForPushFileModalVisible();

    const item = this.getPushFileResourceItems(modal)
      .filter({
        has: this.page.getByText(resourceName, { exact: false }),
      })
      .first();

    await expect(
      item,
      `Push File resource containing "${resourceName}" should be visible.`
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    const selectedName = ((await item.textContent().catch(() => '')) || '').trim();
    await item.click();

    return selectedName;
  }

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
  }

  // ── Generic modal helpers ──────────────────────────────────────────

  async cancelModalIfVisible({ getModal, cancelSelector, closeSelector }) {
    const modal = getModal();
    const modalVisible = await modal.isVisible().catch(() => false);
    if (!modalVisible) return;

    const cancelButton = modal.getByRole('button', { name: cancelSelector });
    const closeButton = modal.getByRole('button', { name: closeSelector });

    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
    } else if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }

    await modal.waitFor({ state: 'hidden', timeout: this.timeouts.pageLoad });
  }

  async isModalConfirmDisabled(getModal, getConfirmButton) {
    const modal = await getModal();
    const confirmButton = getConfirmButton(modal);
    return !(await confirmButton.isEnabled());
  }

  async confirmModalAction(getModal, getConfirmButton, enabledMessage) {
    const modal = await getModal();
    const confirmButton = getConfirmButton(modal);
    await expect(confirmButton, enabledMessage).toBeEnabled({ timeout: this.timeouts.pageLoad });
    await confirmButton.click();
  }

  async waitForModalVisible(getModal, errorTitle) {
    const modal = getModal();
    const isVisible = await modal.isVisible({ timeout: this.timeouts.pageLoad }).catch(() => false);
    if (isVisible) return modal;

    const bodyText = ((await this.page.textContent('body').catch(() => '')) || '').trim();
    const dialogCount = await this.page.locator(DEVICE_DETAIL.SELECTORS.DIALOG).count().catch(() => 0);
    throw new Error([
      `${errorTitle} should be displayed.`,
      `Detected dialog count: ${dialogCount}`,
      'Could not match modal by expected patterns.',
      `Body preview: ${bodyText.slice(0, 1000)}`,
    ].join('\n'));
  }

  // ── Push File modal ─────────────────────────────────────────────────

  async cancelPushFileIfVisible() {
    return this.cancelModalIfVisible({
      getModal: () => this.getPushFileModal(),
      cancelSelector: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
      closeSelector: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
  }

  async isPushFileConfirmDisabled() {
    return this.isModalConfirmDisabled(
      () => this.waitForPushFileModalVisible(),
      (modal) => this.getPushFileConfirmButton(modal)
    );
  }

  async confirmPushFile() {
    return this.confirmModalAction(
      () => this.waitForPushFileModalVisible(),
      (modal) => this.getPushFileConfirmButton(modal),
      'Push File Confirm button should become enabled after valid input and resource selection.'
    );
  }

  async openControlFromDeviceDetail() {
    await expect(
      this.controlButton,
      'Control button should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      this.controlButton,
      'Control button should be enabled before clicking.'
    ).toBeEnabled();

    await this.controlButton.click();
  }

  async openTerminalFromDeviceDetail() {
    await this.page.addInitScript(() => {
      if (window.__xtermPlaywrightCaptureInstalled) {
        return;
      }

      window.__xtermPlaywrightCaptureInstalled = true;
      window.__xtermPlaywrightCapture = {
        helperTextarea: null,
        listeners: {},
      };

      const originalAddEventListener = EventTarget.prototype.addEventListener;

      EventTarget.prototype.addEventListener = function patchedAddEventListener(
        type,
        listener,
        options
      ) {
        try {
          if (
            this instanceof HTMLTextAreaElement &&
            this.classList?.contains('xterm-helper-textarea') &&
            listener
          ) {
            const capture =
              window.__xtermPlaywrightCapture ||
              (window.__xtermPlaywrightCapture = {
                helperTextarea: null,
                listeners: {},
              });

            capture.helperTextarea = this;

            const bucket = capture.listeners[type] || (capture.listeners[type] = []);
            bucket.push(listener);
          }
        } catch {}

        return originalAddEventListener.call(this, type, listener, options);
      };
    });

    await expect(
      this.terminalButton,
      'Terminal button should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      this.terminalButton,
      'Terminal button should be enabled before clicking.'
    ).toBeEnabled();

    await this.terminalButton.click();
  }

  async clickReboot() {
    await expect(
      this.rebootButton,
      'Reboot button should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      this.rebootButton,
      'Reboot button should be enabled before clicking.'
    ).toBeEnabled();

    await this.rebootButton.click();
  }

  getRebootModalTitle() {
    return this.page.getByText(
      new RegExp(`^${this.getRebootUiText('REBOOT_MODAL_TITLE', 'Reboot Device')}$`, 'i')
    ).last();
  }

  getRebootModalDescription() {
    return this.page.getByText(
      /reboot this device|restart the device|take a few minutes/i
    ).last();
  }

  getRebootModal() {
    const confirmText = this.getRebootUiText('REBOOT_CONFIRM_BUTTON', 'Reboot');
    const cancelText = DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON;

    return this.getRebootModalTitle().locator(
      `xpath=ancestor::*[
        .//button[normalize-space()="${cancelText}"]
        and .//button[normalize-space()="${confirmText}"]
      ][1]`
    );
  }

  async waitForRebootModalVisible() {
    const title = this.getRebootModalTitle();

    await expect(
      title,
      'Reboot confirmation modal title should be visible after clicking Reboot button.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    const modal = this.getRebootModal();

    await expect(
      modal,
      'Reboot confirmation modal container should be visible after clicking Reboot button.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      this.getRebootModalDescription(),
      'Reboot confirmation modal description should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      modal.getByRole('button', {
        name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
      }),
      'Cancel button should be visible in Reboot confirmation modal.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      modal.getByRole('button', {
        name: new RegExp(
          `^${this.getRebootUiText('REBOOT_CONFIRM_BUTTON', 'Reboot')}$`,
          'i'
        ),
      }),
      'Reboot confirm button should be visible in Reboot confirmation modal.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    return modal;
  }

  async confirmReboot() {
    const modal = await this.waitForRebootModalVisible();
    const confirmButton = modal.getByRole('button', {
      name: new RegExp(
        `^${this.getRebootUiText('REBOOT_CONFIRM_BUTTON', 'Reboot')}$`,
        'i'
      ),
    });

    await expect(
      confirmButton,
      'Reboot confirm button should be enabled before submitting.'
    ).toBeEnabled({ timeout: this.timeouts.pageLoad });

    await confirmButton.click();
  }

  async cancelRebootIfVisible() {
    const title = this.getRebootModalTitle();
    const titleVisible = await title.isVisible().catch(() => false);
    if (!titleVisible) return;

    const modal = this.getRebootModal();
    return this.cancelModalIfVisible({
      getModal: () => modal,
      cancelSelector: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
      closeSelector: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
  }

  async waitForRebootSuccessToast() {
    await expect(
      this.rebootSuccessToast,
      'Expected reboot success toast was not displayed after confirming reboot.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    return ((await this.rebootSuccessToast.textContent().catch(() => '')) || '').trim();
  }

  isRebootRelatedText(text = '') {
    return this.getRebootRelatedPatterns().some((pattern) => pattern.test(text));
  }

  /**
   * Generic activity log scanner.
   * @param {object} opts
   * @param {string[]} opts.previousSignatures
   * @param {RegExp} opts.statusPattern
   * @param {(text: string) => boolean} opts.isRelated - returns true when text belongs to this action type
   * @param {number} [opts.maxRows]
   */
  async findNewActivityLogByStatus({
    previousSignatures = [],
    statusPattern,
    isRelated,
    maxRows = this.maxActivityLogRows,
  }) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);
    const previousSignatureCountMap = this.buildSignatureCountMap(previousSignatures);
    const currentSeenCountMap = new Map();

    for (let i = 0; i < rowCount; i++) {
      const row = this.activityLogRows.nth(i);
      const signature = await this.getActivityLogRowSignature(i);

      const currentSeenCount = (currentSeenCountMap.get(signature) || 0) + 1;
      currentSeenCountMap.set(signature, currentSeenCount);

      const previousSeenCount = previousSignatureCountMap.get(signature) || 0;
      if (currentSeenCount <= previousSeenCount) continue;

      const rowData = await this.extractActivityLogRowData(i);
      const matchesStatus =
        statusPattern.test(rowData.statusText) ||
        statusPattern.test(rowData.rowText) ||
        statusPattern.test(rowData.detailsText);
      const matchesBasic =
        isRelated(rowData.eventName) ||
        isRelated(rowData.descriptionText) ||
        isRelated(rowData.detailsText) ||
        isRelated(rowData.rowText) ||
        isRelated(rowData.combinedText);

      if (matchesBasic && matchesStatus) {
        return {
          index: i,
          signature,
          eventName: rowData.eventName,
          descriptionText: rowData.descriptionText,
          statusText: rowData.statusText,
          detailsText: rowData.detailsText,
          rowText: rowData.rowText,
          combinedText: rowData.combinedText,
        };
      }
    }

    return null;
  }

  async waitForNewActivityLogByStatus({
    previousSignatures = [],
    statusPattern,
    isRelated,
    maxRows = this.maxActivityLogRows,
    timeout = this.timeouts.activityLog,
    message,
  }) {
    let matchedLog = null;

    await expect.poll(
      async () => {
        await this.waitForActivityLogsReady();
        matchedLog = await this.findNewActivityLogByStatus({ previousSignatures, statusPattern, isRelated, maxRows });
        return matchedLog ? 'found' : 'not-found';
      },
      { timeout, message }
    ).toBe('found');

    return matchedLog;
  }

  async findLatestActivityLogByStatus({
    statusPattern,
    isRelated,
    maxRows = this.maxActivityLogRows,
  }) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);

    for (let index = 0; index < rowCount; index += 1) {
      const signature = await this.getActivityLogRowSignature(index);
      const rowData = await this.extractActivityLogRowData(index);
      const matchesStatus =
        statusPattern.test(rowData.statusText) ||
        statusPattern.test(rowData.rowText) ||
        statusPattern.test(rowData.detailsText);
      const matchesBasic =
        isRelated(rowData.eventName) ||
        isRelated(rowData.descriptionText) ||
        isRelated(rowData.detailsText) ||
        isRelated(rowData.rowText) ||
        isRelated(rowData.combinedText);

      if (matchesBasic && matchesStatus) {
        return {
          index,
          signature,
          eventName: rowData.eventName,
          descriptionText: rowData.descriptionText,
          statusText: rowData.statusText,
          detailsText: rowData.detailsText,
          rowText: rowData.rowText,
          combinedText: rowData.combinedText,
        };
      }
    }

    return null;
  }

  async findNewRebootLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewActivityLogByStatus({
      previousSignatures, statusPattern, maxRows,
      isRelated: (text) => this.isRebootRelatedText(text),
    });
  }

  async waitForNewRebootLogByStatus(
    previousSignatures = [],
    statusPattern,
    message,
    timeout = this.timeouts.activityLog,
    maxRows = this.maxActivityLogRows
  ) {
    return this.waitForNewActivityLogByStatus({
      previousSignatures, statusPattern, isRelated: (text) => this.isRebootRelatedText(text),
      maxRows, timeout, message,
    });
  }

  async waitForNewRebootInProgressLog(
    previousSignatures = [],
    maxRows = this.maxActivityLogRows
  ) {
    return this.waitForNewRebootLogByStatus(
      previousSignatures,
      this.getInProgressStatusPattern(),
      'Activity Log did not show a new Reboot entry with In Progress status.',
      this.timeouts.activityLog,
      maxRows
    );
  }

  async waitForNewRebootSuccessLog(
    previousSignatures = [],
    maxRows = this.maxActivityLogRows
  ) {
    return this.waitForNewRebootLogByStatus(
      previousSignatures,
      DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      'Activity Log did not show a new Reboot entry with Success status.',
      this.timeouts.rebootFinalStatus,
      maxRows
    );
  }

  async waitForNewRebootFailedLog(
    previousSignatures = [],
    maxRows = this.maxActivityLogRows
  ) {
    return this.waitForNewRebootLogByStatus(
      previousSignatures,
      this.getFailedStatusPattern(),
      'Activity Log did not show a new Reboot entry with Failed status.',
      this.timeouts.rebootFinalStatus,
      maxRows
    );
  }

  async safeText(locator) {
    const count = await locator.count().catch(() => 0);
    if (count === 0) return '';
    return this.normalizeActivityLogText(
      (await locator.first().textContent().catch(() => '')) || ''
    );
  }

  async extractActivityLogRowData(index, { includeDetails = true } = {}) {
    const row = this.activityLogRows.nth(index);
    const eventName = await this.safeText(row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_EVENT));
    const descriptionText = await this.safeText(
      row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_DESCRIPTION)
    );
    const rowText = this.normalizeActivityLogText(
      (await row.textContent().catch(() => '')) || ''
    );
    const rawStatusText = await this.safeText(
      row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_STATUS)
    );
    const buttonStatusText = this.normalizeActivityLogText(
      (await row.getByRole('button').last().textContent().catch(() => '')) || ''
    );

    let detailsText = '';
    if (includeDetails) {
      const expanded = await this.expandActivityLogRow(index);
      if (expanded) {
        detailsText = this.normalizeActivityLogText(
          (await this.getActivityLogDetailsRow(index).textContent().catch(() => '')) || ''
        );
      }
    }

    const statusText =
      [rawStatusText, buttonStatusText, detailsText, rowText].find((value) =>
        this.getActivityLogStatusPattern().test(value || '')
      ) ||
      rawStatusText ||
      buttonStatusText ||
      rowText;

    const combinedText = this.normalizeActivityLogText(
      [eventName, descriptionText, detailsText, rowText].filter(Boolean).join(' ')
    );

    return {
      eventName,
      descriptionText,
      statusText,
      detailsText,
      rowText,
      combinedText,
    };
  }

  async getActivityLogRowSignature(index) {
    const rowData = await this.extractActivityLogRowData(index, {
      includeDetails: false,
    });

    return rowData.rowText;
  }

  async getActivityLogSignatures(maxRows = this.maxActivityLogRows) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);
    const signatures = [];

    for (let i = 0; i < rowCount; i++) {
      signatures.push(await this.getActivityLogRowSignature(i));
    }

    return signatures;
  }

  buildSignatureCountMap(signatures = []) {
    const map = new Map();

    for (const signature of signatures) {
      map.set(signature, (map.get(signature) || 0) + 1);
    }

    return map;
  }

  async getActivityLogSignatureCountMap(maxRows = this.maxActivityLogRows) {
    const signatures = await this.getActivityLogSignatures(maxRows);
    return this.buildSignatureCountMap(signatures);
  }

  getActivityLogDetailsRow(index) {
    return this.activityLogRows
      .nth(index)
      .locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_DETAILS_ROW_XPATH);
  }

    async expandActivityLogRow(index) {
    const row = this.activityLogRows.nth(index);
    const expandButton = row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_EXPAND_BUTTON);

    const isVisible = await expandButton.isVisible().catch(() => false);
    const isEnabled = await expandButton.isEnabled().catch(() => false);

    if (!isVisible || !isEnabled) {
      return false;
    }

    const detailsRow = this.getActivityLogDetailsRow(index);
    const detailsVisible = await detailsRow.isVisible().catch(() => false);

    if (detailsVisible) {
      return true;
    }

    try {
      await expandButton.click();
      await detailsRow.waitFor({
        state: 'visible',
        timeout: 3000,
      });
      return true;
    } catch {
      return false;
    }
  }

  isSnapshotRelatedText(text = '') {
    return DEVICE_DETAIL.PATTERNS.SNAPSHOT_RELATED.some((pattern) => pattern.test(text));
  }

  isInstallRelatedText(text = '') {
    return [
      /install app/i,
      /install new app/i,
      /installation of/i,
      /installing /i,
      /\binstall(?:ation|ing|ed)?\b/i,
      /download failed/i,
      /succeeded/i,
    ].some((pattern) => pattern.test(text));
  }

  isControlRelatedText(text = '') {
    return DEVICE_DETAIL.PATTERNS.CONTROL_RELATED.some((pattern) => pattern.test(text));
  }

  isPushFileRelatedText(text = '') {
    return this.getPushFileRelatedPatterns().some((pattern) => pattern.test(text));
  }

  async findNewSnapshotSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.findNewActivityLogByStatus({
      previousSignatures, maxRows,
      statusPattern: DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      isRelated: (text) => this.isSnapshotRelatedText(text),
    });
  }

  async waitForNewSnapshotSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewActivityLogByStatus({
      previousSignatures, maxRows,
      statusPattern: DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      isRelated: (text) => this.isSnapshotRelatedText(text),
      timeout: this.timeouts.activityLog,
      message: 'Activity Log did not show a new Snapshot-related entry with Success status.',
    });
  }

getInstallFinalStatusPattern() {
  return /success|failed|error/i;
}

async findNewInstallLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
  return this.findNewActivityLogByStatus({
    previousSignatures, statusPattern, maxRows,
    isRelated: (text) => this.isInstallRelatedText(text),
  });
}

async waitForNewInstallLogByStatus(
  previousSignatures = [],
  statusPattern,
  message,
  timeout = this.timeouts.installFinalStatus,
  maxRows = this.maxActivityLogRows
) {
  return this.waitForNewActivityLogByStatus({
    previousSignatures, statusPattern, isRelated: (text) => this.isInstallRelatedText(text),
    maxRows, timeout, message,
  });
}

async waitForNewInstallSuccessLog(
  previousSignatures = [],
  maxRows = this.maxActivityLogRows
) {
  return this.waitForNewInstallLogByStatus(
    previousSignatures,
    DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
    'Activity Log did not show a new Install App entry with Success status.',
    this.timeouts.installFinalStatus,
    maxRows
  );
}

async waitForNewInstallFailedLog(
  previousSignatures = [],
  maxRows = this.maxActivityLogRows
) {
  return this.waitForNewInstallLogByStatus(
    previousSignatures,
    this.getFailedStatusPattern(),
    'Activity Log did not show a new Install App entry with Failed status.',
    this.timeouts.installFinalStatus,
    maxRows
  );
}

async waitForNewInstallFinalLog(
  previousSignatures = [],
  maxRows = this.maxActivityLogRows
) {
  return this.waitForNewInstallLogByStatus(
    previousSignatures,
    this.getInstallFinalStatusPattern(),
    'Activity Log did not show a new Install App entry with a final status.',
    this.timeouts.installFinalStatus,
    maxRows
  );
}

  async findNewControlLog(previousSignatures = [], { statusPattern = null, maxRows = this.maxActivityLogRows } = {}) {
    return this.findNewActivityLogByStatus({
      previousSignatures,
      statusPattern: statusPattern || /.*/,
      maxRows,
      isRelated: (text) => this.isControlRelatedText(text),
    });
  }

  async waitForNewControlSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewActivityLogByStatus({
      previousSignatures, maxRows,
      statusPattern: DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      isRelated: (text) => this.isControlRelatedText(text),
      timeout: this.timeouts.activityLog,
      message: 'Activity Log did not show a new Control entry with Success status.',
    });
  }

  async waitForNewControlFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewActivityLogByStatus({
      previousSignatures, maxRows,
      statusPattern: this.getFailedStatusPattern(),
      isRelated: (text) => this.isControlRelatedText(text),
      timeout: this.timeouts.activityLog,
      message: 'Activity Log did not show a new Control entry with Failed status.',
    });
  }

async findNewPushFileLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
  return this.findNewActivityLogByStatus({
    previousSignatures, statusPattern, maxRows,
    isRelated: (text) => this.isPushFileRelatedText(text),
  });
}

  async findLatestPushFileLogByRowText(
    statusPattern,
    maxRows = this.maxActivityLogRows
  ) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);

    for (let index = 0; index < rowCount; index += 1) {
      const rowData = await this.extractActivityLogRowData(index, {
        includeDetails: false,
      });
      const normalizedRowText = this.normalizeActivityLogText(rowData.rowText);
      const matchesStatus =
        statusPattern.test(rowData.statusText) || statusPattern.test(normalizedRowText);
      const matchesPushRow =
        this.isPushFileRelatedText(normalizedRowText) ||
        /\bfile\b.*\bpushed\b/i.test(normalizedRowText) ||
        /pushed successfully to/i.test(normalizedRowText);

      if (matchesStatus && matchesPushRow) {
        return {
          index,
          signature: rowData.rowText,
          eventName: rowData.eventName,
          descriptionText: rowData.descriptionText,
          statusText: rowData.statusText,
          detailsText: rowData.detailsText,
          rowText: rowData.rowText,
          combinedText: rowData.combinedText,
        };
      }
    }

    return null;
  }

  async waitForNewPushFileLogByStatus(previousSignatures = [], statusPattern, message, maxRows = this.maxActivityLogRows) {
    let matchedLog = null;
    const previousTopSignature = previousSignatures[0] || '';

    await expect.poll(
      async () => {
        await this.waitForActivityLogsReady();

        matchedLog = await this.findNewActivityLogByStatus({
          previousSignatures,
          statusPattern,
          isRelated: (text) => this.isPushFileRelatedText(text),
          maxRows,
        });

        if (matchedLog) {
          return 'found';
        }

        const latestMatchedLog = await this.findLatestActivityLogByStatus({
          statusPattern,
          isRelated: (text) => this.isPushFileRelatedText(text),
          maxRows,
        });

        if (
          latestMatchedLog &&
          latestMatchedLog.signature &&
          latestMatchedLog.signature !== previousTopSignature
        ) {
          matchedLog = latestMatchedLog;
          return 'found';
        }

        const latestRowTextMatch = await this.findLatestPushFileLogByRowText(
          statusPattern,
          maxRows
        );

        if (
          latestRowTextMatch &&
          latestRowTextMatch.signature &&
          latestRowTextMatch.signature !== previousTopSignature
        ) {
          matchedLog = latestRowTextMatch;
          return 'found';
        }

        return 'not-found';
      },
      {
        timeout: this.timeouts.activityLog,
        message,
      }
    ).toBe('found');

    return matchedLog;
  }

  async waitForNewPushFileSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPushFileLogByStatus(
      previousSignatures, DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      'Activity Log did not show a new Push File entry with Success status.', maxRows
    );
  }

  async waitForNewPushFileFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPushFileLogByStatus(
      previousSignatures, this.getFailedStatusPattern(),
      'Activity Log did not show a new Push File entry with Failed status.', maxRows
    );
  }

  async clickPullFile() {
    await expect(
      this.pullFileButton,
      'Pull File button should be visible on the Device detail page.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await expect(
      this.pullFileButton,
      'Pull File button should be enabled before clicking.'
    ).toBeEnabled();

    await this.pullFileButton.click();
  }

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
      .filter({
        has: this.page.getByText(modalTitleRegex),
      })
      .first();

    const modalBySourceInput = dialogCandidates
      .filter({
        has: this.page.getByPlaceholder(sourcePlaceholderRegex),
      })
      .first();

    return modalByTitle.or(modalBySourceInput).first();
  }

  async waitForPullFileModalVisible() {
    return this.waitForModalVisible(
      () => this.getPullFileModal(),
      'Pull File modal'
    );
  }

  getPullFileSourceInput(modal) {
    return modal.getByPlaceholder(
      new RegExp(
        DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_SOURCE_PLACEHOLDER ||
          'eg: /home/user/documents/file.txt',
        'i'
      )
    );
  }

  async fillPullFileSourcePath(sourcePath) {
    const modal = await this.waitForPullFileModalVisible();
    const sourceInput = this.getPullFileSourceInput(modal);

    await expect(
      sourceInput,
      'Pull File source path input should be visible.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    await sourceInput.fill(sourcePath);
  }

  getPullFileConfirmButton(modal) {
    return modal.getByRole('button', {
      name: new RegExp(
        `^${DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_CONFIRM_BUTTON || 'Pull File'}$`,
        'i'
      ),
    });
  }

  async isPullFileConfirmDisabled() {
    return this.isModalConfirmDisabled(
      () => this.waitForPullFileModalVisible(),
      (modal) => this.getPullFileConfirmButton(modal)
    );
  }

  async confirmPullFile() {
    return this.confirmModalAction(
      () => this.waitForPullFileModalVisible(),
      (modal) => this.getPullFileConfirmButton(modal),
      'Pull File button should become enabled after entering a valid source file path.'
    );
  }

  async cancelPullFileIfVisible() {
    return this.cancelModalIfVisible({
      getModal: () => this.getPullFileModal(),
      cancelSelector: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i'),
      closeSelector: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
  }

  isPullFileRelatedText(text = '') {
    return (
      DEVICE_DETAIL?.PATTERNS?.PULL_FILE_RELATED || [
        /pull file/i,
        /pulled file/i,
        /file pulled/i,
        /\bpull(?:ed|ing)?\b/i,
        /\bfile\b.*\bpull(?:ed|ing)?\b/i,
      ]
    )
      .some((pattern) => pattern.test(text));
  }

  async findNewPullFileLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewActivityLogByStatus({
      previousSignatures, statusPattern, maxRows,
      isRelated: (text) => this.isPullFileRelatedText(text),
    });
  }

  async waitForNewPullFileLogByStatus(previousSignatures = [], statusPattern, message, maxRows = this.maxActivityLogRows) {
    let matchedLog = null;
    const previousTopSignature = previousSignatures[0] || '';

    await expect.poll(
      async () => {
        await this.waitForActivityLogsReady();

        matchedLog = await this.findNewActivityLogByStatus({
          previousSignatures,
          statusPattern,
          isRelated: (text) => this.isPullFileRelatedText(text),
          maxRows,
        });

        if (matchedLog) {
          return 'found';
        }

        const latestMatchedLog = await this.findLatestActivityLogByStatus({
          statusPattern,
          isRelated: (text) => this.isPullFileRelatedText(text),
          maxRows,
        });

        if (
          latestMatchedLog &&
          latestMatchedLog.signature &&
          latestMatchedLog.signature !== previousTopSignature
        ) {
          matchedLog = latestMatchedLog;
          return 'found';
        }

        return 'not-found';
      },
      {
        timeout: this.timeouts.activityLog,
        message,
      }
    ).toBe('found');

    return matchedLog;
  }

  async waitForNewPullFileSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPullFileLogByStatus(
      previousSignatures, DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      'Activity Log did not show a new Pull File entry with Success status.', maxRows
    );
  }

  async waitForNewPullFileFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPullFileLogByStatus(
      previousSignatures, DEVICE_DETAIL.PATTERNS.FAILED_STATUS,
      'Activity Log did not show a new Pull File entry with Failed status.', maxRows
    );
  }
}

module.exports = DeviceDetailPage;
