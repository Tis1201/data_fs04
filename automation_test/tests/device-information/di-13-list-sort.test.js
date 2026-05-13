const base = require('@playwright/test');
const { authFile, DEVICES_URL } = require('./di-shared');

const test = base.test;
test.use({ storageState: authFile });

test.beforeEach(async ({ page }) => {
    await page.goto(DEVICES_URL);
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
});


const expect = test.expect;

function sortLocators(page) {
    const header = (label) => page.locator('table th').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'i') }).first();
    return {
        table: page.locator('table').first(),
        rows: page.locator('table tbody tr'),
        header,
        deviceName: header('Device Name'),
        macAddress: header('MAC Address'),
        operatingSystem: header('Operating System'),
        usage: header('Usage'),
        status: header('Status'),
        lastPing: header('Last ping'),
        actions: header('Actions'),
    };
}

test.describe('Section 13 — Devices List Sort', () => {

    test('TC-INFO-040,041: Sort by Device Name, MAC, OS, Status, Last ping — URL params correct', async ({ page }) => {
        const S = sortLocators(page);

        await test.step('TC-INFO-040: Sort by Device Name — 3-state cycle', async () => {
            await S.deviceName.click();
            await expect(page).toHaveURL(/sort=name&order=desc/);
            await S.deviceName.click();
            await expect(page).toHaveURL(/sort=&order=asc/);
            await S.deviceName.click();
            await expect(page).toHaveURL(/sort=name&order=asc/);
        });

        await test.step('TC-INFO-041: Sort by MAC, OS, Status, Last ping — URL params correct', async () => {
            await S.macAddress.click();
            await expect(page).toHaveURL(/sort=macAddress&order=asc/);
            await S.operatingSystem.click();
            await expect(page).toHaveURL(/sort=deviceType&order=asc/);
            await S.status.click();
            await expect(page).toHaveURL(/sort=connected&order=asc/);
            await S.lastPing.click();
            await expect(page).toHaveURL(/sort=disconnectedAt&order=asc/);
        });
    });

    test('TC-INFO-042: Non-sortable columns (Usage, Actions) do not change sort', async ({ page }) => {
        const S = sortLocators(page);
        const urlBefore = page.url();
        await S.usage.click({ force: true });
        await S.actions.click({ force: true });
        await expect(page).not.toHaveURL(/sort=usage/i);
        await expect(page).not.toHaveURL(/sort=actions/i);
        expect(page.url()).toBe(urlBefore);
        await expect(S.usage.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(0);
        await expect(S.actions.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(0);
    });

    test('TC-INFO-043: Sort indicator (aria-sort + arrow) on active column only', async ({ page }) => {
        const S = sortLocators(page);

        await test.step('Click Device Name → indicator on Name only', async () => {
            await S.deviceName.click();
            await expect(S.deviceName).toHaveAttribute('aria-sort', /ascending|descending/);
            await expect(S.deviceName.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(1);
            for (const h of [S.macAddress, S.operatingSystem, S.status, S.lastPing]) {
                const aria = await h.getAttribute('aria-sort');
                expect(aria === null || aria === 'none').toBeTruthy();
                await expect(h.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(0);
            }
        });

        await test.step('Switch active column → indicator transfers', async () => {
            await S.macAddress.click();
            await expect(S.macAddress).toHaveAttribute('aria-sort', /ascending|descending/);
            await expect(S.macAddress.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(1);
            const dnAria = await S.deviceName.getAttribute('aria-sort');
            expect(dnAria === null || dnAria === 'none').toBeTruthy();
        });

        await test.step('Cycle MAC through cleared → no indicator', async () => {
            await S.macAddress.click();
            await S.macAddress.click();
            const macAria = await S.macAddress.getAttribute('aria-sort');
            expect(macAria === null || macAria === 'none').toBeTruthy();
        });
    });

    test('TC-INFO-044,045: Sort persists after reload and combines with Search + Filter', async ({ page }) => {
        const S = sortLocators(page);

        await test.step('TC-INFO-044: Sort persists after page reload', async () => {
            await S.lastPing.click();
            await S.lastPing.click();
            await expect(page).toHaveURL(/sort=disconnectedAt&order=desc/);
            await page.reload();
            await expect(page).toHaveURL(/sort=disconnectedAt&order=desc/);
            await expect(S.table).toBeVisible();
            await expect(S.lastPing.locator('svg.lucide-arrow-down')).toBeVisible();
        });

        await test.step('TC-INFO-045: Sort combined with Search and Filter', async () => {
            await page.goto(DEVICES_URL);
            await page.waitForLoadState('networkidle');
            await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

            await S.deviceName.click();
            await expect(page).toHaveURL(/sort=name&order=desc/);

            const searchInput = page.getByPlaceholder(/Search by/i).first();
            await searchInput.click();
            await searchInput.pressSequentially('Android', { delay: 50 });
            await expect(page).toHaveURL(/search=Android/, { timeout: 15000 });
            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(/sort=name&order=desc/);

            const filterButton = page.locator('button').filter({
                has: page.locator('svg.lucide-filter, svg.lucide-list-filter'),
            }).first();
            await filterButton.click();

            const modal = page.locator('.modal-container').filter({ hasText: /Filter/i }).first();
            await expect(modal).toBeVisible();

            const connectionTrigger = modal.locator('.dropdown-container').filter({ hasText: /Connection Status/i }).locator('.dropdown-trigger').first();
            await connectionTrigger.click();
            await page.locator('[role="option"][data-option-id="Online"]').click();
            await connectionTrigger.click();
            await modal.getByRole('button', { name: /^Apply$/ }).click();
            await expect(modal).toBeHidden();

            await expect(page).toHaveURL(/search=Android/);
            await expect(page).toHaveURL(/connected=Online/);
            await expect(page).toHaveURL(/sort=name&order=desc/);
        });
    });
});
