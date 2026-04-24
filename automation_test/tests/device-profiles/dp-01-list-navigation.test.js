const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/iot/device-profile-page');
const { authFile, PROFILE_WITH_DEVICES_NAME } = require('./dp-shared');

// Rule 11.1 & 16.2: Use Fixture to initialize shared POM
const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await dp.gotoList();
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 1 — List Page Load & Navigation', () => {

    test('TC-DP-001: Profile list page loads with correct structure and data', async ({ dp }) => {
        await test.step('Verify basic UI elements visibility', async () => {
            await expect(dp.bannerHeading).toBeVisible();
            await expect(dp.bannerSubtitle).toBeVisible();
            await expect(dp.searchInput).toBeVisible();
            await expect(dp.addProfileButton).toBeEnabled();
            await expect(dp.table).toBeVisible();
        });

        await test.step('Verify table columns are correct', async () => {
            // Rule 9.2: Check text array in one go instead of using a loop
            const expectedColumns = ['Name', 'Assigned Devices', 'Created On', 'Status', 'Actions'];
            // Rule 4.4: Use locators from POM instead of hardcoded page.locator
            await expect(dp.tableHeaders).toContainText(expectedColumns);
        });

        await test.step('Verify profile data exists and pagination format', async () => {
            // Rule 3.1: Wait for the first row to appear (ensure table has finished rendering data)
            const firstRow = dp.table.locator('tbody tr').first();
            await expect(firstRow).toBeVisible();

            // Rule 3.1 & 19.6: Use Web-first Assertions instead of pure JS logic (drop .trim().length)
            await expect(firstRow.locator('td').first()).not.toBeEmpty();

            // Rule 3.1 & 4.4: Use Web-first Regex assertion and locators from POM
            await expect(dp.paginationDetails).toHaveText(/\d+\s*-\s*\d+\s+of\s+\d+/i);
        });
    });

    test('TC-DP-002: Profile name link and Actions menu navigation', async ({ page, dp }) => {
        await test.step('Navigate to detail page via Profile Name link', async () => {
            await dp.ensureProfileVisible(PROFILE_WITH_DEVICES_NAME);
            const nameLink = dp.profileNameLink(PROFILE_WITH_DEVICES_NAME);
            
            await expect(nameLink).toBeVisible();
            await nameLink.click();
            
            // Rule 3.1: Web-first URL assertion
            await expect(page).toHaveURL(/.*\/device-profiles\/.*/);
        });

        await test.step('Return to list and verify Action menu items', async () => {
            await page.goBack();
            
            // Rule 19.7: Drop waitForLoadState, use UI assertion
            await expect(dp.table).toBeVisible();
            
            await dp.ensureProfileVisible(PROFILE_WITH_DEVICES_NAME);
            await dp.clickActionsMenu(PROFILE_WITH_DEVICES_NAME);

            // Rule 13.3: Group independent assertions into Promise.all for faster test execution
            await Promise.all([
                expect(dp.menuItemByName('View')).toBeVisible(),
                expect(dp.menuItemByName('Edit')).toBeVisible(),
                expect(dp.menuItemByName('Delete')).toBeVisible()
            ]);
        });

        await test.step('Navigate to detail page via View action', async () => {
            await dp.menuItemByName('View').click();
            await expect(page).toHaveURL(/.*\/device-profiles\/.*/);
        });
    });
});
