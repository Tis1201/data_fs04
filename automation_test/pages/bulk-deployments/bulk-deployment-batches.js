const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');
const { normalizeText } = require('./bulk-deployment-pom-utils');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Batches tab metrics and empty state. */
const bulkDeploymentBatches = {
  async expectBatchesEmptyState() {
    await expect(this.getNoBatchEmptyText()).toBeVisible({ timeout: this.timeout });
  },

  async getBatchMetricValue(label) {
    const metric = this.getBatchMetric(label);
    await expect(metric).toBeVisible({ timeout: this.timeout });
    const text = normalizeText((await this.getBatchMetricValueLocator(metric).textContent()) || '0');
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
