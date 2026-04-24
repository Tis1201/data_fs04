const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const { authFile, PROFILE_WITH_DEVICES_ID } = require('./dp-shared');

const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page, PROFILE_WITH_DEVICES_ID);
        await dp.gotoDetail();
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 8 — Configuration Tab', () => {

    test('TC-DP-013: All configuration settings displayed correctly', async ({ dp }) => {
        await test.step('Verify configuration card is visible', async () => {
            await expect(dp.configCard).toBeVisible();
        });

        await test.step('Verify configuration fields are not empty directly on UI', async () => {
            const expectedLabels = [
                'Kiosk Lock Mode', 'Kiosk Application',
                'Display Resolution', 'Screen Orientation', 'Brightness Level',
                'Timezone', 'Power Management Schedule'
            ];

            // Rule 3.1: Use Web-first Assertion to check directly on DOM
            // Playwright will automatically wait until these fields have data
            for (const label of expectedLabels) {
                // Use dp.getConfigValueLocator(label) configured in POM
                const valueLocator = dp.getConfigValueLocator(label);
                await expect.soft(valueLocator, `${label} should not be empty`).not.toBeEmpty();
            }

            // Verify Badge directly using Regex on Locator text
            const scheduleLocator = dp.getConfigValueLocator('Power Management Schedule');
            await expect.soft(scheduleLocator).toHaveText(/enabled|disabled/i);
        });

        await test.step('Cross-verify Config Tab values with Edit Modal', async () => {
            // Read Text directly on current UI before opening Modal (Playwright auto-waits)
            const brightnessOnTab = await dp.getConfigValueLocator('Brightness Level').textContent();
            
            await dp.editSetButton.click();
            await expect(dp.addEditModalBase).toBeVisible();

            // Compare the Input value in Modal directly with the value just read
            await expect(dp.brightnessSlider).toHaveValue(brightnessOnTab.replace('%', '').trim());
            
            await dp.closeModal();
            await expect(dp.addEditModalBase).toBeHidden();
        });
    });

    test('TC-DP-014: Configuration reflects updated settings after edit', async ({ dp }) => {
        let originalBrightness;
        let testBrightness;

        await test.step('Read current config values before edit', async () => {
            // Get current value (ensure text is displayed before reading)
            const brightnessLoc = dp.getConfigValueLocator('Brightness Level');
            await expect(brightnessLoc).not.toBeEmpty();
            
            originalBrightness = await brightnessLoc.textContent();
            originalBrightness = originalBrightness.replace('%', '').trim();
            testBrightness = originalBrightness === '50' ? '70' : '50';
        });

        try {
            await test.step('Open edit modal and change brightness', async () => {
                await dp.editSetButton.click();
                await expect(dp.addEditModalBase).toBeVisible();
                
                await dp.brightnessSlider.fill(testBrightness);
                await dp.saveButton.click();
                await expect(dp.addEditModalBase).toBeHidden();
            });

            await test.step('Verify brightness updated in config tab', async () => {
                // Rule 18 #12: Drop expect.poll! Web-first assertion is designed for this.
                // It will continuously poll the DOM until the text changes to testBrightness (max 5s/10s)
                const brightnessLoc = dp.getConfigValueLocator('Brightness Level');
                await expect(brightnessLoc).toContainText(testBrightness);
            });
        } finally {
            await test.step('Safety cleanup: Restore original brightness', async () => {
                // Keep the Try/Catch block to protect the Teardown flow
                try {
                    await dp.editSetButton.click();
                    await expect(dp.addEditModalBase).toBeVisible();
                    await dp.brightnessSlider.fill(originalBrightness);
                    await dp.saveButton.click();
                    await expect(dp.addEditModalBase).toBeHidden();
                } catch (restoreErr) {
                    console.error(`TC-DP-014 restore failed: ${restoreErr.message}`);
                    await dp.closeModal().catch(() => {}); // Need to close modal if stuck
                }
            });
        }
    });
});
