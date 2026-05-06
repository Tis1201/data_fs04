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

const test = base.test.extend({
    rs: async ({ page }, use) => {
        const rs = new ResourcesPage(page);
        await rs.gotoList();
        await use(rs);
    }
});
const expect = test.expect;

test.use({ storageState: authFile });

test.describe('Sections 5-7 — Resources Create, Edit & Delete', () => {
    test('TC-RS-010: Add Resource modal defaults and ZIP upload create resource', async ({ rs }) => {
        const resourceName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'create');

        try {
            await test.step('Open Add Resource modal and verify defaults', async () => {
                await rs.openAddResourceModal();
                await expect(rs.modalBase).toBeVisible();
                await expect(rs.modalTitle).toContainText(/Add resource/i);
                await expect(rs.fileInput).toBeAttached();
                await expect(rs.resourceNameInput).toBeVisible();
                await expect(rs.addSubmitButton).toBeVisible();
                await expect(rs.cancelButton).toBeVisible();
                await expect(rs.modalBase).toContainText(/Maximum file size 500 MB|allowed file types/i);
            });

            await test.step('Upload ZIP, fill unique name and submit', async () => {
                await rs.uploadResourceFile(RESOURCE_FILE);
                await rs.fillResourceName(resourceName);
                await rs.addSubmitButton.click();
                await expect(rs.modalBase).toBeHidden({ timeout: 20000 });
                await rs.waitForSuccessToast();
            });

            await test.step('Verify new resource appears in list', async () => {
                await rs.gotoList();
                await rs.searchFor(resourceName);
                await expect(rs.resourceRowByName(resourceName)).toBeVisible();
                await expect(rs.resourceRowByName(resourceName)).toContainText(/Archive|ZIP|Production/i);
            });
        } finally {
            await test.step('Cleanup created resource', async () => {
                await cleanupResource(rs, resourceName).catch(e => console.error(`TC-RS-010 cleanup failed: ${e.message}`));
            });
        }
    });

    test('TC-RS-011/012: Add Resource validations for name and file', async ({ rs }) => {
        await test.step('Missing file keeps modal open', async () => {
            await rs.openAddResourceModal();
            await rs.fillResourceName(generateTestResourceNameWithSuffix('AutoTest_RSRC', 'nofile'));
            await rs.addSubmitButton.click();
            await expect(rs.modalBase).toBeVisible();
        });

        await test.step('Empty and over-limit Resource Name are blocked', async () => {
            await rs.uploadResourceFile(RESOURCE_FILE);
            await rs.resourceNameInput.clear();
            await rs.addSubmitButton.click();
            await expect(rs.modalBase).toBeVisible();
            await expect(rs.validationMessage).toBeVisible();

            await rs.fillResourceName('A'.repeat(51));
            await rs.addSubmitButton.click();
            await expect(rs.modalBase).toBeVisible();
            await expect(rs.nameCharCount).toBeVisible();
        });

        await rs.closeModal();
    });

    test('TC-RS-013: Cancel and close Add modal discard data', async ({ rs }) => {
        const unsavedName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'cancel');

        await test.step('Cancel closes modal and does not create resource', async () => {
            await rs.openAddResourceModal();
            await rs.uploadResourceFile(RESOURCE_FILE);
            await rs.fillResourceName(unsavedName);
            await rs.cancelButton.click();
            await expect(rs.modalBase).toBeHidden();
        });

        await test.step('Verify unsaved resource is absent', async () => {
            await rs.searchFor(unsavedName);
            await expect(rs.resourceRowByName(unsavedName)).toBeHidden();
        });
    });

    test('TC-RS-014: Edit modal pre-fills and saves Resource Name', async ({ page, rs }) => {
        const editedName = `${APPLICATION_RESOURCE_NAME}-edited`;

        try {
            await test.step('Open edit modal from Actions and verify prefill', async () => {
                await rs.openEditResourceModal(APPLICATION_RESOURCE_NAME);
                await expect(rs.modalBase).toBeVisible();
                await expect(rs.modalTitle).toContainText(/Edit resource/i);
                await expect(rs.resourceNameInput).toHaveValue(APPLICATION_RESOURCE_NAME);
                await expect(rs.packageNameInput).toBeDisabled();
                await expect(rs.versionInput).toBeDisabled();
            });

            await test.step('Update name and save', async () => {
                await rs.fillResourceName(editedName);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
            });
        } finally {
            await test.step('Restore original resource name', async () => {
                await restoreResourceName(page, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME);
            });
        }
    });

    test('TC-RS-017: Delete with confirmation and cancel keeps resource', async ({ rs }) => {
        const resourceName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'delete');

        await test.step('Setup temporary resource', async () => {
            await createResourceViaModal(rs, resourceName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            await test.step('Open delete modal then cancel', async () => {
                await rs.clickActionsMenu(resourceName);
                await rs.clickActionItem('Delete');
                await expect(rs.deleteModalBase).toBeVisible();
                await rs.deleteCancelButton.click();
                await expect(rs.deleteModalBase).toBeHidden();
                await expect(rs.resourceRowByName(resourceName)).toBeVisible();
            });

            await test.step('Confirm delete and verify removal', async () => {
                await rs.deleteResource(resourceName);
                await rs.waitForSuccessToast();
                await expect(rs.resourceRowByName(resourceName)).toBeHidden();
            });
        } finally {
            await test.step('Safety cleanup', async () => {
                await cleanupResource(rs, resourceName).catch(e => console.error(`TC-RS-017 cleanup failed: ${e.message}`));
            });
        }
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        await cleanupAutoTestResources(page).catch(e => console.error(`AfterAll cleanup AutoTest resources failed: ${e.message}`));
        await restoreResourceName(page, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME)
            .catch(e => console.error(`AfterAll restore resource name failed: ${e.message}`));
    } finally {
        await context.close();
    }
});
