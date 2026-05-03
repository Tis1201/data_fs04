const { expect } = require('@playwright/test');
const BasePage = require('../../base-page');
const config = require('../../../config/config-loader');
const { DEVICE_DETAIL } = require('../../../constants/device-detail.constants');
const InstallAppModal = require('../../iot/install-app-modal');

class DeviceDetailBase extends BasePage {
  constructor(page, optionsOrDeviceId = {}) {
    super(page);

    // Support both (page, deviceId) and (page, options) signatures
    const options = typeof optionsOrDeviceId === 'string'
      ? { deviceId: optionsOrDeviceId }
      : optionsOrDeviceId;

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

    if (!deviceId) {
      throw new Error(
        'DeviceDetailPage requires a deviceId. Pass it via constructor or set in config.'
      );
    }

    // Build URL — prefer devices.url (full URL), fallback to appURL + detailPath
    const devicesUrl = config.pageURL?.devices?.url || config.pageURL?.devices?.listUrl;
    this.baseDeviceUrl = devicesUrl || (appUrl && devicePath ? `${appUrl}${devicePath}` : '');
    this.url = options.url || `${this.baseDeviceUrl}/${deviceId}`;
    this.terminalUrl = `${this.url}/terminal`;

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

    // ── Page Banner ──────────────────────────────────────────────────
    this.pageBanner = this.page.locator('h1, h2').filter({ hasText: 'Devices' });

    // ── Edit Device ──────────────────────────────────────────────────
    this.editDeviceButton = this.page.getByRole('button', { name: /Edit Device/i });

    // ── Tabs ─────────────────────────────────────────────────────────
    this.tabDetails = this.page.getByRole('button', { name: 'Details', exact: true }).or(this.page.getByRole('tab', { name: 'Details' }));
    this.tabConfiguration = this.page.getByRole('button', { name: 'Configuration', exact: true }).or(this.page.getByRole('tab', { name: 'Configuration' }));
    this.tabInstalledApps = this.page.getByRole('button', { name: 'Installed Apps', exact: true }).or(this.page.getByRole('tab', { name: 'Installed Apps' }));
    this.tabDeployments = this.page.getByRole('button', { name: 'Deployments', exact: true }).or(this.page.getByRole('tab', { name: 'Deployments' }));
    this.tabActivityLogs = this.page.getByRole('button', { name: 'Activity Logs', exact: true }).or(this.page.getByRole('tab', { name: 'Activity Logs' }));

    // ── Section Headings ─────────────────────────────────────────────
    this.headingDeviceHealth = this.page.locator('h3').filter({ hasText: /Device Health/i }).first();
    this.headingGeneral = this.page.locator('h3').filter({ hasText: /General/i }).first();
    this.headingDeviceInfo = this.page.locator('h4').filter({ hasText: /Device Information/i }).first();
    this.headingTechnicalDetails = this.page.locator('h4').filter({ hasText: /Technical Details/i }).first();
    this.headingNetworkInfo = this.page.locator('h4').filter({ hasText: /Network Information/i }).first();
    this.headingSecurity = this.page.locator('h4').filter({ hasText: /Security/i }).first();

    // ── Buttons ──────────────────────────────────────────────────────
    this.refreshButton = this.page.getByRole('button', { name: /Refresh/i }).first();
    this.copyApiKeyButton = this.page.getByRole('button', { name: /Copy API Key/i });
    this.generateNewKeyButton = this.page.getByRole('button', { name: /Generate New Key/i });

    // ── Quick Action Buttons ─────────────────────────────────────────
    this.quickActionButtons = {
      'Install App': this.page.getByRole('button', { name: 'Install App', exact: true }).first(),
      'Snapshot': this.page.getByRole('button', { name: 'Snapshot', exact: true }).first(),
      'Control': this.page.getByRole('button', { name: 'Control', exact: true }).first(),
      'Terminal': this.page.getByRole('button', { name: 'Terminal', exact: true }).first(),
      'Push File': this.page.getByRole('button', { name: 'Push File', exact: true }).first(),
      'Pull File': this.page.getByRole('button', { name: 'Pull File', exact: true }).first(),
      'Update': this.page.getByRole('button', { name: 'Update', exact: true }).first(),
      'Reboot': this.page.getByRole('button', { name: 'Reboot', exact: true }).first(),
    };

    // ── Modal ────────────────────────────────────────────────────────
    this.modal = this.page.locator('[role="dialog"], .modal, [class*="modal"], [class*="dialog"]').first();

    // ── Profile Link ─────────────────────────────────────────────────
    this.profileLink = this.page.locator('a').filter({ hasText: /Config/i }).first();

    // ── Terminal ─────────────────────────────────────────────────────
    this.xtermContainer = this.page.locator('.xterm');
    this.xtermTextarea = this.page.locator('.xterm-helper-textarea');
    this.xtermRows = this.page.locator('.xterm-rows');

    // ── Action buttons (regex pattern — used by actions/modals sessions) ──
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
      name: new RegExp(`^${DEVICE_DETAIL?.UI_TEXT?.REBOOT_BUTTON || 'Reboot'}$`, 'i'),
    });
    this.pushFileButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL?.UI_TEXT?.PUSH_FILE_BUTTON || 'Push File'}$`, 'i'),
    });
    this.pullFileButton = this.page.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL?.UI_TEXT?.PULL_FILE_BUTTON || 'Pull File'}$`, 'i'),
    });

    // ── Info section ─────────────────────────────────────────────────
    this.activityLogsHeading = this.page.getByRole('heading', {
      name: DEVICE_DETAIL.UI_TEXT.ACTIVITY_LOGS_HEADING,
    });
    this.activityLogsLoadingText = this.page.getByText(DEVICE_DETAIL.UI_TEXT.ACTIVITY_LOGS_LOADING);
    this.activityLogsEmptyText = this.page.getByText(DEVICE_DETAIL.UI_TEXT.ACTIVITY_LOGS_EMPTY);
    this.connectionStatusRow = this.page
      .locator(DEVICE_DETAIL.SELECTORS.INFO_ROW, {
        has: this.page.getByText(DEVICE_DETAIL.UI_TEXT.CONNECTION_STATUS_LABEL, { exact: true }),
      })
      .first();
    this.onlineBadge = this.connectionStatusRow.getByText(DEVICE_DETAIL.UI_TEXT.ONLINE_STATUS, { exact: true });
    this.activityLogRows = this.page.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_ROW);

    // ── Screenshot modal ─────────────────────────────────────────────
    this.screenshotModal = this.page
      .locator(DEVICE_DETAIL.SELECTORS.DIALOG)
      .filter({ has: this.page.locator(`img[alt="${DEVICE_DETAIL.UI_TEXT.SCREENSHOT_ALT}"]`) })
      .first();
    this.screenshotImage = this.screenshotModal.locator(`img[alt="${DEVICE_DETAIL.UI_TEXT.SCREENSHOT_ALT}"]`);
    this.closeScreenshotButton = this.screenshotModal.getByRole('button', {
      name: new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i'),
    });
    this.rebootSuccessToast = this.page.getByText(
      new RegExp(DEVICE_DETAIL?.UI_TEXT?.REBOOT_SUCCESS_TOAST || 'Reboot command sent to device', 'i')
    ).first();
  }

  // ── Pattern helpers ──────────────────────────────────────────────────

  getInProgressStatusPattern() {
    return DEVICE_DETAIL?.PATTERNS?.IN_PROGRESS_STATUS || /in\s*progress|pending|initiated/i;
  }
  getFailedStatusPattern() {
    return DEVICE_DETAIL?.PATTERNS?.FAILED_STATUS || /failed|error/i;
  }
  normalizeActivityLogText(text = '') {
    return String(text).replace(/\s+/g, ' ').trim();
  }
  getActivityLogStatusPattern() {
    return /success|failed|error|progress|pending|initiated|queued|cancel/i;
  }

  // ── Navigation ───────────────────────────────────────────────────────

  async gotoDeviceDetail() {
    await this.page.goto(this.url);
    await this.page.waitForLoadState('domcontentloaded');
    await this.pageBanner.waitFor({ state: 'visible', timeout: 15000 });
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

  // ── Page state ───────────────────────────────────────────────────────

  async waitForPageReady() {
    // Connection Status row can vary by device type / UI version; don't hard-fail on it.
    const connectionStatusVisible = await this.connectionStatusRow.isVisible().catch(() => false);
    if (connectionStatusVisible) {
      await expect(this.connectionStatusRow).toBeVisible({ timeout: this.timeouts.pageLoad });
    }

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
        message: 'Expected device action buttons did not become visible on Device detail page.',
      }
    ).toBe(true);
  }

  async verifyDeviceIsOnline() {
    const onlineVisible =
      (await this.onlineBadge.isVisible().catch(() => false)) ||
      (await this.page.getByText(new RegExp(`^${DEVICE_DETAIL.UI_TEXT.ONLINE_STATUS}$`, 'i')).first().isVisible().catch(() => false)) ||
      (await this.page.getByText(/online/i).first().isVisible().catch(() => false));

    if (!onlineVisible) {
      throw new Error('Precondition failed: target device is Offline.');
    }
  }

  async waitForActivityLogsReady() {
    await expect(this.activityLogsHeading, 'Activity Logs section should be visible.')
      .toBeVisible({ timeout: this.timeouts.pageLoad });
    const loadingVisible = await this.activityLogsLoadingText.isVisible().catch(() => false);
    if (loadingVisible) {
      await this.activityLogsLoadingText.waitFor({ state: 'hidden', timeout: this.timeouts.activityLog });
    }
    await expect.poll(
      async () => {
        const rowCount = await this.activityLogRows.count().catch(() => 0);
        const emptyVisible = await this.activityLogsEmptyText.isVisible().catch(() => false);
        return rowCount > 0 || emptyVisible;
      },
      { timeout: this.timeouts.activityLog, message: 'Activity Logs did not finish rendering.' }
    ).toBe(true);
  }

  // ── Generic modal helpers ────────────────────────────────────────────

  async clickActionButton(button, buttonName) {
    await expect(button, `${buttonName} button should be visible on the Device detail page.`)
      .toBeVisible({ timeout: this.timeouts.pageLoad });
    await expect(button, `${buttonName} button should be enabled before clicking.`)
      .toBeEnabled();
    await button.click();
  }

  async cancelModalIfVisible({ getModal, cancelSelector, closeSelector } = {}) {
    const defaultCancel = new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON}$`, 'i');
    const defaultClose = new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CLOSE_BUTTON}$`, 'i');
    const modal = getModal();
    const modalVisible = await modal.isVisible().catch(() => false);
    if (!modalVisible) return;
    const cancelButton = modal.getByRole('button', { name: cancelSelector || defaultCancel });
    const closeButton = modal.getByRole('button', { name: closeSelector || defaultClose });
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
}

module.exports = DeviceDetailBase;
