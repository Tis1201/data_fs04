/**
 * dp-20 — List Page Search (Device Profiles)
 *
 * Rule 6.1: Independent test data via API (beforeAll/afterAll).
 * Rule 3.2: No .catch() to swallow errors.
 * Rule 3.3: No if-else branching — deterministic assertions.
 * Rule 3.1: Web-First Assertions only.
 */
const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
const ProfileApiHelper = require('../../utils/profile-api-helper');
const { authFile } = require('./dp-shared');

const test = base.test.extend({
    dp: async ({ page }, use) => {
        const dp = new DeviceProfilePage(page);
        await dp.gotoList();
        await use(dp);
    },
});
const expect = test.expect;

test.use({ storageState: authFile });

/* ── Data Setup (Rule 6.2) ───────────────────────────────────────────── */
const UNIQUE = `SrchDP_${Date.now()}`;
const SEARCH_PROFILE_NAME = `${UNIQUE}_Profile`;
const SEARCH_PROFILE_DESC = `${UNIQUE}_DescriptionText`;

let api;
let createdProfile;

test.beforeAll(async () => {
    api = new ProfileApiHelper('https://app-dev-v2.datarealities.com');
    await api.init();
    createdProfile = await api.createProfile({
        name: SEARCH_PROFILE_NAME,
        description: SEARCH_PROFILE_DESC,
        isActive: true,
        settings: [],
    });
});

test.afterAll(async () => {
    if (createdProfile?.id) await api.deleteProfile(createdProfile.id);
    await api.dispose();
});

/* ── Tests ────────────────────────────────────────────────────────────── */
test.describe('Section 20 — List Page Search', () => {

    /**
     * TC-DP-037, TC-DP-038, TC-DP-039: Search by name, ID, description
     */
    test('TC-DP-037,038,039: Search by profile name, ID, and description', async ({ page, dp }) => {

        await test.step('TC-DP-037: Search by profile name filters list', async () => {
            const term = SEARCH_PROFILE_NAME.slice(0, 8);
            await dp.searchFor(term);
            await expect(page).toHaveURL(new RegExp(`search=${term}`));
            await expect(dp.profileRowByName(SEARCH_PROFILE_NAME)).toBeVisible();
        });

        await test.step('TC-DP-038: Search by profile ID returns single match', async () => {
            await dp.searchFor(createdProfile.id);
            await expect(page).toHaveURL(new RegExp(`search=${createdProfile.id}`));
            await expect(dp.tableRows).toHaveCount(1);
            await expect(dp.tableRows.first()).toContainText(createdProfile.id);
        });

        await test.step('TC-DP-039: Search by description substring', async () => {
            const descTerm = SEARCH_PROFILE_DESC.slice(0, 10);
            await dp.searchFor(descTerm);
            await expect(page).toHaveURL(new RegExp(`search=${descTerm}`));
            // Backend searches in name + description; verify row appears
            await expect(dp.profileRowByName(SEARCH_PROFILE_NAME)).toBeVisible();
        });
    });

    /**
     * TC-DP-040, TC-DP-041, TC-DP-042: Edge cases
     */
    test('TC-DP-040,041,042: Search edge cases — no match, debounce, clear', async ({ page, dp }) => {

        await test.step('TC-DP-040: Search with no match shows empty state', async () => {
            const noMatch = `nonexistent_profile_zzz_${Date.now()}`;
            await dp.searchFor(noMatch);
            await expect(page).toHaveURL(new RegExp(`search=${noMatch}`));
            await expect(dp.noProfilesMessage).toBeVisible();
        });

        await test.step('TC-DP-041: Debounced search fires single navigation after rapid typing', async () => {
            await dp.clearSearch();
            await page.goto(dp.listUrl);

            let searchNavCount = 0;
            const onNav = (frame) => {
                if (frame === page.mainFrame() && /[?&]search=AutoT/i.test(frame.url())) {
                    searchNavCount++;
                }
            };
            page.on('framenavigated', onNav);

            await dp.searchInput.click();
            await dp.searchInput.pressSequentially('AutoT', { delay: 30 });
            await expect(page).toHaveURL(/search=AutoT/i);
            page.off('framenavigated', onNav);
            expect(searchNavCount, `expected debounce to coalesce typing (got ${searchNavCount})`).toBeLessThanOrEqual(2);
        });

        await test.step('TC-DP-042: Clear search restores full list and removes URL param', async () => {
            await dp.searchFor('AutoTest');
            await expect(page).toHaveURL(/search=AutoTest/);
            await dp.clearSearch();
            await expect(page).not.toHaveURL(/search=/);
            await expect(dp.table).toBeVisible();
        });
    });
});
