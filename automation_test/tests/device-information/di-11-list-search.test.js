const base = require('@playwright/test');
const { authFile, DEVICES_URL, ETHERNET_DEVICE_ID } = require('./di-shared');

const test = base.test;
test.use({ storageState: authFile });

test.beforeEach(async ({ page }) => {
    await page.goto(DEVICES_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
});


const expect = test.expect;

async function searchAndWait(page, L, term) {
    await L.searchInput.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await L.searchInput.pressSequentially(term, { delay: 50 });
    await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(term)}`, 'i'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
}

test.describe('Section 11 — Devices List Search', () => {

    test('TC-INFO-022~026: Search by Device name, MAC, Tag, OS version, Device ID', async ({ page }) => {
        const L = listLocators(page);

        await test.step('TC-INFO-022: Search by Device name', async () => {
            const firstName = (await L.firstRow.locator('td').nth(1).textContent() || '').trim();
            const term = firstName.split(/\s+/)[0].slice(0, Math.min(6, firstName.length)) || 'Auto';

            await searchAndWait(page, L, term);

            const count = await L.rows.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await expect(L.rows.nth(i).locator('td').nth(1)).toContainText(new RegExp(term, 'i'));
            }
        });

        await test.step('TC-INFO-023: Search by MAC address (full and partial)', async () => {
            await page.goto(DEVICES_URL);
            await page.waitForLoadState('networkidle');
            await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

            const macCellText = (await L.firstRow.locator('td').nth(2).textContent() || '').trim();
            const macMatch = macCellText.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
            expect(macMatch).not.toBeNull();

            const fullMac = macMatch[0];
            const partialMac = fullMac.split(':').slice(0, 3).join(':');

            await searchAndWait(page, L, fullMac);
            await expect(L.rows).toHaveCount(1);
            await expect(L.rows.first()).toContainText(fullMac);

            await searchAndWait(page, L, partialMac);
            const partialCount = await L.rows.count();
            expect(partialCount).toBeGreaterThan(0);
            for (let i = 0; i < partialCount; i++) {
                await expect(L.rows.nth(i)).toContainText(new RegExp(partialMac, 'i'));
            }
        });

        await test.step('TC-INFO-024: Search by Tag name', async () => {
            await page.goto(DEVICES_URL);
            await page.waitForLoadState('networkidle');
            await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

            let tagText = '';
            const total = await L.rows.count();
            for (let i = 0; i < total; i++) {
                const chip = L.rows.nth(i).locator('[class*="tag"], [class*="chip"], [class*="badge"]').filter({ hasText: /\S/ }).first();
                if (await chip.count() > 0 && await chip.isVisible()) {
                    const t = (await chip.textContent() || '').trim();
                    if (t && !/online|offline|active|inactive|cpu|mem|dsk/i.test(t)) { tagText = t; break; }
                }
            }
            expect(tagText.length).toBeGreaterThan(0);

            await searchAndWait(page, L, tagText);
            const count = await L.rows.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await expect(L.rows.nth(i)).toContainText(new RegExp(tagText, 'i'));
            }
        });

        await test.step('TC-INFO-025: Search by OS version (Android / Linux)', async () => {
            for (const os of ['Android', 'Linux']) {
                await searchAndWait(page, L, os);

                const count = await L.rows.count();
                expect(count).toBeGreaterThan(0);
                for (let i = 0; i < count; i++) {
                    await expect(L.rows.nth(i)).toContainText(new RegExp(os, 'i'));
                }
            }
        });

        await test.step('TC-INFO-026: Search by Device ID returns single match', async () => {
            await searchAndWait(page, L, ETHERNET_DEVICE_ID);
            await expect(L.rows).toHaveCount(1);
        });
    });

    test('TC-INFO-027~029: Search edge cases — no match, debounce, clear', async ({ page }) => {
        const L = listLocators(page);

        await test.step('TC-INFO-027: Search with no match — empty state', async () => {
            const noMatch = `nonexistent-zzz-${Date.now()}`;
            await searchAndWait(page, L, noMatch);
            await expect(L.emptyRow).toBeVisible({ timeout: 5000 });
        });

        await test.step('TC-INFO-028: Debounce + URL sync + page reset to 1', async () => {
            await page.goto(`${DEVICES_URL}?page=2&per_page=10&sort=name&order=asc`);
            await page.waitForLoadState('networkidle');
            await expect(L.table).toBeVisible();

            let navCount = 0;
            const onNav = (frame) => {
                if (frame === page.mainFrame() && /search=abcde/i.test(frame.url())) navCount++;
            };
            page.on('framenavigated', onNav);

            await L.searchInput.click();
            await L.searchInput.pressSequentially('abcde', { delay: 30 });
            await expect(page).toHaveURL(/search=abcde/, { timeout: 15000 });
            await expect(page).toHaveURL(/page=1/);
            page.off('framenavigated', onNav);
            expect(navCount, `expected debounce to coalesce typing (got ${navCount})`).toBeLessThanOrEqual(2);
        });

        await test.step('TC-INFO-029: Clear search restores full list', async () => {
            await searchAndWait(page, L, 'Auto');
            await L.searchInput.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await expect(page).not.toHaveURL(/search=/, { timeout: 15000 });
            await expect(L.table).toBeVisible();
        });
    });
});

function listLocators(page) {
    return {
        searchInput: page.getByPlaceholder(/Search by/i).first(),
        table: page.locator('table').first(),
        rows: page.locator('table tbody tr'),
        firstRow: page.locator('table tbody tr').first(),
        emptyRow: page.locator('table tbody tr').filter({ hasText: /No (data|devices)/i }).first(),
    };
}
