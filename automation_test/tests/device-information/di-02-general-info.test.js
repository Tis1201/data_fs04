const {
    dpTest, norm, isNotEmpty, MAC_PATTERN, IP_PATTERN, OFFLINE_DEVICE_ID,
} = require('./di-shared');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');

const test = dpTest;
const expect = test.expect;

test.describe('Section 2 — General Info Panel', () => {

    test('TC-INFO-004: General card displays all fields with correct format for online device', async ({ dp }) => {
        await test.step('Verify General heading is visible', async () => {
            await expect(dp.headingGeneral).toBeVisible();
        });

        await test.step('Verify Connection Status is online', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return norm(fields['Connection Status'] || '');
            }, { message: 'Connection Status should contain "online"' }).toContain('online');
        });

        await test.step('Verify Last ping is not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return (fields['Last ping'] || '').trim().length;
            }, { message: 'Last ping should not be empty' }).toBeGreaterThan(0);
        });

        await test.step('Verify Public IP format', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return fields['Public IP'] || '';
            }, { message: 'Public IP should match IPv4 format' }).toMatch(IP_PATTERN);
        });

        await test.step('Verify LAN MAC format', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return fields['LAN MAC'] || '';
            }, { message: 'LAN MAC should match MAC format' }).toMatch(MAC_PATTERN);
        });

        await test.step('Verify Wi-Fi MAC format', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                const wifiMAC = fields['Wi-Fi MAC'] || '';
                return MAC_PATTERN.test(wifiMAC) || norm(wifiMAC) === 'n/a';
            }, { message: 'Wi-Fi MAC should match MAC format or be n/a' }).toBeTruthy();
        });
    });

    test('TC-INFO-005: General card displays correctly for offline device', async ({ page }) => {
        const dp = new DeviceDetailPage(page, OFFLINE_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Verify General heading and Connection Status is offline', async () => {
            await expect(dp.headingGeneral).toBeVisible();
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return norm(fields['Connection Status'] || '');
            }, { message: 'Connection Status should contain "offline"' }).toContain('offline');
        });

        await test.step('Verify Public IP is not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return isNotEmpty(fields['Public IP'] || '');
            }, { message: 'Public IP should not be empty' }).toBeTruthy();
        });

        await test.step('Verify Last ping is not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return isNotEmpty(fields['Last ping'] || '');
            }, { message: 'Last ping should not be empty' }).toBeTruthy();
        });

        await test.step('Verify LAN MAC and Wi-Fi MAC are not empty', async () => {
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return isNotEmpty(fields['LAN MAC'] || '') && isNotEmpty(fields['Wi-Fi MAC'] || '');
            }, { message: 'LAN MAC and Wi-Fi MAC should not be empty' }).toBeTruthy();
        });
    });
});
