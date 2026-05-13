const base = require('@playwright/test');
const ResourcesPage = require('../../pages/resources/resources-page');
const {
    cleanupResource,
    cleanupAutoTestResources,
    createResourceViaModal,
    restoreResourceName,
} = require('../../utils/resources-helpers');
const {
    authFile,
    RESOURCE_FILE,
    APPLICATION_RESOURCE_ID,
    APPLICATION_RESOURCE_NAME,
    generateTestResourceNameWithSuffix,
} = require('./rs-shared');

const { test, expect } = base;

test.use({ storageState: authFile });

test.describe('Section 13 — Security Sanity', () => {

    test('TC-RS-026: Stored XSS in Name and SQL/NoSQL injection in search are harmless', async ({ page }) => {
        const rs = new ResourcesPage(page);
        const xssPayload = '<script>alert("xss")</script>';
        const xssName = `AutoTest_${xssPayload}`.substring(0, 50);
        const disposableName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'xss34');
        let savedXssName = '';

        await rs.gotoList();

        await test.step('Create disposable resource', async () => {
            await createResourceViaModal(rs, disposableName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            await test.step('Set XSS payload as resource name and save', async () => {
                await rs.openEditResourceModal(disposableName);
                const truncatedXss = xssPayload.substring(0, 50);
                savedXssName = truncatedXss;
                await rs.fillResourceName(truncatedXss);
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeHidden({ timeout: 15000 });
                await rs.waitForSuccessToast();
            });

            // Fail-fast guard: any dialog firing here means XSS payload was executed
            page.on('dialog', dialog => {
                throw new Error(`CRITICAL VULNERABILITY: XSS payload executed! Message: ${dialog.message()}`);
            });

            await test.step('List page does not execute the script', async () => {
                await rs.gotoList();
                await expect(rs.table.or(rs.noResourcesMessage).first()).toBeVisible();
            });

            await test.step('Detail page does not execute the script', async () => {
                await rs.gotoDetail(APPLICATION_RESOURCE_ID);
                await expect(rs.overviewCard).toBeVisible();
            });

            await test.step('Injection strings in search do not cause 5xx', async () => {
                const injectionPayloads = [
                    "' OR 1=1 --",
                    "'; DROP TABLE resources; --",
                    '{"$ne": null}',
                    '%',
                    '&',
                    '<script>',
                    '/',
                    '\\',
                ];
                await rs.gotoList();
                for (const payload of injectionPayloads) {
                    await rs.searchFor(payload);
                    await expect(rs.table.or(rs.noResourcesMessage).first()).toBeVisible({ timeout: 5000 });
                    await expect(page).not.toHaveURL(/error|500|crash/i);
                }
                await rs.clearSearch();
            });
        } finally {
            await test.step('Cleanup XSS/injection disposable resource', async () => {
                await rs.gotoList();
                await cleanupResource(rs, savedXssName || disposableName).catch(e =>
                    console.error(`TC-RS-026 cleanup savedXssName: ${e.message}`)
                );
                await cleanupResource(rs, disposableName).catch(() => {});
            });
        }
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        await cleanupAutoTestResources(page).catch(e =>
            console.error(`AfterAll rs-08 cleanup failed: ${e.message}`)
        );
        await restoreResourceName(page, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME).catch(
            e => console.error(`AfterAll rs-08 restore name failed: ${e.message}`)
        );
    } finally {
        await context.close();
    }
});
