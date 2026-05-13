const { createBulkTest, bulkTestData, bulkLimits, config } = require('./bd-shared');
const { T } = require('../../pages/bulk-deployments/flows');

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
};
