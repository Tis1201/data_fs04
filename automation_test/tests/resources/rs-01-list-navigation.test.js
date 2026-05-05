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

test.describe('Section 1 — Resources List Page Load & Navigation', () => {
    test('TC-RS-001: Resource list page loads with correct structure and default data', async ({ page, rs }) => {
        await test.step('Verify page structure', async () => {
            await expect(rs.bannerHeading).toBeVisible();
            await expect(rs.bannerSubtitle).toBeVisible();
            await expect(rs.searchInput).toBeVisible();
            await expect(rs.addResourceButton).toBeEnabled();
            await expect(rs.table).toBeVisible();
        });

        await test.step('Verify table columns', async () => {
            const expectedColumns = ['Name', 'Type', 'Release Type', 'Version', 'Format', 'Size', 'Created On', 'Actions'];
            await expect(rs.tableHeaders).toContainText(expectedColumns);
        });

        await test.step('Verify default URL and pagination format', async () => {
            await expect(page).toHaveURL(/sort_field=createdAt.*sort_order=desc.*page=1/);
            await expect(rs.tableRows.first()).toBeVisible();
            await expect(rs.paginationDetails).toHaveText(/\d+\s*-\s*\d+\s+of\s+\d+/i);
        });
    });

    test('TC-RS-002: Known resource row displays formatted data', async ({ rs }) => {
        await test.step('Locate known application resource row', async () => {
            await rs.ensureResourceVisible(APPLICATION_RESOURCE_NAME);
            await expect(rs.resourceRowById(APPLICATION_RESOURCE_ID)).toBeVisible();
        });

        await test.step('Verify key cell values are present', async () => {
            const row = rs.resourceRowById(APPLICATION_RESOURCE_ID);
            await Promise.all([
                expect(row).toContainText(APPLICATION_RESOURCE_NAME),
                expect(row).toContainText(APPLICATION_RESOURCE_ID),
                expect(row).toContainText('com.datarealities.rdm.agent.android'),
                expect(row).toContainText(/Application|Archive/i),
                expect(row).toContainText(/Production/i),
                expect(row).toContainText(/1\.7\.12/),
                expect(row).toContainText(/APK|ZIP/i),
                expect(row).toContainText(/\d+(\.\d+)?\s*(KB|MB|GB)/i),
                expect(row).toContainText(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+(AM|PM)/)
            ]);
        });
    });

    test('TC-RS-003: Name link and Actions View navigate to detail', async ({ page, rs }) => {
        await test.step('Navigate via resource name link', async () => {
            await rs.ensureResourceVisible(APPLICATION_RESOURCE_NAME);
            await expect(rs.resourceNameLink(APPLICATION_RESOURCE_NAME)).toBeVisible();
            await rs.resourceNameLink(APPLICATION_RESOURCE_NAME).click();
            await expect(page).toHaveURL(new RegExp(`/user/resources/${APPLICATION_RESOURCE_ID}`));
            await expect(rs.detailBannerHeading).toBeVisible();
        });

        await test.step('Return to list and verify action menu items', async () => {
            await rs.gotoList();
            await rs.ensureResourceVisible(APPLICATION_RESOURCE_NAME);
            await rs.clickActionsMenu(APPLICATION_RESOURCE_NAME);
            await Promise.all([
                expect(rs.menuItemByName('View')).toBeVisible(),
                expect(rs.menuItemByName('Edit')).toBeVisible(),
                expect(rs.menuItemByName('Download')).toBeVisible(),
                expect(rs.menuItemByName('Delete')).toBeVisible()
            ]);
        });

        await test.step('Navigate via View action', async () => {
            await rs.clickActionItem('View');
            await expect(page).toHaveURL(new RegExp(`/user/resources/${APPLICATION_RESOURCE_ID}`));
            await expect(rs.detailBannerHeading).toBeVisible();
        });
    });
});
