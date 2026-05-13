/**
 * Shared setup for Device Actions split test files.
 * Contains constants, config validation, and reusable helpers.
 *
 * Spreadsheet crosswalk (Device Actions E2E — TC-DA-E2E-xxx):
 * - E2E-001~002: da-e2e-setup-baseline.test.js
 * - E2E-003: da-e2e-full-flow-install.test.js (full chain); da-02, da-03 = focused partials
 * - E2E-004: da-e2e-remove-app.test.js
 * - E2E-005~006: da-e2e-pull-push-full.test.js; da-04/05 = modal / log partials
 * - E2E-010,044,negative: da-e2e-control.test.js
 * - E2E-011: da-e2e-install-variants.test.js; E2E-013~015 backlog skips in same file
 * - E2E-048: da-e2e-smoke-chain.test.js (RUN_DA_E2E_CHAIN=1)
 * - E2E-008,036,037,020,032,035,038,041,043,012: da-e2e-supplement-matrix.test.js (043 + downgrade need env flags)
 * - Snapshot / Reboot: da-07, da-06 map to E2E-007~009 style flows in spreadsheet (see titles in those files)
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

