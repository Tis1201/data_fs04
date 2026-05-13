const { expect } = require('@playwright/test');
const { DEVICE_DETAIL } = require('../../../constants/device-detail.constants');

const deviceDetailActions = {
  // ── Snapshot ────────────────────────────────────────────────────────

  async triggerSnapshot() {
    await expect(
      this.snapshotButton,
      'Snapshot button should be enabled before clicking.'
    ).toBeEnabled();

    await this.snapshotButton.click();
  },

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
  },

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
  },

  // ── Reboot ─────────────────────────────────────────────────────────

  getRebootRelatedPatterns() {
    return DEVICE_DETAIL?.PATTERNS?.REBOOT_RELATED || [/reboot/i, /reboot initiated/i];
  },

  getRebootUiText(key, fallback) {
    return DEVICE_DETAIL?.UI_TEXT?.[key] || fallback;
  },

  async clickReboot() {
    await this.clickActionButton(this.rebootButton, 'Reboot');
  },

  getRebootModalTitle() {
    return this.page.getByText(
      new RegExp(`^${this.getRebootUiText('REBOOT_MODAL_TITLE', 'Reboot Device')}$`, 'i')
    ).last();
  },

  getRebootModalDescription() {
    return this.page.getByText(
      /reboot this device|restart the device|take a few minutes/i
    ).last();
  },

  getRebootModal() {
    const confirmText = this.getRebootUiText('REBOOT_CONFIRM_BUTTON', 'Reboot');
    const cancelText = DEVICE_DETAIL.UI_TEXT.CANCEL_BUTTON;

    return this.getRebootModalTitle().locator(
      `xpath=ancestor::*[
        .//button[normalize-space()="${cancelText}"]
        and .//button[normalize-space()="${confirmText}"]
      ][1]`
    );
  },

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
  },

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
  },

  async cancelRebootIfVisible() {
    const title = this.getRebootModalTitle();
    const titleVisible = await title.isVisible().catch(() => false);
    if (!titleVisible) return;

    return this.cancelModalIfVisible({
      getModal: () => this.getRebootModal(),
    });
  },

  async waitForRebootSuccessToast() {
    await expect(
      this.rebootSuccessToast,
      'Expected reboot success toast was not displayed after confirming reboot.'
    ).toBeVisible({ timeout: this.timeouts.pageLoad });

    return ((await this.rebootSuccessToast.textContent().catch(() => '')) || '').trim();
  },

  // ── Control ────────────────────────────────────────────────────────

  async openControlFromDeviceDetail() {
    await this.clickActionButton(this.controlButton, 'Control');
  },

  // ── Terminal ───────────────────────────────────────────────────────

  async openDetailsTab() {
    await this.tabDetails.click();
    await expect(this.refreshButton).toBeVisible({ timeout: this.timeouts.pageLoad });
  },

  async clickRefreshDeviceDetails() {
    await this.openDetailsTab();
    await expect(this.refreshButton).toBeVisible({ timeout: this.timeouts.pageLoad });
    await this.refreshButton.click();
  },

  async waitForGenericSuccessToast(pattern = /success|refreshed|updated|completed|sent/i) {
    await expect(this.page.getByText(pattern).first()).toBeVisible({ timeout: 25000 });
  },

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
  },
};

module.exports = deviceDetailActions;
