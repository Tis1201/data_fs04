/**
 * Shared setup for Device Information split test files.
 * Contains constants, config validation, reusable helpers, and Playwright fixture.
 */
const path = require('path');
const base = require('@playwright/test');
const config = require('../../config/config-loader');
const { restoreDeviceName } = require('../../utils/device-helpers');
const { compare, normMAC, norm, extractIP, isNotEmpty } = require('../../utils/terminal-helpers');

// ─── Config Validation ──────────────────────────────────────────────────────
(function validateDevicesConfig() {
    const d = config.pageURL?.devices;
    if (!d) throw new Error('Missing devices config in config-loader.');
    for (const key of ['url', 'ethernetDeviceId', 'onlineDeviceId', 'offlineDeviceId', 'wifiDeviceId']) {
        if (!d[key]) throw new Error(`Missing required config: devices.${key}`);
    }
})();

// ─── Constants ──────────────────────────────────────────────────────────────
const _dCfg = config.pageURL.devices;
const DEVICES_URL             = _dCfg.url;
const ETHERNET_DEVICE_ID      = _dCfg.ethernetDeviceId;
const ONLINE_DEVICE_ID        = _dCfg.onlineDeviceId;
const OFFLINE_DEVICE_ID       = _dCfg.offlineDeviceId;
const WIFI_DEVICE_ID          = _dCfg.wifiDeviceId;
const INVALID_DEVICE_ID       = _dCfg.invalidDeviceId || 'nonexistent-device-999';

const authFile = path.join(__dirname, '..', '..', 'user.json');

// ─── Regex Constants ────────────────────────────────────────────────────────
const MAC_PATTERN = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const IP_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const PRIVATE_IP_PATTERN = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

// ─── Playwright Fixture ─────────────────────────────────────────────────────
function createTest(deviceId = ETHERNET_DEVICE_ID, navigate = true) {
    const test = base.test.extend({
        storageState: authFile,
        dp: async ({ page }, use) => {
            const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');
            const dp = new DeviceDetailPage(page, deviceId);
            if (navigate) await dp.gotoDeviceDetail();
            await use(dp);
        }
    });
    return test;
}

const dpTest = createTest(ETHERNET_DEVICE_ID, true);

// ─── Restore State for Serial Sections ──────────────────────────────────────
function createRestoreState(deviceId = ETHERNET_DEVICE_ID) {
    let originalDeviceName;
    let sectionBaseline;

    function captureBaseline(fields) {
        sectionBaseline = fields['Device Name'] || '';
    }

    function setOriginalDeviceName(name) {
        originalDeviceName = name;
    }

    async function beforeAllCapture({ browser }) {
        const context = await browser.newContext({ storageState: authFile });
        const page = await context.newPage();
        const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');
        const dp = new DeviceDetailPage(page, deviceId);
        await dp.gotoDeviceDetail();
        const fields = await dp.extractAllFieldValues();
        captureBaseline(fields);
        await context.close();
    }

    async function afterEachRestore({ page }) {
        const restoreTo = sectionBaseline || originalDeviceName;
        if (!restoreTo) return;
        try {
            await restoreDeviceName(page, deviceId, restoreTo);
        } catch (e) {
            throw new Error(`Failed to restore device name to "${restoreTo}": ${e.message}`);
        }
    }

    return {
        setOriginalDeviceName,
        beforeAllCapture,
        afterEachRestore,
    };
}

module.exports = {
    config,
    authFile,
    DEVICES_URL,
    ETHERNET_DEVICE_ID,
    ONLINE_DEVICE_ID,
    OFFLINE_DEVICE_ID,
    WIFI_DEVICE_ID,
    INVALID_DEVICE_ID,
    MAC_PATTERN,
    IP_PATTERN,
    PRIVATE_IP_PATTERN,
    compare,
    normMAC,
    norm,
    extractIP,
    isNotEmpty,
    createTest,
    dpTest,
    createRestoreState,
};
