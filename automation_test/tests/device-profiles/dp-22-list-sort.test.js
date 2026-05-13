/**
 * dp-22 — List Page Sort (Device Profiles)
 *
 * Rule 3.1: Web-First Assertions (no waitFor).
 * Rule 3.2: No .catch().
 * Rule 14.1: No force:true.
 * Rule 3.3: No if-else.
 */
const base = require('@playwright/test');
const DeviceProfilePage = require('../../pages/device-profiles/device-profile-page');
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

/** Read Name column — extract link text only (profile name, not ID). Rule 4.3. */
async function readNameColumn(dp) {
    const count = await dp.tableRows.count();
    const names = [];
    for (let i = 0; i < count; i++) {
        const name = await dp.tableRows.nth(i).locator('td').first().locator('a').first().textContent();
        names.push((name || '').trim());
    }
    return names;
}

/** Read Created On column (3rd cell). */
async function readCreatedOnColumn(dp) {
    const count = await dp.tableRows.count();
    const out = [];
    for (let i = 0; i < count; i++) {
        const txt = await dp.tableRows.nth(i).locator('td').nth(2).textContent();
        out.push((txt || '').trim());
    }
    return out;
}

function isSortedAsc(arr, comparator) {
    for (let i = 1; i < arr.length; i++) {
        if (comparator(arr[i - 1], arr[i]) > 0) return false;
    }
    return true;
}

const ciCompare = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', ignorePunctuation: true });
const dateCompare = (a, b) => new Date(a).getTime() - new Date(b).getTime();

/** Apply filter and wait for modal to disappear (Rule 3.1: Web-First). */
async function applyFilter(dp) {
    await dp.filterApplyButton.click();
    await expect(dp.filterModalBase).toBeHidden();
}

/* ── Tests ────────────────────────────────────────────────────────────── */
test.describe('Section 22 — List Page Sort', () => {

    /**
     * TC-DP-050, TC-DP-051: Sort by Name and Created On — 3-state cycle
     */
    test('TC-DP-050,051: Sort by Name and Created On — 3-state cycle', async ({ page, dp }) => {
        await test.step('TC-DP-050: Sort by Name — asc → desc → cleared', async () => {
            await dp.nameColumnHeader.click();
            await expect(page).toHaveURL(/sort=name&order=asc/);
            await page.waitForLoadState('networkidle');
            const namesAsc = await readNameColumn(dp);
            expect(namesAsc.length).toBeGreaterThan(0);
            expect(isSortedAsc(namesAsc, ciCompare)).toBeTruthy();

            await dp.nameColumnHeader.click();
            await expect(page).toHaveURL(/sort=name&order=desc/);
            await page.waitForLoadState('networkidle');
            const namesDesc = await readNameColumn(dp);
            expect(isSortedAsc([...namesDesc].reverse(), ciCompare)).toBeTruthy();

            await dp.nameColumnHeader.click();
            await expect(page).not.toHaveURL(/sort=name/);
            await expect(page).not.toHaveURL(/order=desc/);
            await page.waitForLoadState('networkidle');
        });

        await test.step('TC-DP-051: Sort by Created On — chronological order', async () => {
            await dp.createdOnColumnHeader.click();
            await expect(page).toHaveURL(/sort=createdAt&order=asc/);
            await page.waitForLoadState('networkidle');
            const datesAsc = await readCreatedOnColumn(dp);
            expect(datesAsc.length).toBeGreaterThan(0);
            expect(isSortedAsc(datesAsc, dateCompare)).toBeTruthy();

            await dp.createdOnColumnHeader.click();
            await expect(page).toHaveURL(/sort=createdAt&order=desc/);
            await page.waitForLoadState('networkidle');
            const datesDesc = await readCreatedOnColumn(dp);
            expect(isSortedAsc([...datesDesc].reverse(), dateCompare)).toBeTruthy();
        });
    });

    /**
     * TC-DP-052, TC-DP-053: Sort by other columns and non-sortable columns
     */
    test('TC-DP-052,053: Sort by Assigned Devices, Status, and non-sortable columns', async ({ page, dp }) => {
        await test.step('TC-DP-052: Sort by Assigned Devices and Status — URL params correct', async () => {
            await dp.columnHeader('Assigned Devices').click();
            await expect(page).toHaveURL(/sort=assignments&order=asc/);

            await dp.statusColumnHeader.click();
            await expect(page).toHaveURL(/sort=status&order=asc/);
        });

        // TC-DP-053: Phương án A — verify Actions header has no sort indicator.
        // Rule 14.1: No force:true. Rule 15.6: No .catch().
        await test.step('TC-DP-053: Actions column is not sortable', async () => {
            const actionsHeader = dp.columnHeader('Actions');
            await expect(actionsHeader).toBeVisible();
            await expect(actionsHeader.locator('svg.lucide-arrow-up, svg.lucide-arrow-down'))
                .toHaveCount(0);
            // Verify it has no cursor:pointer (non-interactive)
            const cursor = await actionsHeader.evaluate(el => getComputedStyle(el).cursor);
            expect(cursor).not.toBe('pointer');
        });
    });

    /**
     * TC-DP-054: Sort indicator arrow appears on active column only
     */
    test('TC-DP-054: Sort indicator arrow icon appears on active sorted column only', async ({ dp }) => {
        await test.step('Click Name → arrow-up on Name only', async () => {
            await dp.nameColumnHeader.click();
            await expect(dp.nameColumnHeader.locator('svg.lucide-arrow-up')).toBeVisible();
            for (const label of ['Assigned Devices', 'Created On', 'Status']) {
                await expect(dp.columnHeader(label).locator('svg.lucide-arrow-up, svg.lucide-arrow-down'))
                    .toHaveCount(0);
            }
        });

        await test.step('Click Name again → arrow-down on Name', async () => {
            await dp.nameColumnHeader.click();
            await expect(dp.nameColumnHeader.locator('svg.lucide-arrow-down')).toBeVisible();
        });

        await test.step('Click Created On → indicator transfers', async () => {
            await dp.createdOnColumnHeader.click();
            await expect(dp.createdOnColumnHeader.locator('svg.lucide-arrow-up')).toBeVisible();
            await expect(dp.nameColumnHeader.locator('svg.lucide-arrow-up, svg.lucide-arrow-down'))
                .toHaveCount(0);
        });

        await test.step('Click Created On twice more → all indicators cleared', async () => {
            await dp.createdOnColumnHeader.click();
            await expect(dp.createdOnColumnHeader.locator('svg.lucide-arrow-down')).toBeVisible();
            await dp.createdOnColumnHeader.click();
            await expect(dp.createdOnColumnHeader.locator('svg.lucide-arrow-up, svg.lucide-arrow-down'))
                .toHaveCount(0);
        });
    });

    /**
     * TC-DP-055: Sort persists after reload and combines with Search + Filter
     */
    test('TC-DP-055: Sort persists after reload and combines with Search + Filter', async ({ page, dp }) => {
        await test.step('Apply sort by Created On desc', async () => {
            await dp.createdOnColumnHeader.click();
            await expect(page).toHaveURL(/sort=createdAt&order=asc/);
            await dp.createdOnColumnHeader.click();
            await expect(page).toHaveURL(/sort=createdAt&order=desc/);
        });

        await test.step('Reload preserves sort params', async () => {
            await page.reload();
            await expect(page).toHaveURL(/sort=createdAt&order=desc/);
            await expect(dp.table).toBeVisible();
        });

        await test.step('Sort + Search co-exist in URL', async () => {
            await dp.searchFor('DN');
            await expect(page).toHaveURL(/search=DN/);
            await expect(page).toHaveURL(/sort=createdAt&order=desc/);
        });

        await test.step('Sort + Search + Filter all co-exist', async () => {
            await dp.openFilter();
            await dp.filterStatusDropdown.click();
            await dp.page.locator('[role="option"][data-option-id="active"]').click();
            await dp.filterStatusDropdown.click();
            await applyFilter(dp);

            await expect(page).toHaveURL(/search=DN/);
            await expect(page).toHaveURL(/statuses=active/i);
            await expect(page).toHaveURL(/sort=createdAt&order=desc/);
        });
    });
});
