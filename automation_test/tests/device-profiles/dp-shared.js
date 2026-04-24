/**
 * Shared setup for Device Profiles split test files.
 * Contains constants, config validation, and reusable helpers.
 */
const path = require('path');
const config = require('../../config/config-loader');

// ─── Config Validation ──────────────────────────────────────────────────────
(function validateDeviceProfileConfig() {
    const dp = config.pageURL?.deviceProfiles;
    if (!dp) throw new Error('Missing deviceProfiles config in config-loader.');
    for (const key of ['url', 'profileWithDevicesId', 'profileWithDevicesName', 'profileWithoutDevicesId']) {
        if (!dp[key]) throw new Error(`Missing required config: deviceProfiles.${key}`);
    }
})();

// ─── Constants ──────────────────────────────────────────────────────────────
const _dpCfg = config.pageURL.deviceProfiles;
const PROFILE_URL                  = _dpCfg.url;
const PROFILE_WITH_DEVICES_ID      = _dpCfg.profileWithDevicesId;
const PROFILE_WITH_DEVICES_NAME    = _dpCfg.profileWithDevicesName;
const PROFILE_WITHOUT_DEVICES_ID   = _dpCfg.profileWithoutDevicesId;
const PROFILE_WITHOUT_DEVICES_NAME = _dpCfg.profileWithoutDevicesName;
const INVALID_PROFILE_ID           = _dpCfg.invalidProfileId || 'nonexistent-profile-999';

const authFile = path.join(__dirname, '..', '..', 'user.json');

function generateTestProfileNameWithSuffix(prefix = 'AutoTest', suffix = '') {
    const ts = Date.now();
    return suffix ? `${prefix}_${suffix}_${ts}` : `${prefix}_${ts}`;
}

module.exports = {
    config,
    authFile,
    PROFILE_URL,
    PROFILE_WITH_DEVICES_ID,
    PROFILE_WITH_DEVICES_NAME,
    PROFILE_WITHOUT_DEVICES_ID,
    PROFILE_WITHOUT_DEVICES_NAME,
    INVALID_PROFILE_ID,
    generateTestProfileNameWithSuffix,
};
