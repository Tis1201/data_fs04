const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    cleanupProfile,
    createProfileViaModal,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    PROFILE_WITH_DEVICES_NAME,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

// Restore Fixture to keep code DRY!
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await dp.gotoList();
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 6 — Delete Profile', () => {

    test('TC-DP-009: Delete profile — confirmation and success', async ({ dp }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'del');
        
        await test.step('Setup: Create a temporary profile to delete', async () => {
            // Note: If there's an API, change this createProfileViaModal function to API Request
            await createProfileViaModal(dp, profileName);
            await dp.gotoList();
        });

        try {
            await test.step('Open delete confirmation modal', async () => {
                await dp.clickActionsMenu(profileName);
                await dp.clickActionItem('Delete');
                
                // Rule 3.1: Use Web-first assertion (Auto-wait + Verify)
                await expect(dp.deleteModalBase, 'Delete modal should be visible').toBeVisible();
                await expect(dp.deleteModalBase, 'Delete modal should contain warning text').toContainText('can not be reverse');
            });

            await test.step('Confirm deletion and verify removal', async () => {
                await dp.deleteConfirmButton.click();
                
                // Rule 3.1: Wait for Modal to disappear
                await expect(dp.deleteModalBase).toBeHidden();
                
                // Wait for success Toast
                await dp.waitForSuccessToast();
                
                // Ensure the data row has vanished from DOM
                await expect(dp.profileRowByName(profileName), 'Profile should be removed after delete').toBeHidden();
            });
        } finally {
            await test.step('Safety cleanup', async () => {
                // Rule 15.2: Try/catch to handle teardown errors in case test already deleted successfully
                await cleanupProfile(dp, profileName).catch(e => console.error(`Teardown failed/ignored: ${e.message}`));
            });
        }
    });

    test('TC-DP-010: Cancel delete — profile remains', async ({ dp }) => {
        await test.step('Open delete modal for an existing profile', async () => {
            // Using static data (Read-only) is very safe
            await dp.clickActionsMenu(PROFILE_WITH_DEVICES_NAME);
            await dp.clickActionItem('Delete');
            await expect(dp.deleteModalBase).toBeVisible();
        });

        await test.step('Cancel deletion and verify profile remains', async () => {
            await dp.deleteCancelButton.click();
            await expect(dp.deleteModalBase).toBeHidden();

            // Ensure the data row is not lost
            await expect(dp.profileRowByName(PROFILE_WITH_DEVICES_NAME), 'Profile should still be visible after cancel delete').toBeVisible();
        });
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try { await cleanupAutoTestProfiles(page); } finally { await context.close(); }
});
