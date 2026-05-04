const BulkDeploymentBase = require('./bulk-deployment-base');
const bulkDeploymentListPage = require('./bulk-deployment-list-page');
const bulkDeploymentCreateEdit = require('./bulk-deployment-create-edit');
const bulkDeploymentDetailOverview = require('./bulk-deployment-detail-overview');
const bulkDeploymentDevices = require('./bulk-deployment-devices');
const bulkDeploymentApps = require('./bulk-deployment-apps');
const bulkDeploymentBatches = require('./bulk-deployment-batches');
const bulkDeploymentActions = require('./bulk-deployment-actions');

class BulkDeploymentPage extends BulkDeploymentBase {}

Object.assign(BulkDeploymentPage.prototype, bulkDeploymentListPage);
Object.assign(BulkDeploymentPage.prototype, bulkDeploymentCreateEdit);
Object.assign(BulkDeploymentPage.prototype, bulkDeploymentDetailOverview);
Object.assign(BulkDeploymentPage.prototype, bulkDeploymentDevices);
Object.assign(BulkDeploymentPage.prototype, bulkDeploymentApps);
Object.assign(BulkDeploymentPage.prototype, bulkDeploymentBatches);
Object.assign(BulkDeploymentPage.prototype, bulkDeploymentActions);

module.exports = BulkDeploymentPage;
