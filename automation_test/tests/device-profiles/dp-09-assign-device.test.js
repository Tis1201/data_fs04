const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    cleanupProfile,
    createProfileAndNavigateToDetail,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    generateTestProfileNameWithSuffix,
} = require('./dp-shared');

// Rule 11.1: Reuse the divine Fixture to keep code DRY
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        // In this scenario, we don't need gotoList or gotoDetail inside the fixture
        // because the test will call createProfileAndNavigateToDetail internally.
        // Just initializing the instance is enough.
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 10 — Assign Device to Profile', () => {

    test('TC-DP-018: Assign by tag — edge cases (no match, cancel, disabled button)', async ({ page, dp }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'tag_edge');

        try {
            await test.step('Create profile and navigate to devices tab', async () => {
                await createProfileAndNavigateToDetail(dp, page, profileName, 'devices');
            });

            await test.step('Case 1: No match when searching for tags', async () => {
                await dp.assignByTagButton.click();
                await expect(dp.assignModalBase, 'Assign by tag modal must open').toBeVisible();
                
                // Type a non-existent tag
                await dp.assignModalSearchInput.fill('nonexistent-tag-xyz');
                
                // Rule 19.1: Must assert the system's response!
                // Instead of asserting a specific message (since we don't know the exact UI copy),
                // we'll assert that the tag list is empty (no results found).
                await expect(dp.assignModalTagListItems, 'Tag list should be empty on no match').toHaveCount(0);
                
                await page.keyboard.press('Escape');
                await expect(dp.assignModalBase).toBeHidden();
            });

            await test.step('Case 2: Cancel assignment', async () => {
                await dp.assignByTagButton.click();
                await expect(dp.assignModalBase).toBeVisible();

                await expect(dp.assignModalCancelButton).toBeVisible();
                await dp.assignModalCancelButton.click();
                
                await expect(dp.assignModalBase, 'Modal must hide after clicking Cancel').toBeHidden();
            });

            await test.step('Case 3: Assign button is disabled when no tags selected', async () => {
                await dp.assignByTagButton.click();
                await expect(dp.assignModalBase).toBeVisible();

                // The Submit button must always exist, but in a disabled state
                await expect(dp.assignModalSubmitButton).toBeVisible();
                await expect(dp.assignModalSubmitButton, 'Assign button should be disabled natively').toBeDisabled();

                await page.keyboard.press('Escape');
            });
            
        } finally {
            await test.step('Safety cleanup', async () => {
                // Rule 15.2: Catch errors if cleanup fails
                await cleanupProfile(dp, profileName).catch(e => console.error(`Teardown failed: ${e.message}`));
            });
        }
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try { 
        // Rule 15.6: Catch errors and log them instead of swallowing or crashing the hook
        await cleanupAutoTestProfiles(page).catch(e => console.error(`AfterAll cleanup AutoTest failed: ${e.message}`)); 
    } finally { 
        await context.close(); 
    }
});
