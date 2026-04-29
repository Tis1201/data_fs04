const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const { cleanupProfile, cleanupAutoTestProfiles } = require('../../utils/device-profiles-helpers');
const { authFile, PROFILE_WITH_DEVICES_NAME, generateTestProfileNameWithSuffix } = require('./dp-shared');

// Rule 11.1: Restore the mighty Fixture!
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await dp.gotoList();
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 4 — Add Profile (Create)', () => {

    test('TC-DP-004: Add Profile modal — default values and character counters', async ({ dp }) => {
        await test.step('Open modal and verify default empty states', async () => {
            await dp.openAddProfileModal();
            await expect(dp.modal, 'Add Profile modal should be visible').toBeVisible();
            
            // Rule 3.1: Use Web-first Assertions
            await expect(dp.modalTitle).toContainText('Add Profile');
            await expect(dp.profileNameInput).toBeEmpty();
            await expect(dp.descriptionTextarea).toBeEmpty();
            
            await expect(dp.cancelButton).toBeVisible();
            await expect(dp.addSubmitButton).toBeVisible();
        });

        await test.step('Verify character counter updates when typing', async () => {
            // Assume the logic is "0/50" or just the current count
            const initialCount = await dp.nameCharCount.textContent();
            
            await dp.fillProfileName('Test counter');
            
            // Use .not.toHaveText instead of JS string comparison
            await expect(dp.nameCharCount).not.toHaveText(initialCount);
        });

        await dp.closeModal();
    });

    test('TC-DP-005: Create profile with name and description', async ({ dp }) => {
        const profileName = generateTestProfileNameWithSuffix('AutoTest', 'full');
        
        try {
            await test.step('Fill form and submit', async () => {
                await dp.openAddProfileModal();
                await dp.fillProfileName(profileName);
                await dp.descriptionTextarea.fill('Full config test description');
                await dp.clickModalSubmit();
            });

            await test.step('Verify success toast and data in table', async () => {
                // Assume this function returns a toast locator or waits for toast
                await dp.waitForSuccessToast(); 
                
                // Assert directly on the table row (Playwright will automatically poll and wait for the row to appear)
                const row = dp.profileRowByName(profileName);
                await expect(row).toBeVisible();
            });
        } finally {
            await test.step('Cleanup created profile', async () => {
                // Rule 15.2: Catch teardown errors to avoid crashing the test runner
                await cleanupProfile(dp, profileName).catch(e => console.error(`Cleanup error: ${e.message}`));
            });
        }
    });

    // SPLIT PER RULE 19.2: Each Test Case checks only 1 type of Validation
    test.describe('TC-DP-006: Form Validations', () => {
        
        test('TC-DP-006a: Validation — Prevent submission with empty name', async ({ dp }) => {
            await dp.openAddProfileModal();
            await dp.profileNameInput.clear();
            
            // Try to Submit
            await dp.addSubmitButton.click();
            
            // Rule 19.7: Drop waitForLoadState('domcontentloaded').
            // Assert directly: Modal should still be open OR error text "Required" should appear
            await expect(dp.modal).toBeVisible();
            // If your UI has red text "Name is required", assert it:
            // await expect(page.getByText('Name is required')).toBeVisible();
            
            await dp.closeModal();
        });

        test('TC-DP-006b: Validation — Name input enforces max length of 50 chars', async ({ dp }) => {
            await dp.openAddProfileModal();
            
            // Intentionally type 51 characters
            const overLimitText = 'A'.repeat(51);
            await dp.profileNameInput.fill(overLimitText);
            
            // Rule 3.1: Playwright will verify whether the input is correctly capped at 50 characters
            const expectedCappedText = 'A'.repeat(50);
            await expect(dp.profileNameInput).toHaveValue(expectedCappedText);
            
            await dp.closeModal();
        });

        test('TC-DP-006c: Validation — Prevent duplicate profile name', async ({ dp }) => {
            await dp.openAddProfileModal();
            
            // Intentionally create a name that already exists in the DB (PROFILE_WITH_DEVICES_NAME)
            await dp.profileNameInput.fill(PROFILE_WITH_DEVICES_NAME.toLowerCase());
            await dp.addSubmitButton.click();
            
            // Wait for error Toast
            await dp.waitForErrorToast();
            
            // Ensure the Modal is not closed (user can edit the text to submit again)
            await expect(dp.modal).toBeVisible();
            
            await dp.closeModal();
        });
    });
});

// Rule 17.7: Excellent safety net! Keep as is.
test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try { 
        await cleanupAutoTestProfiles(page); 
    } finally { 
        await context.close(); 
    }
});
