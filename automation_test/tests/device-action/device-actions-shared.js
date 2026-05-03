/**
 * Shared setup for Device Actions split test files.
 * Contains constants, config validation, and reusable helpers.
 */
const path = require('path');
const config = require('../../config/config-loader');

// ─── Config Validation ──────────────────────────────────────────────────────
(function validateDeviceActionConfig() {
    const devices = config.pageURL?.devices;
    if (!devices) throw new Error('Missing devices config in config-loader.');
    for (const key of ['deviceDetail', 'onlineDeviceId']) {
        if (!devices[key]) throw new Error(`Missing required config: devices.${key}`);
    }
})();

// ─── Constants ──────────────────────────────────────────────────────────────
const _daCfg = config.pageURL.devices;
const DEVICE_DETAIL_URL = _daCfg.deviceDetail;
const ONLINE_DEVICE_ID = _daCfg.onlineDeviceId;
const authFile = path.join(__dirname, '..', '..', 'user.json');

module.exports = {
    config,
    authFile,
    DEVICE_DETAIL_URL,
    ONLINE_DEVICE_ID,
};

