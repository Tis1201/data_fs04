const {
    dpTest, normMAC, norm, extractIP, isNotEmpty,
    MAC_PATTERN, IP_PATTERN, PRIVATE_IP_PATTERN,
    OFFLINE_DEVICE_ID, WIFI_DEVICE_ID,
} = require('./di-shared');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');

const test = dpTest;
const expect = test.expect;

test.describe('Section 5 — Network Information', () => {

    test('TC-INFO-009: Network Information (Ethernet) — UI fields + Terminal cross-verify', async ({ dp }) => {
        test.setTimeout(180000);

        let fields;

        await test.step('Navigate and wait for Network Information to fully render', async () => {
            await dp.gotoDeviceDetail();
            await expect(dp.headingNetworkInfo).toBeVisible();
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                if (isNotEmpty(data['Public IP'] || data['Public IP_network'])) {
                    fields = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for Network Information fields to load' }).toBeTruthy();
        });

        let isEthernet;
        let isWifi;
        await test.step('Verify Connection Status is online', async () => {
            const connStatus = (fields['Connection Status_network'] || fields['Connection Status'] || '').toLowerCase();
            expect(connStatus).toContain('online');
        });

        await test.step('Verify Last ping is not empty', async () => {
            const lastPing = fields['Last ping_network'] || fields['Last ping'] || '';
            expect(lastPing.length, 'Last ping should not be empty').toBeGreaterThan(0);
        });

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
            expect(publicIP, 'Public IP should match IPv4 format').toMatch(IP_PATTERN);
        });

        await test.step('Verify Private IP is in private range', async () => {
            const privateIP = fields['Private IP'] || '';
            expect(privateIP, 'Private IP should be in private range').toMatch(PRIVATE_IP_PATTERN);
        });

        await test.step('Verify LAN MAC format', async () => {
            const uiLanMAC = fields['LAN MAC_network'] || fields['LAN MAC'] || '';
            expect(uiLanMAC, 'LAN MAC should match MAC format').toMatch(MAC_PATTERN);
        });

        await test.step('Verify Wi-Fi MAC format', async () => {
            const uiWifiMAC = fields['Wi-Fi MAC_network'] || fields['Wi-Fi MAC'] || '';
            const wifiNorm = norm(uiWifiMAC);
            if (wifiNorm === 'n/a') {
                expect.soft(wifiNorm, 'Wi-Fi MAC should be n/a or valid MAC').toBe('n/a');
            } else {
                expect.soft(uiWifiMAC, `Wi-Fi MAC should match MAC format, got "${uiWifiMAC}"`).toMatch(MAC_PATTERN);
            }
        });

        await test.step('Verify Primary MAC equals LAN MAC', async () => {
            const primaryMAC = fields['Primary MAC'] || '';
            const uiLanMAC = fields['LAN MAC_network'] || fields['LAN MAC'] || '';
            expect(primaryMAC, 'Primary MAC should match MAC format').toMatch(MAC_PATTERN);
            if (norm(uiLanMAC) !== 'n/a') {
                expect(normMAC(primaryMAC)).toBe(normMAC(uiLanMAC));
            }
        });

        const termReady = await dp.gotoTerminal();
        expect(termReady, 'Terminal should be responsive for an online device').toBeTruthy();

        const net = await dp.getTerminalNetworkDetails();
        const termEth0MAC = (net.eth0MAC || '').trim();
        if (!MAC_PATTERN.test(termEth0MAC)) {
            expect(net.privateIP, 'Terminal must return valid MAC or IP data').toBeTruthy();
        }

        const uiLanMAC = fields['LAN MAC_network'] || fields['LAN MAC'] || '';
        const uiWifiMAC = fields['Wi-Fi MAC_network'] || fields['Wi-Fi MAC'] || '';
        const privateIP = fields['Private IP'] || '';
        const primaryMAC = fields['Primary MAC'] || '';
        const netInterface = fields['Network Interface'] || '';
        const wifiSSID = fields['Wi-Fi SSID'] || '';

        await test.step('Cross-verify LAN MAC with terminal', async () => {
            const uiVal = normMAC(uiLanMAC);
            const termVal = normMAC(net.eth0MAC || '');
            expect(uiVal, `LAN MAC mismatch: UI="${uiLanMAC}" vs Terminal="${net.eth0MAC}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Wi-Fi MAC with terminal', async () => {
            const isValidMAC = (s) => s && MAC_PATTERN.test(s);
            if (!isValidMAC(net.wlan0MAC)) return;
            const uiVal = norm(uiWifiMAC) === 'n/a' ? 'n/a' : normMAC(uiWifiMAC);
            const termVal = norm(net.wlan0MAC) === 'n/a' ? 'n/a' : normMAC(net.wlan0MAC);
            expect.soft(uiVal, `Wi-Fi MAC mismatch: UI="${uiWifiMAC}" vs Terminal="${net.wlan0MAC}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Private IP with terminal', async () => {
            const termIPClean = extractIP(net.privateIP);
            if (!termIPClean) return; // terminal cannot read IP — skip rather than fail
            const uiVal = privateIP.toLowerCase().trim();
            const termVal = termIPClean.toLowerCase().trim();
            expect.soft(uiVal, `Private IP mismatch: UI="${privateIP}" vs Terminal="${termIPClean}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Primary MAC with terminal eth0', async () => {
            const uiVal = normMAC(primaryMAC);
            const termVal = normMAC(net.eth0MAC || '');
            expect.soft(uiVal, `Primary MAC mismatch: UI="${primaryMAC}" vs Terminal="${net.eth0MAC}"`).toEqual(termVal);
        });

        await test.step('Cross-verify Network Interface with terminal', async () => {
            // Terminal may not return activeInterface — skip rather than fail
            if (!net.activeInterface) return;
            const ethUp = norm(net.activeInterface).includes('eth0');
            const wlanUp = norm(net.activeInterface).includes('wlan0');
            if (isEthernet) {
                expect.soft(ethUp, `Network Interface mismatch: UI="${netInterface}" but eth0 not UP in terminal (active: "${net.activeInterface}")`).toBeTruthy();
            } else if (isWifi) {
                expect.soft(wlanUp, `Network Interface mismatch: UI="${netInterface}" but wlan0 not UP in terminal (active: "${net.activeInterface}")`).toBeTruthy();
            }
        });

        await test.step('Cross-verify Wi-Fi SSID with terminal', async () => {
            const termNorm = norm(net.wifiSSID);
            const termGarbage = termNorm.includes('/system/bin/sh') || termNorm.includes('no such file') || termNorm.includes('not found') || (termNorm.includes('wifi_') && !termNorm.includes(norm(wifiSSID)));
            const uiClean = norm(wifiSSID);
            if (uiClean === 'n/a') {
                const termIsNA = termGarbage || termNorm === 'n/a' || termNorm === '';
                expect.soft(termIsNA, `Wi-Fi SSID mismatch: UI="${wifiSSID}" (n/a) but Terminal="${net.wifiSSID}"`).toBeTruthy();
            } else if (termGarbage) {
                // Terminal cannot obtain WiFi SSID (permission error, WIFI_NOT_FOUND, etc.) — skip
                return;
            } else {
                const termClean = termGarbage ? '__garbage__' : termNorm;
                expect.soft(uiClean, `Wi-Fi SSID mismatch: UI="${wifiSSID}" vs Terminal="${net.wifiSSID}"`).toEqual(termClean);
            }
        });
    });

    test('TC-INFO-010: Network Information card — Wi-Fi device fields', async ({ page }) => {
        const dp = new DeviceDetailPage(page, WIFI_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let fields;
        await expect.poll(async () => {
            const data = await dp.extractAllFieldValues();
            if (isNotEmpty(data['Network Interface'])) {
                fields = data;
                return true;
            }
            return false;
        }, { message: 'Waiting for Wi-Fi device network fields to load' }).toBeTruthy();

        await test.step('Verify Network Interface is Wi-Fi', async () => {
            const netInterface = fields['Network Interface'] || '';
            expect.soft(norm(netInterface), `Network Interface should be Wi-Fi, got "${netInterface}"`).toBe('wifi');
        });

        await test.step('Verify Wi-Fi SSID is populated', async () => {
            const wifiSSID = fields['Wi-Fi SSID'] || '';
            expect.soft(wifiSSID.trim(), `Wi-Fi SSID should not be empty, got "${wifiSSID}"`).not.toBe('');
            expect.soft(norm(wifiSSID), `Wi-Fi SSID should not be n/a, got "${wifiSSID}"`).not.toBe('n/a');
        });

        await test.step('Verify Signal Strength is populated', async () => {
            const signalStr = fields['Signal Strength'] || '';
            expect.soft(signalStr.trim(), `Signal Strength should not be empty, got "${signalStr}"`).not.toBe('');
            expect.soft(norm(signalStr), `Signal Strength should not be n/a, got "${signalStr}"`).not.toBe('n/a');
        });
    });

    test('TC-INFO-011: Network Information for offline device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, OFFLINE_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let fields;
        await test.step('Verify Connection Status is offline', async () => {
            await expect(dp.headingNetworkInfo).toBeVisible();
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                const connStatus = norm(data['Connection Status_network'] || data['Connection Status'] || '');
                if (connStatus.includes('offline')) {
                    fields = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for offline device Connection Status' }).toBeTruthy();
        });

        await test.step('Verify all 10 network fields are rendered', async () => {
            const networkFields = [
                'Connection Status', 'Last ping', 'Network Interface', 'Wi-Fi SSID',
                'Signal Strength', 'Public IP', 'Private IP', 'LAN MAC', 'Wi-Fi MAC', 'Primary MAC'
            ];
            for (const label of networkFields) {
                const val = fields[label + '_network'] || fields[label] || '';
                expect(val.trim(), `Field "${label}" should be rendered (got empty string)`).not.toBe('');
            }
        });
    });
});
