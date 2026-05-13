const base = require('@playwright/test');
const { authFile, ETHERNET_DEVICE_ID, createRestoreState } = require('./di-shared');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');

const test = base.test;
const expect = test.expect;

test.describe('Section 10 — Edge Cases', () => {
    test.use({ storageState: authFile });
    test.describe.configure({ mode: 'serial' });

    const { setOriginalDeviceName, beforeAllCapture, afterEachRestore } = createRestoreState();

    test.beforeAll(beforeAllCapture);
    test.afterEach(afterEachRestore);

    test('TC-INFO-020: Long name and special characters display correctly (XSS prevention)', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        await test.step('Capture original name safely', async () => {
            const fieldsBefore = await dp.extractAllFieldValues();
            setOriginalDeviceName(fieldsBefore['Device Name'] || '');
        });

        await test.step('Input XSS string and save', async () => {
            // Listen for dialog events: if the app is vulnerable to XSS and fires an alert, the test will fail immediately!
            page.on('dialog', dialog => {
                throw new Error(`CRITICAL VULNERABILITY: XSS payload executed! Dialog message: ${dialog.message()}`);
            });

            await dp.editDeviceButton.click();
            await expect(dp.modal).toBeVisible({ timeout: 30000 });

            const xssString = '<script>alert("xss")</script> <h1>Test</h1>';
            const nameInput = dp.modal.locator('input').first();
            await nameInput.clear();
            await nameInput.fill(xssString);

            const saveBtn = dp.modal.getByRole('button', { name: /Save|Update|Submit/i }).first();

            // Wait for API response when saving
            const [response] = await Promise.all([
                page.waitForResponse(res => res.url().includes('/devices/') && res.status() === 200),
                saveBtn.click()
            ]);
            await expect(dp.modal).toBeHidden();
        });

        await test.step('Verify page renders safely without executing script', async () => {
            const xssString = '<script>alert("xss")</script> <h1>Test</h1>';
            
            // IF SAFE: The XSS string should be rendered as plain text on screen (properly escaped)
            await expect.poll(async () => {
                const fields = await dp.extractAllFieldValues();
                return fields['Device Name'];
            }, { message: 'Wait for UI to render new device name' }).toBe(xssString);
        });
    });

    test('TC-INFO-021: Page displays correctly after browser refresh', async ({ page }) => {
        const dp = new DeviceDetailPage(page, ETHERNET_DEVICE_ID);
        await dp.gotoDeviceDetail();

        let nameBefore, ipBefore;
        
        await test.step('Capture data before refresh (using Poll for safety)', async () => {
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                if (data['Device Name'] && (data['Public IP'] || data['Public IP_network'])) {
                    nameBefore = data['Device Name'];
                    ipBefore = data['Public IP'] || data['Public IP_network'];
                    return true;
                }
                return false;
            }, { message: 'Wait for data before reload' }).toBeTruthy();
        });

        await test.step('Reload page and verify data persisted', async () => {
            await page.reload();
            
            // BỎ networkidle. Thay bằng việc chờ đúng 2 biến lúc nãy hiện lại trên màn hình
            await expect.poll(async () => {
                const data = await dp.extractAllFieldValues();
                const nameAfter = data['Device Name'] || '';
                const ipAfter = data['Public IP'] || data['Public IP_network'] || '';
                
                return nameAfter === nameBefore && ipAfter === ipBefore;
            }, { message: 'Wait for UI to render same data after refresh' }).toBeTruthy();
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
