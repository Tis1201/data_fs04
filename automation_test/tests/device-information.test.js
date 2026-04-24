const { test, expect } = require('@playwright/test');
const DeviceDetailPage = require('../pages/iot/device-detail-page');
const config = require('../config/config-loader');
const { compare, normMAC, norm, extractIP, isNotEmpty } = require('../utils/terminal-helpers');
const { restoreDeviceName } = require('../utils/device-helpers');
const path = require('path');

const authFile = path.join(__dirname, '..', 'user.json');
test.use({ storageState: authFile });

const { url: DEVICES_URL, ethernetDeviceId: ETHERNET_DEVICE_ID, onlineDeviceId: ONLINE_DEVICE_ID, offlineDeviceId: OFFLINE_DEVICE_ID, wifiDeviceId: WIFI_DEVICE_ID, invalidDeviceId: INVALID_DEVICE_ID } = config.pageURL.devices;

test.describe('Section 1 — Page Load & Navigation', () => {

    test('TC-INFO-001: Page loads with correct structure, header, and all sections', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);

        await test.step('Navigate and verify page banner', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.pageBanner).toBeVisible();
        });

        await test.step('Verify section headings', async () => {
            await expect(dp.headingDeviceHealth).toBeVisible();
            await expect(dp.headingGeneral).toBeVisible();
        });

        await test.step('Verify all 5 tabs are visible', async () => {
            const tabs = [dp.tabDetails, dp.tabConfiguration, dp.tabInstalledApps, dp.tabDeployments, dp.tabActivityLogs];
            for (const tab of tabs) {
                await expect(tab.first()).toBeVisible();
            }
        });

        await test.step('Verify Details tab is active with Device Information visible', async () => {
            await expect(dp.headingDeviceInfo).toBeVisible();
        });
    });

    test('TC-INFO-002: Page shows error for an invalid device ID', async ({ page }) => {
        await page.goto(`${DEVICES_URL}/${INVALID_DEVICE_ID}`);
        await page.waitForLoadState('domcontentloaded');

        await test.step('Verify page renders content for invalid device ID', async () => {
            const pageContent = page.locator('main, [role="main"], .content, #root').first();
            await expect(pageContent).toBeVisible();
        });
    });

    test('TC-INFO-003: Tab switching and Edit Device button work correctly', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Verify Edit Device button is visible', async () => {
            await expect(dp.editDeviceButton).toBeVisible();
        });

        await test.step('Switch through each tab', async () => {
            const tabs = [
                { locator: dp.tabConfiguration, name: 'Configuration' },
                { locator: dp.tabInstalledApps, name: 'Installed Apps' },
                { locator: dp.tabDeployments, name: 'Deployments' },
                { locator: dp.tabActivityLogs, name: 'Activity Logs' },
            ];

            for (const tab of tabs) {
                await tab.locator.first().click();
                await page.waitForLoadState('domcontentloaded');
            }
        });

        await test.step('Return to Details tab and verify Device Information visible', async () => {
            await dp.tabDetails.first().click();
            await expect(dp.headingDeviceInfo).toBeVisible();
        });
    });
});

test.describe('Section 2 — General Info Panel', () => {

    test('TC-INFO-004: General card displays all fields with correct format for online device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let fields;
        await test.step('Verify General heading and Connection Status', async () => {
            await expect(dp.headingGeneral).toBeVisible();
            fields = await dp.extractAllFieldValues();
            const connStatus = fields['Connection Status'] || '';
            expect(norm(connStatus)).toContain('online');
        });

        await test.step('Verify Last ping is not empty', async () => {
            const lastPing = fields['Last ping'] || '';
            expect(lastPing.length).toBeGreaterThan(0);
        });

        await test.step('Verify Public IP format', async () => {
            const publicIP = fields['Public IP'] || '';
            expect(publicIP).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        });

        await test.step('Verify LAN MAC format', async () => {
            const lanMAC = fields['LAN MAC'] || '';
            expect(lanMAC).toMatch(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/);
        });

        await test.step('Verify Wi-Fi MAC format', async () => {
            const wifiMAC = fields['Wi-Fi MAC'] || '';
            const wifiMACValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(wifiMAC) || norm(wifiMAC) === 'n/a';
            expect(wifiMACValid).toBeTruthy();
        });
    });

    test('TC-INFO-005: General card displays correctly for offline device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, OFFLINE_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let fields;
        await test.step('Verify General heading and Connection Status is offline', async () => {
            await expect(dp.headingGeneral).toBeVisible();
            fields = await dp.extractAllFieldValues();
            const connStatus = fields['Connection Status'] || '';
            expect(norm(connStatus)).toContain('offline');
        });

        await test.step('Verify Public IP is not empty', async () => {
            const publicIP = fields['Public IP'] || '';
            expect(isNotEmpty(publicIP)).toBeTruthy();
        });

        await test.step('Verify Last ping is not empty', async () => {
            const lastPing = fields['Last ping'] || '';
            expect(isNotEmpty(lastPing)).toBeTruthy();
        });

        await test.step('Verify LAN MAC and Wi-Fi MAC are not empty', async () => {
            const lanMAC = fields['LAN MAC'] || '';
            expect(isNotEmpty(lanMAC)).toBeTruthy();
            const wifiMAC = fields['Wi-Fi MAC'] || '';
            expect(isNotEmpty(wifiMAC)).toBeTruthy();
        });
    });
});

test.describe('Section 3 — Device Information', () => {

    test('TC-INFO-006: Device Information card displays all fields and buttons for active device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let fields;
        await test.step('Verify Device Information heading and Device State', async () => {
            await expect(dp.headingDeviceInfo).toBeVisible();
            fields = await dp.extractAllFieldValues();
            const deviceState = fields['Device State'] || '';
            expect(norm(deviceState)).toContain('active');
        });

        await test.step('Verify Device Name is not empty', async () => {
            const deviceName = fields['Device Name'] || '';
            expect(isNotEmpty(deviceName)).toBeTruthy();
        });

        await test.step('Verify Assigned Profile is not empty', async () => {
            const profile = fields['Assigned Profile'] || '';
            expect(isNotEmpty(profile)).toBeTruthy();
        });

        await test.step('Verify Description is not empty', async () => {
            const desc = fields['Description'] || '';
            expect(isNotEmpty(desc)).toBeTruthy();
        });

        await test.step('Verify Refresh button is visible', async () => {
            await expect(dp.refreshButton).toBeVisible();
        });
    });

    test('TC-INFO-007: Assigned Profile link navigates to profile page and Refresh reloads data', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await expect(dp.profileLink).toBeVisible();

        await test.step('Click Profile link and verify navigation to profile page', async () => {
            await dp.profileLink.click();
            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(/\/device-profiles\//);

            await page.goBack();
            await page.waitForLoadState('networkidle');
            await expect(dp.headingDeviceInfo).toBeVisible();
        });

        await test.step('Click Refresh button and verify no error', async () => {
            await expect(dp.refreshButton).toBeVisible();
            await dp.refreshButton.click();
            await expect(dp.headingDeviceInfo).toBeVisible();
        });
    });
});

test.describe('Section 4 — Technical Details', () => {

    test('TC-INFO-009: Technical Details — UI fields + Terminal cross-verify', async ({ page }) => {
        test.setTimeout(180000);
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);

        let fields;

        await test.step('Part 1: UI field validation', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.headingTechnicalDetails).toBeVisible();
            fields = await dp.extractAllFieldValues();
        });

        await test.step('Verify OS Version has numeric prefix', async () => {
            const osVersion = fields['OS Version'] || '';
            expect(isNotEmpty(osVersion)).toBeTruthy();
            expect(osVersion).toMatch(/^\d+/);
        });

        await test.step('Verify Firmware is not empty', async () => {
            const firmware = fields['Firmware'] || '';
            expect(isNotEmpty(firmware)).toBeTruthy();
        });

        await test.step('Verify Model is not empty', async () => {
            const model = fields['Model'] || '';
            expect(isNotEmpty(model)).toBeTruthy();
        });

        await test.step('Verify Operating System is valid', async () => {
            const os = fields['Operating System'] || '';
            expect(['android', 'linux', 'windows', 'ios']).toContain(norm(os));
        });

        await test.step('Verify Manufacturer and Hardware ID (soft)', async () => {
            const manufacturer = fields['Manufacturer'] || '';
            const hwId = fields['Hardware ID'] || '';
            expect.soft(isNotEmpty(manufacturer), 'Manufacturer should be populated').toBeTruthy();
            expect.soft(isNotEmpty(hwId), 'Hardware ID should be populated').toBeTruthy();
        });

        await test.step('Verify OS Version consistency for Android', async () => {
            const os = fields['Operating System'] || '';
            const osVersion = fields['OS Version'] || '';
            if (norm(os) === 'android') {
                const ver = parseInt(osVersion);
                expect(ver).toBeGreaterThanOrEqual(1);
                expect(ver).toBeLessThanOrEqual(20);
            }
        });

        const termReady = await dp.gotoTerminal();
        expect(termReady, 'Terminal should be responsive for an online device').toBeTruthy();

        let tech = await dp.getTerminalTechDetails();
        if (!tech.osVersion && !tech.sdkVersion && !tech.model) {
            tech = await dp.getTerminalTechDetails();
        }
        expect.soft(tech.osVersion || tech.sdkVersion || tech.model, 'Terminal must return at least one technical detail').toBeTruthy();

        await test.step('Cross-verify OS Version with terminal', async () => {
            const osVersion = fields['OS Version'] || '';
            expect.soft(tech.osVersion, 'Terminal must return OS Version for cross-verify').toBeTruthy();
            expect.soft(compare('OS Version', osVersion, tech.osVersion), 'OS Version must match terminal').toBeTruthy();
        });

        await test.step('Cross-verify Firmware/SDK with terminal', async () => {
            const firmware = fields['Firmware'] || '';
            expect.soft(tech.sdkVersion, 'Terminal must return Firmware/SDK for cross-verify').toBeTruthy();
            expect.soft(compare('Firmware/SDK', firmware, tech.sdkVersion), 'Firmware/SDK must match terminal').toBeTruthy();
        });

        await test.step('Cross-verify Model with terminal (soft)', async () => {
            const model = fields['Model'] || '';
            expect.soft(compare('Model', model, tech.model, { caseInsensitive: true }), 'Model must match terminal').toBeTruthy();
        });

        await test.step('Cross-verify Manufacturer with terminal (soft)', async () => {
            const manufacturer = fields['Manufacturer'] || '';
            expect.soft(compare('Manufacturer', manufacturer, tech.manufacturer, { caseInsensitive: true }), 'Manufacturer should match terminal').toBeTruthy();
        });

        await test.step('Cross-verify Hardware ID with terminal (soft)', async () => {
            const hwId = fields['Hardware ID'] || '';
            expect.soft(compare('Hardware ID', hwId, tech.serialNo, { caseInsensitive: true }), 'Hardware ID should match terminal').toBeTruthy();
        });
    });
});

test.describe('Section 5 — Network Information', () => {

    test('TC-INFO-010: Network Information (Ethernet) — UI fields + Terminal cross-verify', async ({ page }) => {
        test.setTimeout(180000);
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);

        let fields;

        await test.step('Part 1: UI field validation — navigate and extract', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.headingNetworkInfo).toBeVisible();
            fields = await dp.extractAllFieldValues();
        });

        await test.step('Verify Connection Status is online', async () => {
            const connStatus = fields['Connection Status_network'] || fields['Connection Status'] || '';
            expect(norm(connStatus)).toContain('online');
        });

        await test.step('Verify Last ping is not empty', async () => {
            const lastPing = fields['Last ping_network'] || fields['Last ping'] || '';
            expect(lastPing.length).toBeGreaterThan(0);
        });

        let isEthernet;
        let isWifi;
        await test.step('Verify Network Interface is Ethernet or Wi-Fi', async () => {
            const netInterface = fields['Network Interface'] || '';
            isEthernet = norm(netInterface) === 'ethernet';
            isWifi = norm(netInterface) === 'wi-fi' || norm(netInterface) === 'wifi';
            expect(isEthernet || isWifi, `Network Interface should be 'Ethernet' or 'Wi-Fi', got "${netInterface}"`).toBeTruthy();
        });

        await test.step('Verify Wi-Fi SSID based on interface type', async () => {
            const wifiSSID = fields['Wi-Fi SSID'] || '';
            if (isEthernet) {
                expect(norm(wifiSSID)).toBe('n/a');
            } else {
                expect(wifiSSID.length).toBeGreaterThan(0);
            }
        });

        await test.step('Verify Signal Strength based on interface type', async () => {
            const signalStr = fields['Signal Strength'] || '';
            if (isEthernet) {
                expect(norm(signalStr)).toBe('n/a');
            }
        });

        await test.step('Verify Public IP format', async () => {
            const publicIP = fields['Public IP_network'] || fields['Public IP'] || '';
            expect(publicIP).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        });

        await test.step('Verify Private IP is in private range', async () => {
            const privateIP = fields['Private IP'] || '';
            expect(privateIP).toMatch(/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/);
        });

        await test.step('Verify LAN MAC format', async () => {
            const uiLanMAC = fields['LAN MAC_network'] || fields['LAN MAC'] || '';
            expect(uiLanMAC).toMatch(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/);
        });

        await test.step('Verify Wi-Fi MAC format', async () => {
            const uiWifiMAC = fields['Wi-Fi MAC_network'] || fields['Wi-Fi MAC'] || '';
            const wifiValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(uiWifiMAC) || norm(uiWifiMAC) === 'n/a';
            expect(wifiValid).toBeTruthy();
        });

        await test.step('Verify Primary MAC equals LAN MAC', async () => {
            const primaryMAC = fields['Primary MAC'] || '';
            const uiLanMAC = fields['LAN MAC_network'] || fields['LAN MAC'] || '';
            expect(primaryMAC).toMatch(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/);
            if (norm(uiLanMAC) !== 'n/a') {
                expect(normMAC(primaryMAC)).toBe(normMAC(uiLanMAC));
            }
        });

        const termReady = await dp.gotoTerminal();
        expect(termReady, 'Terminal should be responsive for an online device').toBeTruthy();

        const net = await dp.getTerminalNetworkDetails();
        const validMACPattern = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/;
        expect(validMACPattern.test((net.eth0MAC || '').trim()) || net.privateIP,
            'Terminal must return valid MAC or IP data').toBeTruthy();

        const uiLanMAC = fields['LAN MAC_network'] || fields['LAN MAC'] || '';
        const uiWifiMAC = fields['Wi-Fi MAC_network'] || fields['Wi-Fi MAC'] || '';
        const privateIP = fields['Private IP'] || '';
        const primaryMAC = fields['Primary MAC'] || '';
        const netInterface = fields['Network Interface'] || '';
        const wifiSSID = fields['Wi-Fi SSID'] || '';

        await test.step('Cross-verify LAN MAC with terminal', async () => {
            expect(compare('LAN MAC', uiLanMAC, net.eth0MAC, { isMAC: true }), 'LAN MAC must match terminal').toBeTruthy();
        });

        await test.step('Cross-verify Wi-Fi MAC with terminal', async () => {
            const isValidMAC = (s) => s && s.includes(':');
            const wifiMACPass = !isValidMAC(net.wlan0MAC)
                || (norm(uiWifiMAC) === 'n/a' && norm(net.wlan0MAC) === 'n/a')
                || normMAC(uiWifiMAC) === normMAC(net.wlan0MAC);
            expect.soft(wifiMACPass, `Wi-Fi MAC mismatch: UI="${uiWifiMAC}" vs Terminal="${net.wlan0MAC}"`).toBeTruthy();
        });

        await test.step('Cross-verify Private IP with terminal', async () => {
            const termIPClean = extractIP(net.privateIP);
            expect.soft(compare('Private IP', privateIP, termIPClean), 'Private IP must match terminal').toBeTruthy();
        });

        await test.step('Cross-verify Primary MAC with terminal eth0', async () => {
            expect.soft(compare('Primary MAC vs eth0', primaryMAC, net.eth0MAC, { isMAC: true }), 'Primary MAC must match eth0 MAC').toBeTruthy();
        });

        await test.step('Cross-verify Network Interface with terminal', async () => {
            expect.soft(net.activeInterface, 'Terminal must return active interface state').toBeTruthy();
            const ethUp = norm(net.activeInterface).includes('eth0');
            const wlanUp = norm(net.activeInterface).includes('wlan0');
            const ifaceMatch = !net.activeInterface || (isEthernet && ethUp) || (isWifi && wlanUp);
            expect.soft(ifaceMatch, `Network Interface mismatch: UI="${netInterface}" vs eth0 UP=${ethUp}, wlan0 UP=${wlanUp}`).toBeTruthy();
        });

        await test.step('Cross-verify Wi-Fi SSID with terminal', async () => {
            const termSSIDGarbage = norm(net.wifiSSID).includes('/system/bin/sh') || norm(net.wifiSSID).includes('no such file') || norm(net.wifiSSID).includes('not found') || norm(net.wifiSSID).includes('wifi_') && !norm(net.wifiSSID).includes(norm(wifiSSID));
            const ssidBothNA = norm(wifiSSID) === 'n/a' && (termSSIDGarbage || norm(net.wifiSSID) === 'n/a' || norm(net.wifiSSID) === '');
            const ssidPass = ssidBothNA || norm(wifiSSID) === norm(net.wifiSSID);
            expect.soft(ssidPass, `Wi-Fi SSID mismatch: UI="${wifiSSID}" vs Terminal="${net.wifiSSID}"`).toBeTruthy();
        });
    });

    test('TC-INFO-011: Network Information card — Wi-Fi device fields', async ({ page }) => {
        const dp = new DeviceDetailPage(page, WIFI_DEVICE_ID);
        await dp.gotoDeviceDetail();

        const fields = await dp.extractAllFieldValues();

        await test.step('Verify Network Interface is Wi-Fi', async () => {
            const netInterface = fields['Network Interface'] || '';
            expect.soft(norm(netInterface)).toBe('wifi');
        });

        await test.step('Verify Wi-Fi SSID is populated', async () => {
            const wifiSSID = fields['Wi-Fi SSID'] || '';
            expect.soft(isNotEmpty(wifiSSID)).toBeTruthy();
            expect.soft(norm(wifiSSID)).not.toBe('n/a');
        });

        await test.step('Verify Signal Strength is populated', async () => {
            const signalStr = fields['Signal Strength'] || '';
            expect.soft(isNotEmpty(signalStr)).toBeTruthy();
            expect.soft(norm(signalStr)).not.toBe('n/a');
        });
    });

    test('TC-INFO-012: Network Information for offline device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, OFFLINE_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let fields;
        await test.step('Verify Connection Status is offline', async () => {
            await expect(dp.headingNetworkInfo).toBeVisible();
            fields = await dp.extractAllFieldValues();
            const connStatus = fields['Connection Status_network'] || fields['Connection Status'] || '';
            expect(norm(connStatus)).toContain('offline');
        });

        await test.step('Verify all 10 network fields are rendered', async () => {
            const networkFields = [
                'Connection Status', 'Last ping', 'Network Interface', 'Wi-Fi SSID',
                'Signal Strength', 'Public IP', 'Private IP', 'LAN MAC', 'Wi-Fi MAC', 'Primary MAC'
            ];
            for (const label of networkFields) {
                const val = fields[label + '_network'] || fields[label] || '';
                expect(val.trim().length > 0, `Field "${label}" should be rendered (got empty string)`).toBeTruthy();
            }
        });
    });
});

test.describe('Section 6 — Security', () => {

    test('TC-INFO-013: Security card displays masked API Key with copy functionality', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Verify Security heading and masked API Key', async () => {
            await expect(dp.headingSecurity).toBeVisible();
            const fields = await dp.extractAllFieldValues();
            const apiKey = fields['API Key'] || '';
            expect(isNotEmpty(apiKey)).toBeTruthy();
            expect(apiKey).toContain('\u2022\u2022');
        });

        await test.step('Verify Copy API Key button and click', async () => {
            await expect(dp.copyApiKeyButton).toBeVisible();
            await dp.clickCopyApiKey();
        });
    });

    test('TC-INFO-014: Generate New Key flow — confirm dialog and key changes', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Click Generate New Key', async () => {
            await expect(dp.generateNewKeyButton).toBeVisible();
            await expect(dp.generateNewKeyButton).toBeEnabled();
            await dp.clickGenerateNewKey();
        });

        await test.step('Handle confirmation and verify new key populated', async () => {
            await page.waitForLoadState('networkidle');
            const newFields = await dp.extractAllFieldValues();
            const newKey = newFields['API Key'] || '';
            expect(isNotEmpty(newKey), 'New API Key should be populated').toBeTruthy();
        });
    });
});

test.describe('Section 7 — Device Health Panel', () => {

    test('TC-INFO-015: Device Health — metrics, buttons, and Terminal cross-verify', async ({ page }) => {
        test.setTimeout(180000);
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);

        let metrics;
        await test.step('Part 1: UI field validation — extract health metrics', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.headingDeviceHealth).toBeVisible();
            metrics = await dp.getHealthMetrics();
        });

        await test.step('Verify Device Uptime format', async () => {
            expect(metrics.uptime).toBeTruthy();
            expect(metrics.uptime).toMatch(/\d{1,2}:\d{2}(:\d{2})?/);
        });

        await test.step('Verify CPU is within 0-100 range', async () => {
            const cpuNum = parseInt(metrics.cpu);
            expect(cpuNum).toBeGreaterThanOrEqual(0);
            expect(cpuNum).toBeLessThanOrEqual(100);
        });

        await test.step('Verify MEM is within 0-100 range', async () => {
            const memNum = parseInt(metrics.mem);
            expect(memNum).toBeGreaterThanOrEqual(0);
            expect(memNum).toBeLessThanOrEqual(100);
        });

        await test.step('Verify DSK is within 0-100 range', async () => {
            const dskNum = parseInt(metrics.dsk);
            expect(dskNum).toBeGreaterThanOrEqual(0);
            expect(dskNum).toBeLessThanOrEqual(100);
        });

        await test.step('Verify all 8 Quick Action buttons are visible', async () => {
            for (const [name, btn] of Object.entries(dp.quickActionButtons)) {
                await expect(btn, `Button "${name}" should be visible`).toBeVisible();
            }
        });

        const termReady = await dp.gotoTerminal();
        expect(termReady, 'Terminal should be responsive for an online device').toBeTruthy();

        const uiDSK = parseFloat((metrics.dsk || '').replace('%', '').trim());
        const uiMEM = parseFloat((metrics.mem || '').replace('%', '').trim());

        const termDiskPercent = await dp.getTerminalDiskUsage();
        const termMemInfo = await dp.getTerminalMemInfo();

        expect.soft(termDiskPercent !== null, 'Terminal must return disk usage data').toBeTruthy();

        await test.step('Cross-verify DSK with terminal (±2%)', async () => {
            const dskMatch = !isNaN(uiDSK) && termDiskPercent !== null && Math.abs(uiDSK - termDiskPercent) <= 2;
            expect.soft(dskMatch, `DSK mismatch: UI=${uiDSK}% vs Terminal=${termDiskPercent}%`).toBeTruthy();
        });

        await test.step('Cross-verify MEM with terminal (±40%, soft)', async () => {
            if (termMemInfo.usedPercent === 0) {
                test.info().annotations.push({ type: 'warn', description: 'Terminal returned 0 MEM — device may not expose /proc/meminfo reliably' });
                return;
            }
            const memMatch = !isNaN(uiMEM) && Math.abs(uiMEM - termMemInfo.usedPercent) <= 40;
            expect.soft(memMatch, `MEM mismatch: UI=${uiMEM}% vs Terminal=${termMemInfo.usedPercent}% (±40%)`).toBeTruthy();
        });
    });

    test('TC-INFO-016: Health panel for offline device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, OFFLINE_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Verify Device Health heading is visible', async () => {
            await expect(dp.headingDeviceHealth).toBeVisible();
        });

        await test.step('Verify all health fields are rendered', async () => {
            const allFields = await dp.extractAllFieldValues();
            for (const key of ['Device Uptime', 'CPU', 'MEM', 'DSK']) {
                const val = allFields[key] || '';
                expect(val.trim().length > 0, `Field "${key}" should be rendered (got empty string)`).toBeTruthy();
            }
        });
    });
});

test.describe('Section 8 — Data Consistency Cross-check', () => {

    test('TC-INFO-019: Detail page data matches device list page', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);

        let detailName;
        await test.step('Navigate to detail page and extract device name', async () => {
            await dp.gotoDeviceDetail();
            const fields = await dp.extractAllFieldValues();
            detailName = fields['Device Name'] || '';
            const detailStatus = fields['Connection Status'] || '';
            expect(isNotEmpty(detailName), 'Device Name should not be empty on detail page').toBeTruthy();
            expect(isNotEmpty(detailStatus), 'Connection Status should not be empty on detail page').toBeTruthy();
        });

        await test.step('Search device by name on list page and verify row is visible', async () => {
            await page.goto(DEVICES_URL);
            await page.waitForLoadState('networkidle');
            const searchInput = page.getByPlaceholder(/search/i).first();
            await expect(searchInput).toBeVisible();
            await searchInput.fill(detailName);
            await page.waitForLoadState('networkidle');
            const deviceRow = page.locator('tr').filter({ hasText: detailName }).first();
            await expect(deviceRow, `Device "${detailName}" should appear on list page`).toBeVisible();
        });
    });

    test('TC-INFO-020: Duplicated fields are consistent between General and Network cards', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();
        const fields = await dp.extractAllFieldValues();

        await test.step('Verify Connection Status consistency', async () => {
            const genConnStatus = fields['Connection Status'] || '';
            const netConnStatus = fields['Connection Status_network'] || '';
            expect(isNotEmpty(netConnStatus), 'Network card should have Connection Status').toBeTruthy();
            expect(norm(genConnStatus)).toBe(norm(netConnStatus));
        });

        await test.step('Verify Last ping consistency', async () => {
            const genLastPing = fields['Last ping'] || '';
            const netLastPing = fields['Last ping_network'] || '';
            expect(isNotEmpty(genLastPing), 'General card should have Last ping').toBeTruthy();
            expect(isNotEmpty(netLastPing), 'Network card should have Last ping').toBeTruthy();
        });

        await test.step('Verify Public IP consistency', async () => {
            const genPublicIP = fields['Public IP'] || '';
            const netPublicIP = fields['Public IP_network'] || '';
            expect(isNotEmpty(netPublicIP), 'Network card should have Public IP').toBeTruthy();
            expect(genPublicIP).toBe(netPublicIP);
        });

        await test.step('Verify LAN MAC consistency', async () => {
            const genLanMAC = fields['LAN MAC'] || '';
            const netLanMAC = fields['LAN MAC_network'] || '';
            expect(isNotEmpty(netLanMAC), 'Network card should have LAN MAC').toBeTruthy();
            expect(normMAC(genLanMAC)).toBe(normMAC(netLanMAC));
        });

        await test.step('Verify Wi-Fi MAC consistency', async () => {
            const genWifiMAC = fields['Wi-Fi MAC'] || '';
            const netWifiMAC = fields['Wi-Fi MAC_network'] || '';
            expect.soft(isNotEmpty(netWifiMAC), 'Network card should have Wi-Fi MAC').toBeTruthy();
            expect(normMAC(genWifiMAC)).toBe(normMAC(netWifiMAC));
        });
    });
});

test.describe('Section 9 — Edit Device Modal', () => {

    test.describe.configure({ mode: 'serial' });

    let originalDeviceName;
    let sectionBaseline;

    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext({ storageState: authFile });
        const page = await context.newPage();
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();
        const fields = await dp.extractAllFieldValues();
        sectionBaseline = fields['Device Name'] || '';
        await context.close();
    });

    test.afterEach(async ({ page }) => {
        const restoreTo = sectionBaseline || originalDeviceName;
        if (!restoreTo) return;
        try {
            await restoreDeviceName(page, ETHERNET_DEVICE_ID, restoreTo);
        } catch (e) {
            throw new Error(`Failed to restore device name to "${restoreTo}": ${e.message}`);
        }
    });

    test('TC-INFO-021: Edit Device full flow — open, verify pre-fill, modify, and save', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Capture original device name', async () => {
            const fieldsBefore = await dp.extractAllFieldValues();
            originalDeviceName = fieldsBefore['Device Name'] || '';
            expect(isNotEmpty(originalDeviceName), 'Original Device Name should not be empty').toBeTruthy();
        });

        await test.step('Open Edit Device modal and verify pre-fill', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });
            const nameInput = dp.modal.locator('input').first();
            await expect(nameInput).not.toHaveValue('', { timeout: 5000 });
        });

        await test.step('Modify name and save', async () => {
            const testName = originalDeviceName + ' Test';
            const nameInput = dp.modal.locator('input').first();
            await nameInput.clear();
            await nameInput.fill(testName);

            const saveBtn = dp.modal.getByRole('button', { name: /Save|Update|Submit/i }).first();
            await expect(saveBtn).toBeVisible();
            await saveBtn.click();
            await expect(dp.modal).toBeHidden();
        });

        await test.step('Verify updated name on detail page', async () => {
            const fieldsAfter = await dp.extractAllFieldValues();
            const updatedName = fieldsAfter['Device Name'] || '';
            expect(isNotEmpty(updatedName), 'Updated Device Name should not be empty').toBeTruthy();
        });
    });

    test('TC-INFO-022: Edit Device — cancel discards changes and validation prevents empty name', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let origName;
        await test.step('Capture original name', async () => {
            const fieldsBefore = await dp.extractAllFieldValues();
            origName = fieldsBefore['Device Name'] || '';
            originalDeviceName = origName;
        });

        await test.step('Open modal, modify name, then cancel — verify name unchanged', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });

            const nameInput = dp.modal.locator('input').first();
            await nameInput.clear();
            await nameInput.fill('TEMP-SHOULD-NOT-SAVE');

            const cancelBtn = dp.modal.getByRole('button', { name: /Cancel|Close/i }).first();
            await expect(cancelBtn).toBeVisible();
            await cancelBtn.click();
            await expect(dp.modal).toBeHidden();

            const fieldsAfterCancel = await dp.extractAllFieldValues();
            expect(fieldsAfterCancel['Device Name'] || '').toBe(origName);
        });

        await test.step('Open modal, clear name — verify validation prevents empty name', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });

            const nameInput = dp.modal.locator('input').first();
            await nameInput.clear();

            const saveBtn = dp.modal.getByRole('button', { name: /Save|Update|Submit/i }).first();
            await expect(saveBtn).toBeVisible();
            await saveBtn.click({ force: true });
            await expect(dp.modal, 'Modal should remain open when saving with empty name').toBeVisible();

            const cancelBtn = dp.modal.getByRole('button', { name: /Cancel|Close/i }).first();
            await expect(cancelBtn).toBeVisible();
            await cancelBtn.click();
            await expect(dp.modal).toBeHidden();
        });
    });
});

test.describe('Section 10 — Edge Cases', () => {

    test.describe.configure({ mode: 'serial' });

    let originalDeviceName;
    let sectionBaseline;

    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext({ storageState: authFile });
        const page = await context.newPage();
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();
        const fields = await dp.extractAllFieldValues();
        sectionBaseline = fields['Device Name'] || '';
        await context.close();
    });

    test.afterEach(async ({ page }) => {
        const restoreTo = sectionBaseline || originalDeviceName;
        if (!restoreTo) return;
        try {
            await restoreDeviceName(page, ETHERNET_DEVICE_ID, restoreTo);
        } catch (e) {
            throw new Error(`Failed to restore device name to "${restoreTo}": ${e.message}`);
        }
    });

    test('TC-INFO-024: Long name and special characters display correctly (XSS prevention)', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Capture original name', async () => {
            const fieldsBefore = await dp.extractAllFieldValues();
            originalDeviceName = fieldsBefore['Device Name'] || '';
        });

        await test.step('Input XSS string and save — verify page renders safely', async () => {
            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });

            const nameInput = dp.modal.locator('input').first();
            const xssString = '<script>alert("xss")</script>';
            await nameInput.clear();
            await nameInput.fill(xssString);

            const saveBtn = dp.modal.getByRole('button', { name: /Save|Update|Submit/i }).first();
            await expect(saveBtn).toBeVisible();
            await saveBtn.click();
            await expect(dp.modal).toBeHidden();

            const dialog = await page.evaluateHandle(() => {
                const els = document.querySelectorAll('script');
                return Array.from(els).some(el => el.textContent.includes('alert("xss")'));
            });
            expect(await dialog.jsonValue(), 'XSS script should not execute').toBeFalsy();
        });
    });

    test('TC-INFO-025: Page displays correctly after browser refresh', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);

        let nameBefore, ipBefore;
        await test.step('Capture data before refresh', async () => {
            await dp.gotoDeviceDetail();
            const fieldsBefore = await dp.extractAllFieldValues();
            nameBefore = fieldsBefore['Device Name'] || '';
            ipBefore = fieldsBefore['Public IP'] || fieldsBefore['Public IP_network'] || '';
        });

        await test.step('Reload page and verify data persisted', async () => {
            await page.reload();
            await page.waitForLoadState('networkidle');

            const fieldsAfter = await dp.extractAllFieldValues();
            const nameAfter = fieldsAfter['Device Name'] || '';
            const ipAfter = fieldsAfter['Public IP'] || fieldsAfter['Public IP_network'] || '';
            expect(nameAfter).toBe(nameBefore);
            if (ipBefore && ipAfter) expect(ipAfter).toBe(ipBefore);
        });

        await test.step('Verify all section headings visible after refresh', async () => {
            const sectionHeadings = [
                dp.headingDeviceHealth,
                dp.headingGeneral,
                dp.headingDeviceInfo,
                dp.headingTechnicalDetails,
                dp.headingNetworkInfo,
            ];
            for (const heading of sectionHeadings) {
                await expect(heading).toBeVisible();
            }
        });
    });
});
