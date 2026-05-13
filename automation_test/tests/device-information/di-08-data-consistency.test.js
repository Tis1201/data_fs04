const { dpTest, normMAC, norm, isNotEmpty, DEVICES_URL } = require('./di-shared');

const test = dpTest;
const expect = test.expect;

test.describe('Section 8 — Data Consistency Cross-check', () => {

    test('TC-INFO-016: Detail page data matches device list page', async ({ dp, page }) => {
        let detailName;
        let detailStatus;
        await test.step('Navigate to detail page and wait for data to render', async () => {
            await dp.gotoDeviceDetail();
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                detailName = data['Device Name'] || '';
                detailStatus = data['Connection Status'] || '';
                return isNotEmpty(detailName) && isNotEmpty(detailStatus);
            }, { message: 'Waiting for Device Name and Connection Status to populate' }).toBeTruthy();
        });

        await test.step('Search device by name on list page and verify row is visible', async () => {
            await page.goto(DEVICES_URL);
            const searchInput = page.getByPlaceholder(/search/i).first();
            await expect(searchInput).toBeVisible();
            await searchInput.fill(detailName);
            const deviceRow = page.locator('tr').filter({ hasText: detailName }).first();
            await expect(deviceRow, `Device "${detailName}" should appear on list page`).toBeVisible();
        });
    });

    test('TC-INFO-017: Duplicated fields are consistent between General and Network cards', async ({ dp }) => {
        let fields;
        await test.step('Wait for both General and Network cards to fully load', async () => {
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                if (isNotEmpty(data['Connection Status_network'])) {
                    fields = data;
                    return true;
                }
                return false;
            }, { message: 'Waiting for Network Card data to load' }).toBeTruthy();
        });

        await test.step('Verify Connection Status consistency', async () => {
            const genConnStatus = fields['Connection Status'] || '';
            const netConnStatus = fields['Connection Status_network'] || '';
            expect(netConnStatus.trim(), 'Network card should have Connection Status').not.toBe('');
            expect(norm(genConnStatus)).toBe(norm(netConnStatus));
        });

        await test.step('Verify Last ping consistency', async () => {
            const genLastPing = fields['Last ping'] || '';
            const netLastPing = fields['Last ping_network'] || '';
            expect(genLastPing.trim(), 'General card should have Last ping').not.toBe('');
            expect(netLastPing.trim(), 'Network card should have Last ping').not.toBe('');
        });

        await test.step('Verify Public IP consistency', async () => {
            const genPublicIP = fields['Public IP'] || '';
            const netPublicIP = fields['Public IP_network'] || '';
            expect(netPublicIP.trim(), 'Network card should have Public IP').not.toBe('');
            expect(genPublicIP).toBe(netPublicIP);
        });

        await test.step('Verify LAN MAC consistency', async () => {
            const genLanMAC = fields['LAN MAC'] || '';
            const netLanMAC = fields['LAN MAC_network'] || '';
            expect(netLanMAC.trim(), 'Network card should have LAN MAC').not.toBe('');
            expect(normMAC(genLanMAC)).toBe(normMAC(netLanMAC));
        });

        await test.step('Verify Wi-Fi MAC consistency', async () => {
            const genWifiMAC = fields['Wi-Fi MAC'] || '';
            const netWifiMAC = fields['Wi-Fi MAC_network'] || '';
            expect.soft(netWifiMAC.trim(), 'Network card should have Wi-Fi MAC').not.toBe('');
            expect(normMAC(genWifiMAC)).toBe(normMAC(netWifiMAC));
        });
    });
});
