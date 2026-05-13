const { expect } = require('@playwright/test');
const BasePage = require('../base-page');
const config = require('../../config/config-loader');
const { DEVICE_DETAIL } = require('../../constants/device-detail.constants');

class DeviceControlPage extends BasePage {
  constructor(page, options = {}) {
    super(page);

    this.timeouts = {
      pageLoad: options.timeouts?.pageLoad || config.timeouts?.pageLoadMs || 30000,
      controlReady: options.timeouts?.controlReady || config.timeouts?.controlReadyMs || 45000,
    };

    this.pageHeading = this.page.getByRole('heading', {
      name: new RegExp(DEVICE_DETAIL.UI_TEXT.CONTROL_PAGE_TITLE, 'i'),
    }).first();

    this.connectionCardTitle = this.page.getByText(
      new RegExp(DEVICE_DETAIL.UI_TEXT.CONTROL_CARD_TITLE, 'i')
    ).first();

    this.connectionStateText = this.page.getByText(
      new RegExp(`${DEVICE_DETAIL.UI_TEXT.CONTROL_CONNECTION_STATE_LABEL}\\s*:`, 'i')
    ).first();

    this.connectingOverlayText = this.page.getByText(
      new RegExp(DEVICE_DETAIL.UI_TEXT.CONTROL_CONNECTING_TEXT, 'i')
    ).first();

    this.notConnectedOverlayText = this.page.getByText(
      new RegExp(DEVICE_DETAIL.UI_TEXT.CONTROL_NOT_CONNECTED_TEXT, 'i')
    ).first();

    this.topConnectingStatus = this.page.getByText(
      new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CONNECTING_STATUS}$`, 'i')
    ).first();

    this.topConnectedStatus = this.page.getByText(
      new RegExp(`^${DEVICE_DETAIL.UI_TEXT.CONNECTED_STATUS}$`, 'i')
    ).first();

    this.topDisconnectedStatus = this.page.getByText(
      new RegExp(`^${DEVICE_DETAIL.UI_TEXT.DISCONNECTED_STATUS}$`, 'i')
    ).first();

    this.timeoutToast = this.page.getByText(
      new RegExp(DEVICE_DETAIL.UI_TEXT.CONTROL_TIMEOUT_TEXT, 'i')
    ).first();

    this.remoteMedia = this.page.locator(DEVICE_DETAIL.SELECTORS.CONTROL_MEDIA).first();
  }

  async waitForControlPageReady() {
    await expect(this.page).toHaveURL(/\/rdp(?:\?.*)?$/, {
      timeout: this.timeouts.pageLoad,
    });

    await expect.poll(
      async () => {
        const headingVisible = await this.pageHeading.isVisible().catch(() => false);
        const cardVisible = await this.connectionCardTitle.isVisible().catch(() => false);
        const stateVisible = await this.connectionStateText.isVisible().catch(() => false);

        return headingVisible || cardVisible || stateVisible;
      },
      {
        timeout: this.timeouts.pageLoad,
        message: 'Remote Desktop page did not render expected UI.',
      }
    ).toBe(true);
  }

  async waitForLoadingState() {
    await expect.poll(
      async () => {
        const overlayVisible = await this.connectingOverlayText.isVisible().catch(() => false);
        const topConnectingVisible = await this.topConnectingStatus.isVisible().catch(() => false);
        const bodyText = ((await this.page.textContent('body').catch(() => '')) || '').trim();

        return (
          overlayVisible ||
          topConnectingVisible ||
          DEVICE_DETAIL.PATTERNS.CONTROL_LOADING.some((pattern) => pattern.test(bodyText))
        );
      },
      {
        timeout: 15000,
        message: 'Control page did not show loading state.',
      }
    ).toBe(true);
  }

  async getControlStateSnapshot() {
    const bodyText = ((await this.page.textContent('body').catch(() => '')) || '').trim();

    const connectionStateMatch = bodyText.match(/Connection State:\s*([^\n\r]+)/i);
    const connectionState = connectionStateMatch
      ? connectionStateMatch[1].trim().toLowerCase()
      : '';

    const mediaVisible = await this.remoteMedia.isVisible().catch(() => false);
    const topConnectedVisible = await this.topConnectedStatus.isVisible().catch(() => false);
    const topDisconnectedVisible = await this.topDisconnectedStatus.isVisible().catch(() => false);
    const notConnectedVisible = await this.notConnectedOverlayText.isVisible().catch(() => false);
    const timeoutVisible = await this.timeoutToast.isVisible().catch(() => false);

    const isConnecting =
      DEVICE_DETAIL.PATTERNS.CONTROL_LOADING.some((pattern) => pattern.test(bodyText));

    const isConnected =
      connectionState === 'connected' || topConnectedVisible || mediaVisible;

    const isDisconnected =
      connectionState === 'disconnected' ||
      topDisconnectedVisible ||
      notConnectedVisible;

    const isTimedOut =
      timeoutVisible ||
      DEVICE_DETAIL.PATTERNS.CONTROL_TIMEOUT.some((pattern) => pattern.test(bodyText));

    return {
      bodyText,
      connectionState,
      mediaVisible,
      isConnecting,
      isConnected,
      isDisconnected,
      isTimedOut,
    };
  }

  async waitForConnected() {
    let snapshot = null;

    await expect.poll(
      async () => {
        snapshot = await this.getControlStateSnapshot();

        if (snapshot.isTimedOut || snapshot.isDisconnected) {
          return 'failed';
        }

        if (snapshot.isConnected) {
          return 'connected';
        }

        return 'pending';
      },
      {
        timeout: this.timeouts.controlReady,
        message: 'Control page did not reach connected state in time.',
      }
    ).toBe('connected');

    return snapshot;
  }

  async waitForDisconnectedOrTimeout() {
    let snapshot = null;

    await expect.poll(
      async () => {
        snapshot = await this.getControlStateSnapshot();

        if (snapshot.isTimedOut || snapshot.isDisconnected) {
          return 'disconnected';
        }

        return 'pending';
      },
      {
        timeout: this.timeouts.controlReady,
        message: 'Control page did not show disconnected or timeout state in time.',
      }
    ).toBe('disconnected');

    return snapshot;
  }
}

module.exports = DeviceControlPage;