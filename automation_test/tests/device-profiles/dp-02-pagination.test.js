const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const { authFile, generateTestProfileNameWithSuffix } = require('./dp-shared');
const { createProfileViaModal, cleanupProfile } = require('../../utils/device-profiles-helpers');

const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await dp.gotoList();
        await use(dp);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 3 — Pagination', () => {

    test('TC-DP-003a: Pagination buttons are disabled/hidden on single page', async ({ dp }) => {
        await test.step('Search for a unique string to ensure <= 1 record', async () => {
            // Great processing phase: Ensure the table has only 0 or 1 rows
            await dp.searchFor('AutoTest_SinglePage_' + Date.now());
            
            // Rule 3.1: Use Web-first assertion to wait for table filtering to complete.
            // Since Playwright does not support toHaveCount(<=1), we use expect().toPass() for a similar auto-retry mechanism.
            // (The table may return 0 rows, or 1 row containing the text "No data found").
            await expect(async () => {
                expect(await dp.tableRows.count()).toBeLessThanOrEqual(1);
            }).toPass({ timeout: 5000 });
        });

        await test.step('Verify pagination info and buttons behavior', async () => {
            // IF SPECS ARE: "If there is only 1 page, hide the pagination bar entirely", then use:
            await expect(dp.paginationDetails, 'Pagination text should be hidden').toBeHidden();
            await expect(dp.paginationNextBtn, 'Next button should be hidden').toBeHidden();
            await expect(dp.paginationPrevBtn, 'Prev button should be hidden').toBeHidden();
        });
    });

    test('TC-DP-003b: Pagination navigates correctly on multiple pages', async ({ page, dp, request }) => {
        const tempProfiles = [];
        
        // ALWAYS WRAP IN TRY/FINALLY TO PROTECT THE DATABASE
        try {
            await test.step('Ensure there is enough data for multiple pages (>10 records)', async () => {
                await dp.clearSearch();
                
                // Extract current count
                const paginationText = await dp.paginationDetails.textContent();
                const match = paginationText.match(/of\s+(\d+)/i);
                const totalRecords = match ? parseInt(match[1], 10) : 0;
                
                if (totalRecords <= 10) {
                    const needed = 11 - totalRecords; // Create enough to reach page 2
                    
                    // RECOMMENDATION (Rule 6.2): Replace UI Modal with API POST Request here to be 10x faster
                    for (let i = 0; i < needed; i++) {
                        const name = generateTestProfileNameWithSuffix(`Auto_Pagi_${i}`);
                        
                        // If API function is available: await request.post('/api/profiles', { data: { name } });
                        // Below still uses UI based on your old code, but switch to API as soon as possible!
                        await createProfileViaModal(dp, name);
                        tempProfiles.push(name);
                    }
                    await dp.gotoList(); // Reload the table to update pagination
                }
                
                // Confirm page 2 button is available
                await expect(dp.pageNumberBtn(2)).toBeVisible();
                await expect(dp.pageNumberBtn(2)).toBeEnabled();
            });

            await test.step('Navigate to page 2 and verify data changes', async () => {
                const firstRowTextPage1 = await dp.tableRows.first().textContent();
                
                await dp.pageNumberBtn(2).click();
                await expect(page).toHaveURL(/.*page=2/);

                // Rule 18 #12: Don't use poll, use not.toHaveText (Very fast and elegant)
                await expect(dp.tableRows.first()).not.toHaveText(firstRowTextPage1);
            });

            await test.step('Navigate back to page 1', async () => {
                await dp.pageNumberBtn(1).click();
                await expect(page).toHaveURL(/.*page=1/); 
            });

        } finally {
            // Rule 17.6: Cleanup MUST BE HERE. No matter which line the test fails on, data will be deleted.
            if (tempProfiles.length > 0) {
                await test.step('Cleanup temporary data', async () => {
                    for (const name of tempProfiles) {
                        // RECOMMENDATION: Use API Delete instead of cleanup via the UI
                        await cleanupProfile(dp, name).catch(e => console.error(`Delete failed: ${name}`, e));
                    }
                });
            }
        }
    });
});
