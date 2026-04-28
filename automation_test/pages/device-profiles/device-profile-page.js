const DeviceProfileBase = require('./device-profile-base');
const deviceProfileListing = require('./device-profile-listing');
const deviceProfileListingModals = require('./device-profile-listing-modals');
const deviceProfileDetailOverview = require('./device-profile-detail-overview');
const deviceProfileDetailConfiguration = require('./device-profile-detail-configuration');
const deviceProfileDetailDevices = require('./device-profile-detail-devices');
const deviceProfileActions = require('./actions');

class DeviceProfilePage extends DeviceProfileBase {}

// Data mixins (getters / extractors)
Object.assign(DeviceProfilePage.prototype, deviceProfileListing);
Object.assign(DeviceProfilePage.prototype, deviceProfileListingModals);
Object.assign(DeviceProfilePage.prototype, deviceProfileDetailOverview);
Object.assign(DeviceProfilePage.prototype, deviceProfileDetailConfiguration);
Object.assign(DeviceProfilePage.prototype, deviceProfileDetailDevices);

// User-action mixins (navigation, listing, modal flows)
Object.assign(DeviceProfilePage.prototype, deviceProfileActions.navigationActions);
Object.assign(DeviceProfilePage.prototype, deviceProfileActions.listingActions);
Object.assign(DeviceProfilePage.prototype, deviceProfileActions.listingModalActions);

module.exports = DeviceProfilePage;
