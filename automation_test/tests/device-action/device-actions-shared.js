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
    for (const key of ['onlineDeviceId']) {
        if (!devices[key]) throw new Error(`Missing required config: devices.${key}`);
    }

    if (!devices.deviceDetail) {
        const hasFallbackParts = Boolean(devices.url && devices.detailPath);
        if (!hasFallbackParts) {
            throw new Error(
                'Missing required config: devices.deviceDetail (or provide devices.url + devices.detailPath for auto-build).'
            );
        }
    }
})();

// ─── Constants ──────────────────────────────────────────────────────────────
const _daCfg = config.pageURL.devices;
const DEVICE_DETAIL_URL =
    _daCfg.deviceDetail ||
    (() => {
        const baseOrigin = new URL(_daCfg.url).origin;
        const normalizedPath = String(_daCfg.detailPath || '/user/iot/devices').replace(/\/$/, '');
        const deviceId = _daCfg.onlineDeviceId;
        return `${baseOrigin}${normalizedPath}/${deviceId}`;
    })();
const ONLINE_DEVICE_ID = _daCfg.onlineDeviceId;
const authFile = path.join(__dirname, '..', '..', 'user.json');

module.exports = {
    config,
    authFile,
    DEVICE_DETAIL_URL,
    ONLINE_DEVICE_ID,
};

