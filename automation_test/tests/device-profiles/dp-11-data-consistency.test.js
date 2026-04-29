const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const {
    crossVerifyBrightnessVolume,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
    PROFILE_WITH_DEVICES_NAME,
} = require('./dp-shared');

// Rule 11.1: Use Fixture to cleanly reuse POM
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await use(dp);
    }
});

const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 13 — Data Consistency', () => {

    test('TC-DP-020: List page data, detail page, config tab, and edit modal are consistent', async ({ dp, page }) => {
        let listStatus = '';

        await test.step('Step 1: Read status from List page', async () => {
            await dp.gotoList();
            await dp.ensureProfileVisible(PROFILE_WITH_DEVICES_NAME);

            const row = dp.profileRowByName(PROFILE_WITH_DEVICES_NAME);
            await expect(row, 'Profile should be visible in list').toBeVisible();

            const badge = dp.rowBadge(row).first();
            
            // STANDARDIZATION: Use Web-first assertion to wait for API to finish rendering badge content
            await expect(badge, 'List should have a status badge').not.toBeEmpty();
            
            // Only after confirming there is text, proceed to extract it into a variable
            listStatus = await badge.textContent();
        });

        await test.step('Step 2: Verify Detail page overview is consistent', async () => {
            // Assumes your POM's gotoDetail function supports passing an ID
            await dp.gotoDetail(PROFILE_WITH_DEVICES_ID);
            
            // Compare Status from List page
            await expect(dp.overviewStatus).toHaveText(listStatus.trim());
            await expect(dp.overviewProfileName).toContainText(PROFILE_WITH_DEVICES_NAME);
        });

        await test.step('Step 3: Verify Configuration values against Edit Modal', async () => {
            await dp.switchToTab('configuration');
            
            // Get data from config tab (ensure config tab has finished rendering before extracting)
            await expect(dp.configCard).toBeVisible(); 
            const configValues = await dp.extractConfigTabValues();

            await dp.editSetButton.click();
            await expect(dp.addEditModalBase).toBeVisible();

            // VERY IMPORTANT: This Web-first line forces Playwright to wait
            // until the Edit Form finishes loading data from the backend, preventing empty data extraction.
            await expect(dp.profileNameInput).toHaveValue(PROFILE_WITH_DEVICES_NAME);
            
            // Safely extract data after the form has stabilized
            const modalValues = await dp.extractEditModalValues();
            await dp.closeModal();

            // Use helper function
            crossVerifyBrightnessVolume(configValues, modalValues);
        });
    });
});
