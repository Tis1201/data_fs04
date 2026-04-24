const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const {
    cleanupProfile,
    cleanupAutoTestProfiles,
} = require('../../utils/device-profiles-helpers');
const {
    authFile,
    PROFILE_WITH_DEVICES_ID,
} = require('./dp-shared');

// Rule 11.1: Use Fixture
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 14 — Edge Cases', () => {

    test('TC-DP-021: Long profile name (50 chars max) display', async ({ dp, page }) => {
        const longName = 'A'.repeat(50);
        try {
            await test.step('Create profile with long name', async () => {
                await dp.gotoList();
                await dp.openAddProfileModal();
                await dp.fillProfileName(longName);
                await dp.addSubmitButton.click();

                // Rule 13 & 18: Remove Promise.all() and NodeJS waitFor. Use Web-First Assertion!
                await expect(dp.toast).toBeVisible({ timeout: 10000 });
                await expect(dp.addEditModalBase, 'Modal must close').toBeHidden({ timeout: 10000 });
            });

            await test.step('Verify long name in table', async () => {
                await dp.gotoList();
                // Rule 18 #1: Assert visibility
                await expect(dp.profileRowByName(longName), '50-char profile name should be visible in table').toBeVisible();
            });
        } finally {
            // Rule 15.6: Catch errors if cleanup failed
            await cleanupProfile(dp, longName).catch(e => console.error(`TC-DP-021 cleanup failed: ${e.message}`));
        }
    });

    test('TC-DP-022: Special characters and XSS prevention', async ({ dp, page }) => {
        const xssName = '<script>alert("x")</script>';
        try {
            await test.step('Create profile with XSS string', async () => {
                await dp.gotoList();
                await dp.openAddProfileModal();
                await dp.fillProfileName(xssName);
                await dp.addSubmitButton.click();

                // Remove messy if (!modalStillOpen) checks
                await expect(dp.toast, 'Toast must appear').toBeVisible({ timeout: 10000 });
                await expect(dp.addEditModalBase, 'Modal must close safely').toBeHidden({ timeout: 10000 });
            });

            await test.step('Verify plain text rendering in table', async () => {
                await dp.gotoList();
                
                // Rule 18 #8: Find the correct row with the XSS String. If Playwright's selector (textContent) finds it,
                // it proves the DOM rendered it as an escaped plain string rather than executing it as a script tag.
                const row = dp.profileRowByName(xssName);
                await expect(row, 'XSS profile name should be visible as escaped plain text').toBeVisible();
            });
        } finally {
            await cleanupProfile(dp, xssName).catch(e => console.error(`TC-DP-022 cleanup failed: ${e.message}`));
        }
    });

    test('TC-DP-023: Tab switching URL state and browser refresh', async ({ dp, page }) => {
        await test.step('Verify initial URL', async () => {
            await dp.gotoDetail(PROFILE_WITH_DEVICES_ID);
            // Rule 3.1: Convert JS expect(page.url()) to Playwright toHaveURL()
            await expect(page).toHaveURL(/tab=configuration/);
        });

        await test.step('Switch tabs and verify URL update', async () => {
            await dp.switchToTab('devices');
            await expect(page).toHaveURL(/tab=devices/);

            await dp.switchToTab('configuration');
            await expect(page).toHaveURL(/tab=configuration/);
        });

        await test.step('Verify state retention after reload', async () => {
            await dp.switchToTab('devices');
            await expect(page).toHaveURL(/tab=devices/);
            
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            // Tab state must be preserved
            await expect(page).toHaveURL(/tab=devices/);
        });
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    // Rule 15.6: Catch errors in global hook
    try { 
        await cleanupAutoTestProfiles(page).catch(e => console.error(`AfterAll cleanup failed: ${e.message}`)); 
    } finally { 
        await context.close(); 
    }
});
