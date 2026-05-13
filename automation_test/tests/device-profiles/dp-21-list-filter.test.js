/**
 * dp-21 — List Page Filter (Device Profiles)
 *
 * Rule 6.1: Independent test data via API (beforeAll/afterAll).
 * Rule 3.1: Web-First Assertions (no waitFor).
 * Rule 3.2: No .catch().
 * Rule 3.3: No if-else — deterministic assertions.
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

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Select a status option in the filter dropdown, close by re-clicking trigger. */
async function selectStatusInFilter(dp, optionId) {
    await dp.filterStatusDropdown.click();
    await dp.page.locator(`[role="option"][data-option-id="${optionId}"]`).first().click();
    await dp.filterStatusDropdown.click(); // Close dropdown (Escape would close the modal)
}

/** Apply the filter and wait for the modal to disappear (Rule 3.1: Web-First). */
async function applyFilter(dp) {
    await dp.filterApplyButton.click();
    await expect(dp.filterModalBase).toBeHidden();
}

/* ── Data Setup (Rule 6.2) ───────────────────────────────────────────── */
const UNIQUE = `FltDP_${Date.now()}`;

let api;
let activeProfile;
let inactiveProfile;

test.beforeAll(async () => {
    api = new ProfileApiHelper('https://app-dev-v2.datarealities.com');
    await api.init();

    activeProfile = await api.createProfile({
        name: `${UNIQUE}_Active`,
        isActive: true,
        settings: [],
    });

    inactiveProfile = await api.createProfile({
        name: `${UNIQUE}_Inactive`,
        isActive: false,
        settings: [],
    });
});

test.afterAll(async () => {
    if (activeProfile?.id) await api.deleteProfile(activeProfile.id);
    if (inactiveProfile?.id) await api.deleteProfile(inactiveProfile.id);
    await api.dispose();
});

/* ── Tests ────────────────────────────────────────────────────────────── */
test.describe('Section 21 — List Page Filter', () => {

    /**
     * TC-DP-043, TC-DP-046: Filter default state and "All" mutual exclusivity
     */
    test('TC-DP-043,046: Filter default state — "All" preselected and mutually exclusive', async ({ dp }) => {
        await test.step('TC-DP-043: Default state — "All" preselected', async () => {
            await dp.openFilter();
            await expect(dp.filterModalBase).toBeVisible();
            await expect(dp.filterModalBase).toContainText(/Filter/i);
            await expect(dp.filterModalBase).toContainText(/Status/i);
            await expect(dp.filterModalBase.locator('.tag, [class*="tag-label"]').filter({ hasText: /^All$/ }).first())
                .toBeVisible();
        });

        await test.step('TC-DP-046: "All" is mutually exclusive with specific options', async () => {
            await dp.filterStatusDropdown.click();
            await dp.page.locator('[role="option"][data-option-id="active"]').click();
            await dp.filterStatusDropdown.click();
            await dp.filterStatusDropdown.click();
            await expect(dp.page.locator('[role="option"][data-option-id="active"]'))
                .toHaveAttribute('aria-selected', 'true');
            await expect(dp.page.locator('[role="option"][data-option-id="__all__"]'))
                .toHaveAttribute('aria-selected', 'false');

            await dp.page.locator('[role="option"][data-option-id="__all__"]').click();
            await dp.filterStatusDropdown.click();
            await dp.filterStatusDropdown.click();
            await expect(dp.page.locator('[role="option"][data-option-id="__all__"]'))
                .toHaveAttribute('aria-selected', 'true');
            await expect(dp.page.locator('[role="option"][data-option-id="active"]'))
                .toHaveAttribute('aria-selected', 'false');
        });
    });

    /**
     * TC-DP-044, TC-DP-045: Filter by Active and Inactive status
     * Data guaranteed by API setup — no if-else needed.
     */
    test('TC-DP-044,045: Filter by Active and Inactive status', async ({ page, dp }) => {
        await test.step('TC-DP-044: Filter by Active only', async () => {
            await dp.openFilter();
            await selectStatusInFilter(dp, 'active');
            await applyFilter(dp);
            await expect(page).toHaveURL(/statuses=active/i);

            const count = await dp.tableRows.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await expect(dp.rowBadge(dp.tableRows.nth(i)).first()).toContainText(/Active/i);
            }
        });

        await test.step('TC-DP-045: Filter by Inactive only', async () => {
            await dp.openFilter();
            await dp.filterClearAllButton.click();
            await selectStatusInFilter(dp, 'inactive');
            await applyFilter(dp);
            await expect(page).toHaveURL(/statuses=inactive/i);
            await page.waitForLoadState('networkidle');

            // Inactive profile was created in beforeAll — deterministic assertion
            const count = await dp.tableRows.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await expect(dp.rowBadge(dp.tableRows.nth(i)).first()).toContainText(/Inactive/i);
            }
        });
    });

    /**
     * TC-DP-047, TC-DP-049: Clear All and persist after reload
     */
    test('TC-DP-047,049: Clear All resets selection and filters persist after reload', async ({ page, dp }) => {
        await test.step('TC-DP-047: Clear All resets to "All" — modal stays open until Apply', async () => {
            await dp.openFilter();
            await dp.filterClearAllButton.click();
            await selectStatusInFilter(dp, 'active');
            await dp.filterClearAllButton.click();
            await expect(dp.filterModalBase).toBeVisible();
            await expect(dp.filterModalBase.locator('.tag-label').filter({ hasText: /^All$/ }).first())
                .toBeVisible();
            await applyFilter(dp);
            await expect(page).not.toHaveURL(/statuses=/);
        });

        await test.step('TC-DP-049: Filter persists after page reload', async () => {
            await dp.openFilter();
            await dp.filterClearAllButton.click();
            await selectStatusInFilter(dp, 'inactive');
            await applyFilter(dp);
            await expect(page).toHaveURL(/statuses=inactive/i);

            await page.reload();
            await expect(page).toHaveURL(/statuses=inactive/i);
            await expect(dp.table).toBeVisible();
        });
    });

    /**
     * TC-DP-048: Combined filter and search work together
     * Uses the API-created Active profile name for deterministic search.
     */
    test('TC-DP-048: Combined filter and search work together', async ({ page, dp }) => {
        await test.step('Apply Active filter', async () => {
            await dp.openFilter();
            await dp.filterClearAllButton.click();
            await selectStatusInFilter(dp, 'active');
            await applyFilter(dp);
            await expect(page).toHaveURL(/statuses=active/i);
        });

        await test.step('Apply search on top of filter', async () => {
            const searchTerm = activeProfile.name.slice(0, 8);
            await dp.searchFor(searchTerm);
            await expect(page).toHaveURL(new RegExp(`search=${searchTerm}`));
            await expect(page).toHaveURL(/statuses=active/i);
            await page.waitForLoadState('networkidle');

            await expect(dp.tableRows.first()).toContainText(activeProfile.name);
            await expect(dp.rowBadge(dp.tableRows.first()).first()).toContainText(/Active/i);
        });
    });
});
