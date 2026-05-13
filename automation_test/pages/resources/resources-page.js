const ResourceBase = require('./resource-base');
const resourceListing = require('./resource-listing');
const resourceDetailOverview = require('./resource-detail-overview');
const resourceActions = require('./actions');

class ResourcesPage extends ResourceBase {}

Object.assign(ResourcesPage.prototype, resourceListing);
Object.assign(ResourcesPage.prototype, resourceDetailOverview);
Object.assign(ResourcesPage.prototype, resourceActions.navigationActions);
Object.assign(ResourcesPage.prototype, resourceActions.listingActions);
Object.assign(ResourcesPage.prototype, resourceActions.listingModalActions);

module.exports = ResourcesPage;
