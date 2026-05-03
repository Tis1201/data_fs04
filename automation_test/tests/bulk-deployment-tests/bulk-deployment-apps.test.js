const BulkDeploymentTestHelpers = require('./bulk-deployment-test-helpers');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

test.describe('Bulk Deployment - Apps Tab', () => {
  // Use helpers from existing file - no changes needed for format as it's already structured
  // Full content preserved
  BulkDeploymentTestHelpers.testBulkDeploymentAppsTab();
});
