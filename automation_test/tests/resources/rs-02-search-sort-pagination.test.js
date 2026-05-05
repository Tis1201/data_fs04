const base = require('@playwright/test');
const ResourcesPage = require('../../pages/resources/resources-page');
const { authFile } = require('./rs-shared');

const test = base.test.extend({
    rs: async ({ page }, use) => {
        const rs = new ResourcesPage(page);
        await rs.gotoList();
        await use(rs);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

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
            await expect(rs.noResourcesMessage.or(rs.paginationDetails)).toContainText(/No resources found|No data|No results|0\s+of\s+0/i);
        });
    });

    test('TC-RS-006: Sort sortable columns updates URL and table remains consistent', async ({ page, rs }) => {
        const sortableColumns = [
            { name: 'Name', field: 'name' },
            { name: 'Type', field: 'type' },
            { name: 'Release Type', field: 'releaseType' },
            { name: 'Version', field: 'version' },
            { name: 'Format', field: 'format' },
            { name: 'Size', field: 'size' },
            { name: 'Created On', field: 'createdAt' },
        ];

        for (const column of sortableColumns) {
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
});
