const { test, expect } = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
    PROFILE_URL,
    INVALID_PROFILE_ID,
} = require('./dp-shared');

test.use({ storageState: authFile });

test.describe('Section 7 — Profile Detail Page — Overview Card', () => {

    test('TC-DP-011: Detail page loads with structure and overview data', async ({ page }) => {
        const dp = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);

        await test.step('Navigate to profile detail page', async () => {
            await dp.gotoDetail();
        });

        await test.step('Verify basic UI structure is visible', async () => {
            await expect(dp.detailBannerHeading).toBeVisible();
            await expect(dp.editSetButton).toBeEnabled(); 
            await expect(dp.overviewCard).toBeVisible();
            await expect(dp.tabConfiguration).toBeVisible();
            await expect(dp.tabAssignedDevices).toBeVisible();
        });

        await test.step('Verify overview data is loaded correctly', async () => {
            await expect(dp.overviewCard).toContainText(/Active|Inactive/i);
            await expect(dp.overviewCreatedAt).toBeVisible();
        });
    });

    test('TC-DP-012: Invalid profile ID shows error', async ({ page }) => {
        const dp = new DeviceProfilePage(page);

        await test.step('Navigate directly to URL with invalid ID', async () => {
            await page.goto(`${PROFILE_URL}/${INVALID_PROFILE_ID}`);
        });

        await test.step('Verify system handles invalid ID according to specs', async () => {
            // Because our UI displays 'Not Found' either directly globally or within a div
            await expect(page.getByText(/something went wrong|error/i).first(), 'Invalid profile ID should show an error message').toBeVisible();
        });
    });
});
