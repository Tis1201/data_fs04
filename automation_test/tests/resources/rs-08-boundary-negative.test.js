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

test.describe('Section 14 — Boundary & Negative Inputs', () => {

    // ─── TC-RS-027 ───────────────────────────────────────────────────────────────
    test('TC-RS-027: Resource Name BVA (0/1/50 chars) and whitespace handling', async ({ rs }) => {
        const baseName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'bva39');

        await test.step('Create disposable resource to edit', async () => {
            await createResourceViaModal(rs, baseName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            // ── BVA: 0 chars (empty) ─────────────────────────────────────────
            await test.step('0 chars — Save is blocked', async () => {
                await rs.openEditResourceModal(baseName);
                await rs.resourceNameInput.clear();
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeVisible();
                await expect(rs.validationMessage.or(rs.modalBase)).toContainText(/required|Resource name/i);
                await rs.closeModal();
            });

            // ── BVA: 1 char ──────────────────────────────────────────────────
            await test.step('1 char — Save succeeds; counter shows 1/50', async () => {
                await rs.openEditResourceModal(baseName);
                await rs.fillResourceName('A');
                await expect(rs.nameCharCount).toHaveText(/1\s*\/\s*50/);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
                await rs.searchFor('A');
                await expect(rs.tableRows.first()).toBeVisible();
                // Restore name for next steps
                await rs.openEditResourceModal('A');
                await rs.fillResourceName(baseName);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
            });

            // ── BVA: 50 chars ────────────────────────────────────────────────
            await test.step('50 chars — Save succeeds; counter shows 50/50', async () => {
                const name50 = 'AutoT_' + 'Y'.repeat(44); // exactly 50
                await rs.openEditResourceModal(baseName);
                await rs.fillResourceName(name50);
                await expect(rs.nameCharCount).toHaveText(/50\s*\/\s*50/);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
                await rs.searchFor(name50);
                await expect(rs.resourceRowByName(name50)).toBeVisible();
                // Restore
                await rs.openEditResourceModal(name50);
                await rs.fillResourceName(baseName);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
            });

            // ── Whitespace-only ──────────────────────────────────────────────
            await test.step('Whitespace-only name is treated as empty — Save blocked', async () => {
                await rs.openEditResourceModal(baseName);
                await rs.fillResourceName('     ');
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeVisible();
                await rs.closeModal();
            });

            // ── Leading/trailing whitespace ──────────────────────────────────
            await test.step('Leading/trailing whitespace is trimmed or rejected on save', async () => {
                await rs.openEditResourceModal(baseName);
                await rs.fillResourceName('  Valid Name  ');
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeHidden({ timeout: 10000 });
                await rs.gotoList();
                await rs.searchFor('Valid Name');
                await expect(rs.resourceNameLink('Valid Name')).toContainText('Valid Name');
                // Restore
                await rs.openEditResourceModal('Valid Name');
                await rs.fillResourceName(baseName);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
            });
        } finally {
            await cleanupResource(rs, baseName).catch(e =>
                console.error(`TC-RS-027 cleanup baseName: ${e.message}`)
            );
            // Clean up any 1-char "A" resource that might remain
            await cleanupResource(rs, 'A').catch(() => {});
        }
    });

    // ─── TC-RS-028 ───────────────────────────────────────────────────────────────
    test('TC-RS-028: Unicode, emoji, RTL text in Resource Name renders correctly', async ({ rs, page }) => {
        const baseName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'uni40');

        await test.step('Create disposable resource', async () => {
            await createResourceViaModal(rs, baseName, RESOURCE_FILE);
            await rs.waitForSuccessToast();
            await rs.gotoList();
        });

        try {
            // ── CJK + emoji ──────────────────────────────────────────────────
            await test.step('Set CJK + emoji name and save', async () => {
                const cjkName = '测试资源テスト🚀'; // 9 chars, well within 50
                await rs.openEditResourceModal(baseName);
                await rs.fillResourceName(cjkName);
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeHidden({ timeout: 15000 });
                await rs.waitForSuccessToast();
                await rs.gotoList();
                await rs.searchFor('测试');
                const row = rs.resourceRowByName(cjkName);
                await expect(row).toBeVisible();
                await expect(row).toContainText(cjkName);
                // Detail page
                await rs.resourceNameLink(cjkName).click();
                await expect(rs.overviewCard).toContainText(cjkName);
                await rs.gotoList();
                // Restore
                await rs.openEditResourceModal(cjkName);
                await rs.fillResourceName(baseName);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
            });

            // ── RTL ──────────────────────────────────────────────────────────
            await test.step('Set RTL Arabic name and save', async () => {
                const rtlName = 'اختبار مورد'; // 11 chars
                await rs.openEditResourceModal(baseName);
                await rs.fillResourceName(rtlName);
                await rs.saveButton.click();
                await expect(rs.modalBase).toBeHidden({ timeout: 15000 });
                await rs.waitForSuccessToast();
                await rs.gotoList();
                await rs.searchFor('اختبار');
                await expect(rs.tableRows.first()).toContainText(/اختبار/);
                // No layout break (page still interactive)
                await expect(rs.table).toBeVisible();
                // Restore
                await rs.openEditResourceModal(rtlName);
                await rs.fillResourceName(baseName);
                await rs.saveResourceModal();
                await rs.waitForSuccessToast();
                await rs.gotoList();
            });
        } finally {
            await cleanupResource(rs, baseName).catch(e =>
                console.error(`TC-RS-028 cleanup: ${e.message}`)
            );
        }
    });

    // ─── TC-RS-029 ───────────────────────────────────────────────────────────────
    test('TC-RS-029: Search — special chars, 200-char query, whitespace-only', async ({ page, rs }) => {
        const specialChars = ['%', '&', '<', '/', '\\'];

        await test.step('Each special char is URL-encoded and returns no 5xx', async () => {
            for (const char of specialChars) {
                await rs.searchFor(char);
                await expect(rs.table.or(rs.noResourcesMessage).first()).toBeVisible({ timeout: 5000 });
                const currentUrl = page.url();
                // Ensure we're still on the resources page (no 500/crash redirect)
                expect(currentUrl).toMatch(/\/resources/);
                await rs.clearSearch();
            }
        });

        await test.step('200-char query does not crash (accepted or truncated)', async () => {
            const longQuery = 'A'.repeat(200);
            await rs.searchFor(longQuery);
            await expect(rs.table.or(rs.noResourcesMessage).first()).toBeVisible({ timeout: 5000 });
            await expect(page).not.toHaveURL(/500|error|crash/i);
            await rs.clearSearch();
        });

        await test.step('Whitespace-only search is treated as empty — full list restored', async () => {
            await rs.searchInput.click();
            await rs.searchInput.fill('     ');
            await expect(page).not.toHaveURL(/search=/);
            await expect(rs.tableRows.first()).toBeVisible();
        });
    });
});

test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
        await cleanupAutoTestResources(page).catch(e =>
            console.error(`AfterAll rs-10 cleanup failed: ${e.message}`)
        );
        await restoreResourceName(page, APPLICATION_RESOURCE_ID, APPLICATION_RESOURCE_NAME).catch(
            e => console.error(`AfterAll rs-10 restore name failed: ${e.message}`)
        );
    } finally {
        await context.close();
    }
});
