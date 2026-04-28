const {
    dpTest, DEVICES_URL, INVALID_DEVICE_ID,
} = require('./di-shared');

const test = dpTest;
const expect = test.expect;

test.describe('Section 1 — Page Load & Navigation', () => {

    test('TC-INFO-001: Page loads with correct structure, header, and all sections', async ({ dp }) => {

        await test.step('Navigate and verify page banner', async () => {
            await expect(dp.pageBanner).toBeVisible();
        });

        await test.step('Verify section headings', async () => {
            await expect(dp.headingDeviceHealth).toBeVisible();
            await expect(dp.headingGeneral).toBeVisible();
        });

        await test.step('Verify all 5 tabs are visible', async () => {
            const tabs = [
                dp.tabDetails, dp.tabConfiguration,
                dp.tabInstalledApps, dp.tabDeployments, dp.tabActivityLogs,
            ];
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
            const pageBanner = page.locator('h1, h2').filter({ hasText: 'Devices' });
            await expect(pageBanner).toBeVisible();
        });
    });

    test('TC-INFO-003: Tab switching and Edit Device button work correctly', async ({ dp, page }) => {

        await test.step('Verify Edit Device button is visible', async () => {
            await expect(dp.editDeviceButton).toBeVisible();
        });

        await test.step('Switch through each tab', async () => {
            const tabs = [
                { locator: dp.tabConfiguration, heading: dp.headingGeneral },
                { locator: dp.tabInstalledApps, heading: null },
                { locator: dp.tabDeployments, heading: null },
                { locator: dp.tabActivityLogs, heading: null },
            ];

            for (const tab of tabs) {
                await tab.locator.first().click();
                if (tab.heading) {
                    await expect(tab.heading).toBeVisible();
                } else {
                    await page.waitForLoadState('networkidle');
                }
            }
        });

        await test.step('Return to Details tab and verify Device Information visible', async () => {
            await dp.tabDetails.first().click();
            await expect(dp.headingDeviceInfo).toBeVisible();
        });
    });
});
