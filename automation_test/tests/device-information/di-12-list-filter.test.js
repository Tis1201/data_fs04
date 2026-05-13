const base = require('@playwright/test');
const { authFile, DEVICES_URL } = require('./di-shared');

const test = base.test;
test.use({ storageState: authFile });

test.beforeEach(async ({ page }) => {
    await page.goto(DEVICES_URL);
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
});


const expect = test.expect;

function filterLocators(page) {
    const modal = page.locator('.modal-container').filter({ hasText: /^.*Filter.*$/ }).first();
    const sectionByLabel = (label) =>
        modal.locator('.dropdown-container').filter({ hasText: new RegExp(`^\\s*${label}`, 'i') }).first();

    return {
        modal,
        filterButton: page.locator('button').filter({
            has: page.locator('svg.lucide-filter, svg.lucide-list-filter'),
        }).first(),
        applyButton: modal.getByRole('button', { name: /^Apply$/ }).first(),
        clearAllButton: modal.getByRole('button', { name: /Clear All/i }).first(),
        triggerByLabel: (label) => sectionByLabel(label).locator('.dropdown-trigger').first(),
        option: (id) => page.locator(`[role="option"][data-option-id="${id}"]`).first(),
        deviceStatusTrigger: () => sectionByLabel('Device Status').locator('.dropdown-trigger').first(),
        connectionStatusTrigger: () => sectionByLabel('Connection Status').locator('.dropdown-trigger').first(),
        osVersionTrigger: () => sectionByLabel('OS Version').locator('.dropdown-trigger').first(),
        tagTrigger: () => sectionByLabel('Tag').locator('.dropdown-trigger').first(),
    };
}

async function openFilter(page, F) {
    await F.filterButton.click();
    await expect(F.modal).toBeVisible();
}

async function selectOption(page, F, sectionLabel, optionId) {
    await F.triggerByLabel(sectionLabel).click();
    await F.option(optionId).click();
    await F.triggerByLabel(sectionLabel).click();
}

async function applyFilter(page, F) {
    await F.applyButton.click();
    await expect(F.modal).toBeHidden();
}

test.describe('Section 12 — Devices List Filter', () => {

    test('TC-INFO-030,035: Filter default state — All preselected and mutually exclusive', async ({ page }) => {
        const F = filterLocators(page);
        await openFilter(page, F);

        await test.step('TC-INFO-030: Filter modal default state — All preselected on all 4 sections', async () => {
            for (const label of ['Device Status', 'Connection Status', 'OS Version', 'Tag']) {
                const section = F.modal.locator('.dropdown-container').filter({ hasText: new RegExp(`^\\s*${label}`, 'i') }).first();
                await expect(section.locator('.tag-label').filter({ hasText: /^All$/ }).first()).toBeVisible();
            }
        });

        await test.step('TC-INFO-035: "All" mutually exclusive with specific options across sections', async () => {
            for (const [label, optionId] of [
                ['Device Status', 'ACTIVE'],
                ['Connection Status', 'Online'],
            ]) {
                await F.triggerByLabel(label).click();
                await F.option(optionId).click();
                await expect(F.option(optionId)).toHaveAttribute('aria-selected', 'true');
                await expect(F.option('__all__')).toHaveAttribute('aria-selected', 'false');

                await F.option('__all__').click();
                await expect(F.option('__all__')).toHaveAttribute('aria-selected', 'true');
                await expect(F.option(optionId)).toHaveAttribute('aria-selected', 'false');
                await F.triggerByLabel(label).click();
            }
        });
    });

    test('TC-INFO-031,032: Filter by Device Status (Active/Inactive) and Connection Status (Online/Offline)', async ({ page }) => {
        const F = filterLocators(page);
        const rows = page.locator('table tbody tr');

        await test.step('TC-INFO-031: Filter by Device Status (Active / Deactivated)', async () => {
            await openFilter(page, F);
            await selectOption(page, F, 'Device Status', 'ACTIVE');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/statuses=ACTIVE/);
        });

        await test.step('TC-INFO-031 (continued): Deactivated (Inactive)', async () => {
            await openFilter(page, F);
            await F.clearAllButton.click();
            await selectOption(page, F, 'Device Status', 'INACTIVE');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/statuses=INACTIVE/);
        });

        await test.step('TC-INFO-032: Filter by Connection Status (Online / Offline)', async () => {
            await openFilter(page, F);
            await F.clearAllButton.click();
            await selectOption(page, F, 'Connection Status', 'Online');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/connected=Online/);
            await expect(page).not.toHaveURL(/statuses=/);

            const count = await rows.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await expect(rows.nth(i)).toContainText(/Online/i);
            }
        });

        await test.step('TC-INFO-032 (continued): Offline', async () => {
            await openFilter(page, F);
            await F.clearAllButton.click();
            await selectOption(page, F, 'Connection Status', 'Offline');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/connected=Offline/);
        });
    });

    test('TC-INFO-033,034: Filter by OS Version and Tag — single', async ({ page }) => {
        const F = filterLocators(page);

        await test.step('TC-INFO-033: Filter by OS Version — single', async () => {
            await openFilter(page, F);
            await F.osVersionTrigger().click();
            const optionList = page.locator('[role="option"]:not([data-option-id="__all__"])');
            const optionCount = await optionList.count();
            expect(optionCount).toBeGreaterThan(0);

            const firstOptionId = await optionList.first().getAttribute('data-option-id');
            await optionList.first().click();
            await F.osVersionTrigger().click();
            await applyFilter(page, F);
            await expect(page).toHaveURL(new RegExp(`osVersions=${encodeURIComponent(firstOptionId)}`));
        });

        await test.step('TC-INFO-034: Filter by Tag — single', async () => {
            await openFilter(page, F);
            await F.tagTrigger().click();
            const tagOptions = page.locator('[role="option"]:not([data-option-id="__all__"])');
            const tagCount = await tagOptions.count();
            expect(tagCount).toBeGreaterThan(0);

            const firstTagId = await tagOptions.first().getAttribute('data-option-id');
            await tagOptions.first().click();
            await F.tagTrigger().click();
            await applyFilter(page, F);
            await expect(page).toHaveURL(new RegExp(`tags=${encodeURIComponent(firstTagId)}`));
        });
    });

    test('TC-INFO-036,037: Combined filters across sections and Clear All', async ({ page }) => {
        const F = filterLocators(page);

        await test.step('TC-INFO-036: Combined filters across sections — AND between sections', async () => {
            await openFilter(page, F);
            await selectOption(page, F, 'Device Status', 'ACTIVE');
            await selectOption(page, F, 'Connection Status', 'Online');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/statuses=ACTIVE/);
            await expect(page).toHaveURL(/connected=Online/);
        });

        await test.step('TC-INFO-037: Clear All resets all 4 sections to "All"', async () => {
            await openFilter(page, F);
            await F.clearAllButton.click();
            for (const label of ['Device Status', 'Connection Status', 'OS Version', 'Tag']) {
                const section = F.modal.locator('.dropdown-container').filter({ hasText: new RegExp(`^\\s*${label}`, 'i') }).first();
                await expect(section.locator('.tag-label').filter({ hasText: /^All$/ }).first()).toBeVisible();
            }
            await applyFilter(page, F);
            await expect(page).not.toHaveURL(/statuses=/);
            await expect(page).not.toHaveURL(/connected=/);
        });
    });

    test('TC-INFO-038,039: Combined filter and search work together, filters persist after reload', async ({ page }) => {
        const F = filterLocators(page);
        const searchInput = page.getByPlaceholder(/Search by/i).first();

        await test.step('TC-INFO-038: Combined filter and search work together', async () => {
            await openFilter(page, F);
            await selectOption(page, F, 'Connection Status', 'Online');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/connected=Online/);
            await searchInput.click();
            await searchInput.pressSequentially('Auto', { delay: 50 });
            await expect(page).toHaveURL(/search=Auto/, { timeout: 15000 });
            await expect(page).toHaveURL(/connected=Online/);
        });

        await test.step('TC-INFO-039: Filters persist after page reload', async () => {
            await openFilter(page, F);
            await F.clearAllButton.click();
            await selectOption(page, F, 'Connection Status', 'Offline');
            await selectOption(page, F, 'Device Status', 'ACTIVE');
            await applyFilter(page, F);
            await expect(page).toHaveURL(/connected=Offline/);
            await expect(page).toHaveURL(/statuses=ACTIVE/);
            await page.reload();
            await expect(page).toHaveURL(/connected=Offline/);
            await expect(page).toHaveURL(/statuses=ACTIVE/);
            await page.waitForLoadState('networkidle');
            await expect(page.locator('table')).toBeVisible();
        });
    });
});
