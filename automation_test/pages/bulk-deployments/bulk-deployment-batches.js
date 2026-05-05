const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { escapeRegExp, normalizeText } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Batches tab metrics and empty state. */
const bulkDeploymentBatches = {
  async expectBatchesEmptyState() {
    await expect(this.page.getByText(T.NO_BATCH_EMPTY)).toBeVisible({ timeout: this.timeout });
  },

  async getBatchMetricValue(label) {
    const metric = this.page
      .locator('.batches-datas-wrap')
      .filter({ has: this.page.locator('.batches-datas-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
      .first();
    await expect(metric).toBeVisible({ timeout: this.timeout });
    const text = normalizeText((await metric.locator('.batches-datas-value').textContent()) || '0');
    return Number.parseInt(text, 10);
  },

  async getBatchMetrics() {
    return {
      total: await this.getBatchMetricValue(T.BATCH_METRIC_TOTAL),
      completed: await this.getBatchMetricValue(T.BATCH_METRIC_COMPLETED),
      inProgress: await this.getBatchMetricValue(T.BATCH_METRIC_IN_PROGRESS),
      failed: await this.getBatchMetricValue(T.BATCH_METRIC_FAILED),
      canceled: await this.getBatchMetricValue(T.BATCH_METRIC_CANCELED),
    };
  },
};

module.exports = bulkDeploymentBatches;
