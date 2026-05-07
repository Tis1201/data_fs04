const { createBulkTest, bulkTestData, bulkLimits, config } = require('../bd-shared');
const { T } = require('../../../pages/bulk-deployments/flows');

/**
 * E2E-level shared exports for Bulk Deployments.
 * Reuses bd-shared fixtures + cleanup (deleteTrackedBundlesForPage in afterEach).
 */
module.exports = {
  createBulkE2ETest: createBulkTest,
  bulkTestData,
  bulkLimits,
  config,
  T,
  /**
   * Optional env-gated ID for an already Failed deployment to validate retry behavior.
   * This is intentionally externalized to avoid forcing the suite to manufacture failure states.
   */
  failedDeploymentId:
    bulkTestData.failedDeploymentId || process.env.BULK_FAILED_DEPLOYMENT_ID || '',
};
