const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp, normalizeText } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Detail URL, overview fields, status badge, audit. */
const bulkDeploymentDetailOverview = {
  getDeploymentIdFromUrl() {
    const match = this.page.url().match(/\/user\/iot\/bundles\/([^/?#]+)/);
    return match ? match[1] : '';
  },

  async getOverviewValue(label) {
    const field = this.page
      .locator('.overview-field')
      .filter({ has: this.page.locator('.overview-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i') }) })
      .first();

    const value = field.locator('.overview-value, .badge, [class*="badge"]').first();
    return normalizeText((await value.textContent().catch(() => '')) || '');
  },

  async expectOverviewFieldVisible(label) {
    await expect(
      this.page
        .locator('.overview-field')
        .filter({ has: this.page.locator('.overview-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i') }) })
        .first()
    ).toBeVisible({ timeout: this.timeout });
  },

  async expectOverviewValue(label, expectedValue) {
    await expect
      .poll(async () => this.getOverviewValue(label), {
        timeout: this.timeout,
        message: `Expected overview field "${label}" to contain "${expectedValue}"`,
      })
      .toContain(normalizeText(expectedValue));
  },

  async expectStatusBadgeVisible() {
    const badges = [
      T.STATUS_DRAFT,
      T.STATUS_PUBLISHED,
      T.STATUS_FAILED,
      T.STATUS_IN_PROGRESS,
      T.STATUS_COMPLETED,
      T.STATUS_SCHEDULED,
      T.STATUS_STOPPED,
      T.STATUS_CANCELLED,
      T.STATUS_CANCELED,
    ];

    for (const badge of badges) {
      const locator = this.page.getByText(badge, { exact: true }).first();
      if (await locator.isVisible().catch(() => false)) {
        return badge;
      }
    }

    throw new Error('No deployment status badge was visible.');
  },

  async waitForStatusOneOf(expectedStatuses, options = {}) {
    const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    const normalizedExpected = statuses.map((status) => normalizeText(status));
    const timeout = options.timeout || this.timeout;
    const reload = options.reload !== false;

    await expect
      .poll(
        async () => {
          if (reload) {
            await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
            await this.waitForPageReady().catch(() => null);
          }
          const status = normalizeText(await this.expectStatusBadgeVisible());
          return normalizedExpected.includes(status);
        },
        {
          timeout,
          intervals: [2000, 3000, 5000, 10000],
          message: `Expected deployment status to be one of: ${statuses.join(', ')}`,
        }
      )
      .toBe(true);
    return this.expectStatusBadgeVisible();
  },

  /** Terminal success for an immediate (non-future) publish: Completed or Published. */
  async waitForDeploymentSuccessfulFinish(options = {}) {
    const timeout = options.timeout || this.timeout;
    return this.waitForStatusOneOf([T.STATUS_COMPLETED, T.STATUS_PUBLISHED], { timeout, reload: options.reload });
  },

  async expectAuditInfoVisible() {
    await expect(this.page.getByText(new RegExp(T.CREATED_BY, 'i'))).toBeVisible({ timeout: this.timeout });
    await expect(this.page.getByText(new RegExp(T.LAST_UPDATED_BY, 'i'))).toBeVisible({ timeout: this.timeout });
  },
};

module.exports = bulkDeploymentDetailOverview;
