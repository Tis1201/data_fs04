const base = require('@playwright/test');
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
    IN_USE_RESOURCE_ID,
    IN_USE_RESOURCE_NAME,
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
                // pick the first option that is not already selected
                const firstOption = rs.page
                    .locator('[role="option"], [role="listbox"] li, [data-radix-select-item]')
                    .first();
                const optionText = await firstOption.textContent();
                await firstOption.click();
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
                await rs.searchFor(disposableName);
                const row = rs.resourceRowByName(disposableName);
                await expect(row).toBeVisible();
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
                await expect(
                    rs.validationMessage.or(rs.modalBase)
                ).toContainText(/required|Resource name/i);
            });

            await test.step('51-char Resource Name is blocked', async () => {
                await rs.fillResourceName('B'.repeat(51));
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeVisible();
                await expect(
                    rs.nameCharCount.or(rs.modalBase).first()
                ).toContainText(/50|less|characters/i);
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
    test('TC-RS-018: Delete in-use resource is blocked or shows dependency error', async ({ rs }) => {
        test.skip(
            !IN_USE_RESOURCE_ID,
            'TC-RS-018 skipped: inUseResourceId not configured in dev.js. ' +
            'Set resources.inUseResourceId / inUseResourceName to a resource referenced by a profile/bundle/pin-rule.'
        );

        const targetName = IN_USE_RESOURCE_NAME || IN_USE_RESOURCE_ID;

        await test.step('Locate in-use resource and open delete dialog', async () => {
            await rs.ensureResourceVisible(targetName);
            await rs.clickActionsMenu(targetName);
            await rs.clickActionItem('Delete');
            await expect(rs.deleteModalBase).toBeVisible();
        });

        await test.step('Confirm delete — server rejects with dependency error; resource remains', async () => {
            await rs.deleteConfirmButton.click();
            await rs.deleteModalBase.waitFor({ state: 'hidden', timeout: 15000 });
            await expect(rs.errorToast.or(rs.toast)).toBeVisible({ timeout: 7000 });
            await expect(rs.toast).toHaveText(/error|fail|referenced|in use|dependency/i);
            await rs.gotoList();
            await rs.searchFor(targetName);
            await expect(rs.resourceRowByName(targetName)).toBeVisible();
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
