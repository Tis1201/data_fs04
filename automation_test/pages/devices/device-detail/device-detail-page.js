const DeviceDetailBase = require('./device-detail-base');
const deviceDetailActions = require('./device-detail-actions');
const deviceDetailModals = require('./device-detail-modals');
const deviceDetailActivityLogs = require('./device-detail-activity-logs');
const deviceDetailInfo = require('./device-detail-info');
const deviceDetailTerminal = require('./device-detail-terminal');

class DeviceDetailPage extends DeviceDetailBase {}

Object.assign(DeviceDetailPage.prototype, deviceDetailActions);
Object.assign(DeviceDetailPage.prototype, deviceDetailModals);
Object.assign(DeviceDetailPage.prototype, deviceDetailActivityLogs);
Object.assign(DeviceDetailPage.prototype, deviceDetailInfo);
Object.assign(DeviceDetailPage.prototype, deviceDetailTerminal);

module.exports = DeviceDetailPage;
