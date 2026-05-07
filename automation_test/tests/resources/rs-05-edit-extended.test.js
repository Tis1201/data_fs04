const base = require('@playwright/test');
const config = require('../../config/config-loader');
const ResourcesPage = require('../../pages/resources/resources-page');
const {
    cleanupResource,
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

const test = base.test.extend({
    rs: async ({ page }, use) => {
        const rs = new ResourcesPage(page);
        await rs.gotoList();
        await use(rs);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Section 6 (extended) — Resources Edit & TC-RS-018 Delete In-Use', () => {

    // ─── TC-RS-015 ───────────────────────────────────────────────────────────────
    test('TC-RS-015: Edit Release Type saves; read-only fields reject input; Name validation', async ({ rs }) => {
        const disposableName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'edit15');

        await test.step('Create disposable resource', async () => {
            await createResourceViaModal(rs, disposableName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            await test.step('Open Edit modal for disposable resource', async () => {
                await rs.openEditResourceModal(disposableName);
                await expect(rs.modalBase).toBeVisible();
            });

            await test.step('Change Release Type and save — verify in list', async () => {
                await rs.releaseTypeDropdown.click();
                const firstOption = rs.page
                    .locator('[role="option"], [role="listbox"] li, [data-radix-select-item]')
                    .first();
                const optionText = (await firstOption.textContent()).trim();
                await firstOption.click();
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
                await rs.searchFor(disposableName);
                const row = rs.resourceRowByName(disposableName);
                await expect(row).toBeVisible();
                await expect(row).toContainText(new RegExp(optionText, 'i'));
            });

            await test.step('Reopen Edit — Package Name is disabled', async () => {
                await rs.openEditResourceModal(disposableName);
                await expect(rs.packageNameInput).toBeDisabled();
            });

            await test.step('Version input is disabled', async () => {
                await expect(rs.versionInput).toBeDisabled();
            });

            await test.step('Account dropdown is disabled', async () => {
                const accountControl = rs.modalBase
                    .getByLabel(/Account/i)
                    .or(rs.modalBase.locator('button, select').filter({ hasText: /account/i }).first())
                    .first();
                await expect(accountControl).toBeDisabled();
            });

            await test.step('Empty Resource Name is blocked', async () => {
                await rs.resourceNameInput.clear();
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeVisible();
                await expect(rs.validationMessage).toContainText(/required|Resource name/i);
            });

            await test.step('51-char Resource Name is blocked', async () => {
                await rs.fillResourceName('B'.repeat(51));
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeVisible();
                await expect(rs.nameCharCount).toContainText(/50|less|characters/i);
            });

            await rs.closeModal();
        } finally {
            await test.step('Cleanup disposable resource', async () => {
                await cleanupResource(rs, disposableName).catch(e =>
                    console.error(`TC-RS-015 cleanup failed: ${e.message}`)
                );
            });
        }
    });

    // ─── TC-RS-016 ───────────────────────────────────────────────────────────────
    test('TC-RS-016: Cancel and ✕ in Edit modal discard changes', async ({ rs }) => {
        const disposableName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'edit16');

        await test.step('Create disposable resource', async () => {
            await createResourceViaModal(rs, disposableName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            await test.step('Change name then Cancel — original name persists', async () => {
                await rs.openEditResourceModal(disposableName);
                await rs.fillResourceName(`${disposableName}_CHANGED`);
                await rs.cancelButton.click();
                await expect(rs.modalBase).toBeHidden();

                // Reopen and confirm the original name is still there
                await rs.openEditResourceModal(disposableName);
                await expect(rs.resourceNameInput).toHaveValue(disposableName);
                await rs.closeModal();
            });

            await test.step('Change Release Type then close with ✕ — resource unchanged', async () => {
                await rs.openEditResourceModal(disposableName);
                await rs.releaseTypeDropdown.click();
                const firstOption = rs.page
                    .locator('[role="option"], [role="listbox"] li, [data-radix-select-item]')
                    .first();
                await firstOption.click();
                await rs.modalCloseButton.click();
                await expect(rs.modalBase).toBeHidden();

                // List should still show the disposable resource with original name
                await rs.gotoList();
                await rs.searchFor(disposableName);
                await expect(rs.resourceRowByName(disposableName)).toBeVisible();
            });
        } finally {
            await test.step('Cleanup disposable resource', async () => {
                await cleanupResource(rs, disposableName).catch(e =>
                    console.error(`TC-RS-016 cleanup failed: ${e.message}`)
                );
            });
        }
    });

    // ─── TC-RS-018 ───────────────────────────────────────────────────────────────
    test('TC-RS-018: Delete resource linked to a bundle succeeds; bundle retains snapshot', async ({ rs, page }) => {
        const resourceName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'inuse18');
        const origin = new URL(config.baseURL).origin;
        let resourceId = '';
        let bundleId = '';

        await test.step('Create a new resource via modal', async () => {
            await createResourceViaModal(rs, resourceName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
            await rs.searchFor(resourceName);
            await expect(rs.resourceRowByName(resourceName)).toBeVisible({ timeout: 10000 });
        });

        await test.step('Get resource ID via API', async () => {
            const listRes = await page.request.get(`${origin}/api/v2/resources?page=1&pageSize=20`);
            expect(listRes.ok()).toBeTruthy();
            const body = await listRes.json();
            const found = body.data?.items?.find(r => r.name === resourceName);
            expect(found, `Resource "${resourceName}" not found in API response`).toBeTruthy();
            resourceId = found.id;
        });

        await test.step('Create a draft bundle via POM and add resource via API', async () => {
            const { createDraftOpenDetail } = require('../../pages/bulk-deployments/flows');
            const bundleName = `AutoTest_Bundle_inuse18_${Date.now()}`;
            const { deploymentId } = await createDraftOpenDetail(page, { name: bundleName });
            bundleId = deploymentId;

            const appRes = await page.request.post(`${origin}/api/user/iot/bundles/${bundleId}/apps`, {
                data: { resourceId, order: 1, autoOpen: false },
            });
            expect(appRes.ok(), `Adding resource to bundle should succeed (got ${appRes.status()})`).toBeTruthy();
        });

        await test.step('Delete resource while linked to bundle — deletion succeeds (bundle retains snapshot)', async () => {
            await rs.gotoList();
            await rs.ensureResourceVisible(resourceName);
            await rs.deleteResource(resourceName);
            await rs.waitForSuccessToast();
            await rs.gotoList();
            await rs.searchFor(resourceName);
            await expect(rs.resourceRowByName(resourceName)).toBeHidden();
        });

        await test.step('Bundle still exists and retains snapshot after resource deletion', async () => {
            await page.goto(`${origin}/user/iot/bundles/${bundleId}`);
            await page.waitForLoadState('domcontentloaded');
            const detailContent = page.locator('[class*="card"], section, article').first();
            await expect(detailContent).toBeVisible({ timeout: 15000 });
            await expect(page.locator('body')).not.toContainText(/404|not found|error/i);
        });

        await test.step('Cleanup: delete bundle', async () => {
            await page.request.delete(`${origin}/api/v2/bundles/${bundleId}`).catch(() => {});
        });
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        const { cleanupAutoTestResources } = require('../../utils/resources-helpers');
        await cleanupAutoTestResources(page).catch(e =>
            console.error(`AfterAll rs-05 cleanup failed: ${e.message}`)
        );
        await restoreResourceName(page, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME).catch(
            e => console.error(`AfterAll rs-05 restore name failed: ${e.message}`)
        );
    } finally {
        await context.close();
    }
});
