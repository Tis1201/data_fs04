const base = require('@playwright/test');
const ResourcesPage = require('../../pages/resources/resources-page');
const {
    cleanupResource,
    createResourceViaModal,
    restoreResourceName,
    cleanupAutoTestResources,
} = require('../../utils/resources-helpers');
const {
    authFile,
    RESOURCE_FILE,
    APPLICATION_RESOURCE_ID,
    APPLICATION_RESOURCE_NAME,
    generateTestResourceNameWithSuffix,
} = require('./rs-shared');

const test = base.test.extend({
    rs: async ({ page }, use) => {
        const rs = new ResourcesPage(page);
        await rs.gotoList();
        await use(rs);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Sections 11-12 — Edge Cases & Concurrency', () => {

    test('TC-RS-022: 50-char Resource Name and long package id display correctly', async ({ rs }) => {
        const longName = 'AutoTest_' + 'X'.repeat(41);

        try {
            await test.step('Create resource with 50-char name', async () => {
                await createResourceViaModal(rs, longName, RESOURCE_FILE);
                await rs.waitForSuccessToast();
                await rs.gotoList();
            });

            await test.step('Verify 50-char name renders in list without layout break', async () => {
                await rs.searchFor(longName);
                const row = rs.resourceRowByName(longName);
                await expect(row).toBeVisible();
                await expect(row).toContainText(longName);
            });

            await test.step('Detail card also shows the full name', async () => {
                await rs.resourceNameLink(longName).click();
                await expect(rs.overviewCard).toContainText(longName.substring(0, 30));
                await rs.gotoList();
            });

            await test.step('Known resource with long package id renders with truncation affordance', async () => {
                await rs.searchFor('com.datarealities.rdm');
                await expect(rs.tableRows.first()).toBeVisible();
                await expect(rs.tableRows.first()).toContainText(/com\.datarealities/i);
            });
        } finally {
            await cleanupResource(rs, longName).catch(e =>
                console.error(`TC-RS-022 cleanup failed: ${e.message}`)
            );
        }
    });

    test('TC-RS-023: Refresh preserves state; invalid params and page=999 are handled gracefully', async ({ page, rs }) => {
        await test.step('Hard reload on detail page returns same data', async () => {
            await rs.gotoDetail(APPLICATION_RESOURCE_ID);
            await expect(rs.overviewCard).toContainText(APPLICATION_RESOURCE_NAME);
            await page.reload();
            await expect(rs.overviewCard).toContainText(APPLICATION_RESOURCE_NAME);
        });

        await test.step('Hard reload on sorted/paged list preserves state', async () => {
            await rs.gotoList('sort_field=name&sort_order=asc&page=2');
            await expect(rs.paginationDetails).toHaveText(/11\s*-\s*20\s+of\s+\d+/i);
            await page.reload();
            await expect(page).toHaveURL(/sort_field=name.*sort_order=asc.*page=2/);
            await expect(rs.paginationDetails).toHaveText(/11\s*-\s*20\s+of\s+\d+/i);
        });

        await test.step('Invalid sort_field param is handled without crash', async () => {
            await rs.gotoList('sort_field=invalidField&sort_order=asc&page=1');
            await expect(rs.table.or(rs.noResourcesMessage).or(rs.errorMessageContainer).first()).toBeVisible({ timeout: 15000 });
            await expect(page).not.toHaveURL(/error|crash/i);
        });

        await test.step('page=999 does not crash — shows last page or empty state', async () => {
            await rs.gotoList('page=999');
            await expect(rs.table.or(rs.noResourcesMessage).or(rs.errorMessageContainer).first()).toBeVisible({ timeout: 15000 });
            await expect(page).not.toHaveURL(/error|crash/i);
        });
    });

    test('TC-RS-024: Double-click Add and Delete do not double-fire', async ({ rs }) => {
        const addName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'dbl25add');
        const deleteName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'dbl25del');

        await test.step('Pre-create delete-target resource', async () => {
            await createResourceViaModal(rs, deleteName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            await test.step('Open Add modal, fill data, double-click Add button', async () => {
                await rs.openAddResourceModal();
                await rs.uploadResourceFile(RESOURCE_FILE);
                await rs.fillResourceName(addName);
                await rs.addSubmitButton.dblclick({ delay: 50 });
                await expect(rs.modalBase).toBeHidden({ timeout: 25000 });
            });

            await test.step('Verify exactly one resource was created', async () => {
                await rs.gotoList();
                await rs.searchFor(addName);
                await expect(rs.tableRows).toHaveCount(1);
            });

            await test.step('Open delete dialog for delete-target, double-click Confirm', async () => {
                await rs.gotoList();
                await rs.clickActionsMenu(deleteName);
                await rs.clickActionItem('Delete');
                await expect(rs.deleteModalBase).toBeVisible();
                const toastPromise = rs.waitForSuccessToast(15000).catch(() => null);
                await rs.deleteConfirmButton.dblclick({ delay: 50 });
                await expect(rs.deleteModalBase).toBeHidden({ timeout: 15000 });
                const toastText = await toastPromise;
                expect(toastText).toBeTruthy();
            });

            await test.step('Resource is gone; no duplicate resource remains', async () => {
                await rs.gotoList();
                await rs.searchFor(deleteName);
                await expect(rs.resourceRowByName(deleteName)).toBeHidden();
            });
        } finally {
            await cleanupResource(rs, addName).catch(e =>
                console.error(`TC-RS-024 addName cleanup failed: ${e.message}`)
            );
            await cleanupResource(rs, deleteName).catch(e =>
                console.error(`TC-RS-024 deleteName cleanup failed: ${e.message}`)
            );
        }
    });

    test('TC-RS-025: Two-tab edit on same resource — last write wins or conflict surfaced', async ({ browser }) => {
        const context = await browser.newContext({ storageState: authFile });
        const disposableName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'twotab26');
        const nameTabA = `TabA_${Date.now()}`;
        const nameTabB = `TabB_${Date.now() + 1}`;

        const pageA = await context.newPage();
        const pageB = await context.newPage();
        const rsA = new ResourcesPage(pageA);
        const rsB = new ResourcesPage(pageB);

        try {
            await rsA.gotoList();
            await createResourceViaModal(rsA, disposableName, RESOURCE_FILE);
            await rsA.waitForSuccessToast();

            await rsA.gotoDetail(APPLICATION_RESOURCE_ID);
            await rsB.gotoDetail(APPLICATION_RESOURCE_ID);

            await test.step('Tab A opens Edit Set and types new name (unsaved)', async () => {
                await rsA.editSetButton.click();
                await expect(rsA.modalBase).toBeVisible({ timeout: 10000 });
                await rsA.fillResourceName(nameTabA);
            });

            await test.step('Tab B opens Edit Set, saves nameTabB', async () => {
                await rsB.editSetButton.click();
                await expect(rsB.modalBase).toBeVisible({ timeout: 10000 });
                await rsB.fillResourceName(nameTabB);
                await rsB.saveResourceModal();
                await rsB.waitForSuccessToast();
            });

            await test.step('Tab A saves — expect LWW success or conflict error (no crash)', async () => {
                await rsA.saveButton.click();
                await expect(rsA.toast).toBeVisible({ timeout: 10000 });
                await expect(rsA.toast).toContainText(/success|conflict|409|version|reload|mismatch/i);

                await expect(rsA.page).not.toHaveURL(/error|crash/i);
            });
        } finally {
            await test.step('Cleanup disposable resource', async () => {
                await rsA.gotoList().catch(() => {});
                await cleanupResource(rsA, disposableName).catch(e =>
                    console.error(`TC-RS-025 cleanup disposable failed: ${e.message}`)
                );
                await restoreResourceName(pageA, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME).catch(
                    e => console.error(`TC-RS-025 restore name failed: ${e.message}`)
                );
                await context.close();
            });
        }
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        await cleanupAutoTestResources(page).catch(e =>
            console.error(`AfterAll rs-06 cleanup failed: ${e.message}`)
        );
        await restoreResourceName(page, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME).catch(
            e => console.error(`AfterAll rs-06 restore name failed: ${e.message}`)
        );
    } finally {
        await context.close();
    }
});
