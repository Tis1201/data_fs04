const { test, expect } = require('@playwright/test');
const ResourcesPage = require('../../pages/resources/resources-page');
const {
    authFile,
    APPLICATION_RESOURCE_ID,
    APPLICATION_RESOURCE_NAME,
    ARCHIVE_RESOURCE_ID,
    ARCHIVE_RESOURCE_NAME,
} = require('./rs-shared');

test.use({ storageState: authFile });

test.describe('Sections 8-10 — Resources Download, Detail & Consistency', () => {
    test('TC-RS-019: Download via Actions and detail link triggers download', async ({ page }) => {
        const rs = new ResourcesPage(page);

        await test.step('Download from list Actions menu', async () => {
            await rs.gotoList();
            await rs.clickActionsMenu(APPLICATION_RESOURCE_NAME);
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
            await rs.clickActionItem('Download');
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/\.apk|\.zip|\.cpk|\.deb|\.exe/i);
        });

        await test.step('Download from detail uploaded-file link', async () => {
            await rs.gotoDetail(APPLICATION_RESOURCE_ID);
            const downloadPromise = page.waitForEvent('download');
            await rs.resourceUploadedFileLink.click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/\.apk|\.zip|\.cpk|\.deb|\.exe/i);
        });
    });

    test('TC-RS-020: Detail overview card displays APK and ZIP resource fields', async ({ page }) => {
        const rs = new ResourcesPage(page);

        await test.step('Verify APK resource detail', async () => {
            await rs.gotoDetail(APPLICATION_RESOURCE_ID);
            await expect(rs.detailBannerHeading).toBeVisible();
            await expect(rs.detailBannerSubtitle).toBeVisible();
            await expect(rs.editSetButton).toBeEnabled();
            await expect(rs.overviewCard).toBeVisible();
            await expect(rs.overviewCard).toContainText(APPLICATION_RESOURCE_NAME);
            await expect(rs.overviewCard).toContainText('com.datarealities.rdm.agent.android');
            await expect(rs.overviewCard).toContainText('1.7.12');
            await expect(rs.overviewCard).toContainText(/Application|APK|Production|42/i);
            await expect(rs.overviewCard).toContainText(/[a-f0-9]{64}/i);
            await expect(rs.resourceUploadedFileLink).toBeVisible();
        });

        await test.step('Verify ZIP resource detail', async () => {
            await rs.gotoDetail(ARCHIVE_RESOURCE_ID);
            await expect(rs.overviewCard).toBeVisible();
            await expect(rs.overviewCard).toContainText(ARCHIVE_RESOURCE_NAME);
            await expect(rs.overviewCard).toContainText(/Archive|ZIP|1\.0\.0/i);
        });
    });

    test('TC-RS-021: List and detail fields are consistent for known resource', async ({ page }) => {
        const rs = new ResourcesPage(page);

        await test.step('Capture known resource row text from list', async () => {
            await rs.gotoList();
            await rs.ensureResourceVisible(APPLICATION_RESOURCE_NAME);
            await expect(rs.resourceRowByName(APPLICATION_RESOURCE_NAME)).toContainText(APPLICATION_RESOURCE_NAME);
        });

        await test.step('Open detail and compare key fields', async () => {
            await rs.gotoDetail(APPLICATION_RESOURCE_ID);
            await expect(rs.overviewCard).toContainText(APPLICATION_RESOURCE_NAME);
            await expect(rs.overviewCard).toContainText(/Application|Production|APK|1\.7\.12/i);
        });
    });
});
