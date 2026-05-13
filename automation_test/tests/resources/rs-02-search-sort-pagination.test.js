const base = require('@playwright/test');
const ResourcesPage = require('../../pages/resources/resources-page');
const {
    authFile,
    APPLICATION_RESOURCE_ID,
    APPLICATION_RESOURCE_NAME,
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

const SORTABLE_COLUMNS = [
    { name: 'Name', field: 'name' },
    { name: 'Type', field: 'type' },
    { name: 'Release Type', field: 'releaseType' },
    { name: 'Version', field: 'version' },
    { name: 'Format', field: 'format' },
    { name: 'Size', field: 'size' },
    { name: 'Created On', field: 'createdAt' },
];

test.describe('Sections 2-4 — Resources Search, Sorting & Pagination', () => {

    test('TC-RS-004: Search by name, package/type and clear resets list', async ({ page, rs }) => {
        await test.step('Search by resource name keyword', async () => {
            await rs.gotoList('page=2');
            await rs.searchFor('RadarEdge');
            await expect(page).toHaveURL(/search=RadarEdge/);
            await expect(page).toHaveURL(/page=1/);
            await expect(rs.tableRows.first()).toContainText(/RadarEdge/i);
        });

        await test.step('Search by package keyword', async () => {
            await rs.searchFor('com.datarealities.rdm');
            await expect(page).toHaveURL(/search=com\.datarealities\.rdm|search=com%2Edatarealities%2Erdm/i);
            await expect(rs.tableRows.first()).toContainText(/com\.datarealities\.rdm/i);
        });

        await test.step('Search by type and clear search', async () => {
            await rs.searchFor('Archive');
            await expect(rs.tableRows.first()).toContainText(/Archive/i);
            await rs.clearSearch();
            await expect(page).not.toHaveURL(/search=/);
            await expect(rs.tableRows.first()).toBeVisible();
        });
    });

    test('TC-RS-005: Search no matching term shows empty state', async ({ rs }) => {
        await test.step('Search with unique non-existing keyword', async () => {
            await rs.searchFor(`nonexistent-resource-${Date.now()}`);
            await expect(rs.noResourcesMessage).toBeVisible();
        });
    });

    test('TC-RS-006: Sort sortable columns updates URL and table remains consistent', async ({ page, rs }) => {
        for (const column of SORTABLE_COLUMNS) {
            await test.step(`Sort by ${column.name}`, async () => {
                await rs.clickColumnHeader(column.name);
                await expect(page).toHaveURL(new RegExp(`sort_field=${column.field}`));
                await expect(page).toHaveURL(/sort_order=(asc|desc)/);
                await expect(rs.tableRows.first()).toBeVisible();
            });
        }
    });

    test('TC-RS-007: Sorting resets page and Actions column is not sortable', async ({ page, rs }) => {
        await test.step('Sort from page 2 resets to page 1', async () => {
            await rs.gotoList('page=2');
            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/page=1/);
            await expect(page).toHaveURL(/sort_field=name/);
        });

        await test.step('Actions header click does not change URL', async () => {
            const currentUrl = page.url();
            await rs.columnHeader('Actions').click();
            await expect(page).toHaveURL(currentUrl);
        });
    });

    test('TC-RS-008/009: Pagination boundary and page navigation work', async ({ page, rs }) => {
        await test.step('Verify first page boundary state', async () => {
            await rs.gotoList();
            await expect(rs.paginationDetails).toHaveText(/1\s*-\s*10\s+of\s+\d+/i);
            await expect(rs.paginationPrevBtn).toBeDisabled();
        });

        await test.step('Navigate by page number and first/last controls', async () => {
            await expect(rs.pageNumberBtn(2)).toBeVisible();
            const firstRowText = await rs.getFirstRowText();
            await rs.pageNumberBtn(2).click();
            await expect(page).toHaveURL(/page=2/);
            await expect(rs.tableRows.first()).not.toHaveText(firstRowText);
            await rs.paginationFirstBtn.click();
            await expect(page).toHaveURL(/page=1/);
        });
    });

    test('TC-RS-038: Search by name, ID, type and package keyword', async ({ page, rs }) => {
        await test.step('Search by resource name keyword', async () => {
            const term = APPLICATION_RESOURCE_NAME.slice(0, 6);
            await rs.searchFor(term);
            await expect(page).toHaveURL(new RegExp(`search=${term}`));
            await expect(page).toHaveURL(/page=1/);
            const count = await rs.tableRows.count();
            for (let i = 0; i < count; i++) {
                await expect(rs.tableRows.nth(i)).toContainText(new RegExp(term, 'i'));
            }
        });

        await test.step('Search by resource ID — single exact match', async () => {
            await rs.searchFor(APPLICATION_RESOURCE_ID);
            await expect(page).toHaveURL(new RegExp(`search=${APPLICATION_RESOURCE_ID}`));
            await expect(rs.tableRows).toHaveCount(1);
            await expect(rs.tableRows.first()).toContainText(APPLICATION_RESOURCE_ID);
        });

        await test.step('Search by type and package keyword', async () => {
            for (const keyword of ['Application', 'Archive', 'com.datarealities']) {
                await rs.searchFor(keyword);
                await expect(page).toHaveURL(new RegExp(`search=${keyword}`));
                const count = await rs.tableRows.count();
                if (count === 0) continue;
                for (let i = 0; i < count; i++) {
                    await expect(rs.tableRows.nth(i)).toContainText(new RegExp(keyword, 'i'));
                }
            }
        });
    });

    test('TC-RS-039: Search with no match shows empty state', async ({ page, rs }) => {
        const noMatch = `nonexistent-resource-zzz-${Date.now()}`;
        await rs.searchFor(noMatch);
        await expect(page).toHaveURL(new RegExp(`search=${noMatch}`));
        await expect(rs.noResourcesMessage).toBeVisible();
    });

    test('TC-RS-040: Debounce + URL sync + page reset to 1', async ({ page, rs }) => {
        await rs.gotoList('page=2');
        await expect(rs.tableRows.first()).toBeVisible();

        let navCount = 0;
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame() && /search=abcde/i.test(frame.url())) navCount++;
        });

        await rs.searchInput.click();
        await rs.searchInput.pressSequentially('abcde', { delay: 30 });

        await expect(page).toHaveURL(/search=abcde/);
        await expect(page).toHaveURL(/page=1/);

        expect(navCount, `debounce should coalesce typing (got ${navCount})`).toBeLessThanOrEqual(2);
    });

    test('TC-RS-041: Clear search restores full list', async ({ page, rs }) => {
        await rs.searchFor(APPLICATION_RESOURCE_NAME.slice(0, 6));
        await expect(page).toHaveURL(/search=/);

        await rs.clearSearch();
        await expect(page).not.toHaveURL(/search=/);
        await expect(rs.table).toBeVisible();
    });

    test('TC-RS-042: Sort — 3-state cycle, all columns URL, Actions not sortable', async ({ page, rs }) => {
        await test.step('Sort by Name — 3-state cycle (asc → desc → cleared)', async () => {
            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/sort_field=name&sort_order=asc/);

            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/sort_field=name&sort_order=desc/);

            await rs.clickColumnHeader('Name');
            await expect(page).not.toHaveURL(/sort_field=name/);
        });

        await test.step('Sort by each sortable column — URL params correct', async () => {
            for (const col of SORTABLE_COLUMNS) {
                await rs.clickColumnHeader(col.name);
                await expect(page).toHaveURL(new RegExp(`sort_field=${col.field}`));
                await expect(page).toHaveURL(/sort_order=(asc|desc)/);
                await expect(rs.tableRows.first()).toBeVisible();
            }
        });

        await test.step('Actions column is not sortable', async () => {
            const urlBefore = page.url();
            await rs.columnHeader('Actions').click({ force: true }).catch(() => {});
            expect(page.url()).toBe(urlBefore);
            await expect(rs.columnHeader('Actions').locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(0);
        });
    });

    test('TC-RS-043: Sort indicator arrow on active column only + persists after reload', async ({ page, rs }) => {
        const nameHeader = rs.columnHeader('Name');

        await test.step('Arrow icon appears on active column only', async () => {
            await rs.clickColumnHeader('Name');
            await expect(nameHeader.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(1);

            for (const col of SORTABLE_COLUMNS.filter(c => c.name !== 'Name')) {
                await expect(rs.columnHeader(col.name).locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(0);
            }
        });

        await test.step('Indicator transfers to new column', async () => {
            await rs.clickColumnHeader('Type');
            await expect(rs.columnHeader('Type').locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(1);
            await expect(nameHeader.locator('svg.lucide-arrow-up, svg.lucide-arrow-down')).toHaveCount(0);
        });

        await test.step('Sort persists after page reload', async () => {
            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/sort_field=name&sort_order=asc/);
            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/sort_field=name&sort_order=desc/);

            await page.reload();
            await expect(page).toHaveURL(/sort_field=name&sort_order=desc/);
            await expect(rs.table).toBeVisible();
            await expect(nameHeader.locator('svg.lucide-arrow-down')).toBeVisible();
        });
    });

    test('TC-RS-044: Sort combined with search + sort resets page', async ({ page, rs }) => {
        await test.step('Sort + Search co-exist in URL', async () => {
            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/sort_field=name&sort_order=asc/);

            await rs.searchFor('RadarEdge');
            await expect(page).toHaveURL(/search=RadarEdge/);
            await expect(page).toHaveURL(/sort_field=name/);

            const count = await rs.tableRows.count();
            if (count > 0) {
                for (let i = 0; i < count; i++) {
                    await expect(rs.tableRows.nth(i)).toContainText(/RadarEdge/i);
                }
            }
        });

        await test.step('Sort resets page to 1', async () => {
            await rs.clearSearch();
            await rs.gotoList('page=2');
            await expect(rs.tableRows.first()).toBeVisible();

            await rs.clickColumnHeader('Name');
            await expect(page).toHaveURL(/page=1/);
            await expect(page).toHaveURL(/sort_field=name/);
        });
    });
});
