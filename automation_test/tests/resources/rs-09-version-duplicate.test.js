/**
 * Section 15 — Resources Version, Duplicate Name & Install App Picker
 *
 * TC-RS-030: Upload two ZIPs with same extracted version — both succeed (duplicates allowed)
 * TC-RS-031: Upload APK with LOWER version after an existing higher-version APK [needs apkFile + apkFileHigher; falls back to single-upload check]
 * TC-RS-032: Upload APK with HIGHER version after an existing lower-version APK [needs apkFile + apkFileHigher; falls back to single-upload check]
 * TC-RS-033: ZIP + ZIP with the same display name — both allowed (no name uniqueness constraint)
 * TC-RS-034: Newly created resource appears at top of default list (sort: createdAt desc)
 * TC-RS-035: Newly created APK resource appears in Install Resources picker — at top of list (newest first) and searchable by name
 * TC-RS-036: Upload APK and ZIP back-to-back — both accepted (cross-type coexistence, no version conflict)
 * TC-RS-037: APK and ZIP with identical display name — both allowed (no cross-type name uniqueness)
 */

const base = require('@playwright/test');
const path = require('path');
const config = require('../../config/config-loader');
const ResourcesPage = require('../../pages/resources/resources-page');
const DeviceDetailPage = require('../../pages/devices/device-detail/device-detail-page');
const {
    cleanupResource,
    cleanupAutoTestResources,
    createResourceViaModal,
} = require('../../utils/resources-helpers');
const {
    authFile,
    RESOURCE_FILE,
    APK_RESOURCE_FILE,
    APK_RESOURCE_FILE_HIGHER,
    RESOURCE_URL,
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

const candidateDeviceIds = config.pageURL?.resources?.candidateDeviceIds
    || (config.pageURL?.devices?.installApp?.targetDeviceId ? [config.pageURL.devices.installApp.targetDeviceId] : []);

test.describe('Section 15 — Resources Version, Duplicate Name & Install App Picker', () => {

    // ── TC-RS-030 ───────────────────────────────────────────────────────────────
    test('TC-RS-030: Upload two ZIPs with same extracted version — both succeed', async ({ rs }) => {
        const nameA = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'ver30a');
        const nameB = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'ver30b');

        try {
            await test.step('Create first ZIP resource', async () => {
                await createResourceViaModal(rs, nameA, RESOURCE_FILE);
            });

            await test.step('Create second ZIP resource with same file (same version)', async () => {
                await createResourceViaModal(rs, nameB, RESOURCE_FILE);
            });

            await test.step('Both resources appear in list — system allows same-version duplicates', async () => {
                await rs.gotoList();
                await rs.searchFor(nameA);
                await expect(rs.resourceRowByName(nameA)).toBeVisible();

                await rs.clearSearch();
                await rs.searchFor(nameB);
                await expect(rs.resourceRowByName(nameB)).toBeVisible();
            });
        } finally {
            await cleanupResource(rs, nameA).catch(e => console.error(`TC-RS-030 cleanup A: ${e.message}`));
            await cleanupResource(rs, nameB).catch(e => console.error(`TC-RS-030 cleanup B: ${e.message}`));
        }
    });

    // ── TC-RS-031 ───────────────────────────────────────────────────────────────
    test('TC-RS-031: Upload APK with LOWER version (after existing higher) is accepted', async ({ rs }) => {
        if (!APK_RESOURCE_FILE) {
            test.skip(true, 'No APK file configured (apkFile is empty in dev.js). Set resources.apkFile to enable this test.');
        }

        const nameHigh = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'apkHigh31');
        const nameLow = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'apkLow31');
        const hasBothApks = !!APK_RESOURCE_FILE_HIGHER;

        try {
            if (hasBothApks) {
                // Realistic scenario: two APKs with the SAME packageName, different versions.
                await test.step('Upload baseline APK (higher version)', async () => {
                    await createResourceViaModal(rs, nameHigh, APK_RESOURCE_FILE_HIGHER);
                });

                await test.step('Upload APK with LOWER version (same packageName)', async () => {
                    await rs.gotoList();
                    await createResourceViaModal(rs, nameLow, APK_RESOURCE_FILE);
                });

                await test.step('Both APK versions coexist in the list', async () => {
                    await rs.gotoList();
                    await rs.searchFor(nameHigh);
                    await expect(rs.resourceRowByName(nameHigh)).toBeVisible();

                    await rs.clearSearch();
                    await rs.searchFor(nameLow);
                    await expect(rs.resourceRowByName(nameLow)).toBeVisible();
                });
            } else {
                // Fallback when only one APK is configured: just verify upload succeeds.
                await test.step('Upload APK file (single-fixture fallback)', async () => {
                    await createResourceViaModal(rs, nameLow, APK_RESOURCE_FILE);
                });

                await test.step('APK appears in list — lower version than existing is allowed', async () => {
                    await rs.gotoList();
                    await rs.searchFor(nameLow);
                    await expect(rs.resourceRowByName(nameLow)).toBeVisible();
                });
            }
        } finally {
            await cleanupResource(rs, nameLow).catch(e => console.error(`TC-RS-031 cleanup low: ${e.message}`));
            if (hasBothApks) {
                await cleanupResource(rs, nameHigh).catch(e => console.error(`TC-RS-031 cleanup high: ${e.message}`));
            }
        }
    });

    // ── TC-RS-032 ───────────────────────────────────────────────────────────────
    test('TC-RS-032: Upload APK with HIGHER version (after existing lower) is accepted', async ({ rs }) => {
        if (!APK_RESOURCE_FILE) {
            test.skip(true, 'No APK file configured (apkFile is empty in dev.js). Set resources.apkFile to enable this test.');
        }

        const nameLow = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'apkLow32');
        const nameHigh = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'apkHigh32');
        const hasBothApks = !!APK_RESOURCE_FILE_HIGHER;

        try {
            if (hasBothApks) {
                await test.step('Upload baseline APK (lower version)', async () => {
                    await createResourceViaModal(rs, nameLow, APK_RESOURCE_FILE);
                });

                await test.step('Upload APK with HIGHER version (same packageName)', async () => {
                    await rs.gotoList();
                    await createResourceViaModal(rs, nameHigh, APK_RESOURCE_FILE_HIGHER);
                });

                await test.step('Both APK versions coexist in the list', async () => {
                    await rs.gotoList();
                    await rs.searchFor(nameLow);
                    await expect(rs.resourceRowByName(nameLow)).toBeVisible();

                    await rs.clearSearch();
                    await rs.searchFor(nameHigh);
                    await expect(rs.resourceRowByName(nameHigh)).toBeVisible();
                });
            } else {
                await test.step('Upload APK file (single-fixture fallback)', async () => {
                    await createResourceViaModal(rs, nameHigh, APK_RESOURCE_FILE);
                });

                await test.step('APK appears in list — higher version is allowed', async () => {
                    await rs.gotoList();
                    await rs.searchFor(nameHigh);
                    await expect(rs.resourceRowByName(nameHigh)).toBeVisible();
                });
            }
        } finally {
            await cleanupResource(rs, nameHigh).catch(e => console.error(`TC-RS-032 cleanup high: ${e.message}`));
            if (hasBothApks) {
                await cleanupResource(rs, nameLow).catch(e => console.error(`TC-RS-032 cleanup low: ${e.message}`));
            }
        }
    });

    // ── TC-RS-033 ───────────────────────────────────────────────────────────────
    test('TC-RS-033: ZIP and ZIP with identical display name — both created (no name uniqueness constraint)', async ({ rs }) => {
        const sharedName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'dupName33');

        try {
            await test.step('Create first resource with the shared name', async () => {
                await createResourceViaModal(rs, sharedName, RESOURCE_FILE);
            });

            await test.step('Create second resource with the same name', async () => {
                await rs.gotoList();
                await createResourceViaModal(rs, sharedName, RESOURCE_FILE);
            });

            await test.step('Search returns 2 rows — system allows duplicate display names', async () => {
                await rs.gotoList();
                await rs.searchFor(sharedName);

                const rows = rs.page.locator('table tbody tr').filter({ hasText: sharedName });
                await expect(rows).toHaveCount(2, { timeout: 10000 });
            });
        } finally {
            // Delete all resources matching the shared name
            await cleanupAutoTestResources(rs.page).catch(e => console.error(`TC-RS-033 cleanup: ${e.message}`));
        }
    });

    // ── TC-RS-034 ───────────────────────────────────────────────────────────────
    test('TC-RS-034: Newly created resource appears at top of default list (sorted by createdAt desc)', async ({ rs }) => {
        const resourceName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'top34');

        try {
            await test.step('Create a new resource', async () => {
                await createResourceViaModal(rs, resourceName, RESOURCE_FILE);
            });

            await test.step('Navigate to resource list with default sort (createdAt desc)', async () => {
                await rs.page.goto(`${RESOURCE_URL}?sort_field=createdAt&sort_order=desc&page=1`);
                await rs.page.waitForLoadState('domcontentloaded');
                const firstRow = rs.page.locator('table tbody tr').first();
                await expect(firstRow).toBeVisible({ timeout: 15000 });
            });

            await test.step('First row in the list is the newly created resource', async () => {
                const firstRow = rs.page.locator('table tbody tr').first();
                await expect(firstRow).toContainText(resourceName, { timeout: 10000 });
            });
        } finally {
            await cleanupResource(rs, resourceName).catch(e => console.error(`TC-RS-034 cleanup: ${e.message}`));
        }
    });

    // ── TC-RS-035 ───────────────────────────────────────────────────────────────
    test('TC-RS-035: Newly created APK resource appears in Install Resources picker — at top of list (newest first) and searchable', async ({ page, rs }) => {
        if (!APK_RESOURCE_FILE) {
            test.skip(true, 'No APK file configured. Set resources.apkFile to enable this test.');
        }
        if (!candidateDeviceIds.length) {
            test.skip(true, 'No candidateDeviceIds configured for Install Resources test.');
        }

        const resourceName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'picker35');
        const devicePage = new DeviceDetailPage(page, {
            deviceId: candidateDeviceIds[0],
            timeouts: { pageLoad: config.timeouts?.pageLoadMs || 30000 },
        });

        const dialog = page.getByRole('dialog', { name: /Install Resources/i });

        try {
            await test.step('Create a new APK resource', async () => {
                await createResourceViaModal(rs, resourceName, APK_RESOURCE_FILE);
            });

            await test.step('Navigate to device Resources tab', async () => {
                await page.goto(`${devicePage.url}?tab=resources`);
                await page.waitForLoadState('domcontentloaded');
            });

            await test.step('Open Install Resources modal', async () => {
                const installResourcesBtn = page.getByRole('button', { name: /install resources/i });
                await expect(installResourcesBtn).toBeVisible({ timeout: 15000 });
                await installResourcesBtn.click();
                await expect(dialog).toBeVisible({ timeout: 10000 });
            });

            await test.step('New APK is at top of picker list — no search needed (picker sorts by createdAt desc)', async () => {
                // Wait for listbox to finish loading
                await expect(dialog.getByText(/^Loading…$/)).toHaveCount(0, { timeout: 15000 });

                const options = page.locator('#app-picker-listbox .app-picker-option');
                // index 0 = "Select All" row; index 1 = first real resource
                await expect(options.nth(1)).toBeVisible({ timeout: 10000 });
                await expect(options.nth(1)).toContainText(resourceName, { timeout: 10000 });
            });

            await test.step('Resource is also searchable by name in the picker', async () => {
                const searchInput = dialog.getByPlaceholder('Search and select app');
                await searchInput.fill(resourceName);

                const targetOption = page.locator('#app-picker-listbox .app-picker-option')
                    .filter({ hasText: resourceName });

                await expect(targetOption).toBeVisible({
                    timeout: 10000,
                    message: `Resource "${resourceName}" should appear in Install Resources picker`
                });
            });

            await test.step('Close Install Resources modal', async () => {
                const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
                await cancelBtn.click();
                await expect(dialog).toBeHidden({ timeout: 10000 });
            });
        } finally {
            await rs.gotoList().catch(e => console.error(`TC-RS-035 navigate to list failed: ${e.message}`));
            await cleanupResource(rs, resourceName).catch(e => console.error(`TC-RS-035 cleanup: ${e.message}`));
        }
    });

    // ── TC-RS-036 ───────────────────────────────────────────────────────────────
    test('TC-RS-036: Upload APK and ZIP back-to-back — both accepted (cross-type, no version conflict)', async ({ rs }) => {
        if (!APK_RESOURCE_FILE) {
            test.skip(true, 'No APK file configured. Set resources.apkFile to enable this test.');
        }

        const nameApk = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'xtype36apk');
        const nameZip = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'xtype36zip');

        try {
            await test.step('Create APK resource first', async () => {
                await createResourceViaModal(rs, nameApk, APK_RESOURCE_FILE);
            });

            await test.step('Create ZIP resource right after (independent of APK version)', async () => {
                await rs.gotoList();
                await createResourceViaModal(rs, nameZip, RESOURCE_FILE);
            });

            await test.step('Both resources coexist — system allows APK + ZIP with unrelated versions', async () => {
                await rs.gotoList();
                await rs.searchFor(nameApk);
                await expect(rs.resourceRowByName(nameApk)).toBeVisible();

                await rs.clearSearch();
                await rs.searchFor(nameZip);
                await expect(rs.resourceRowByName(nameZip)).toBeVisible();
            });
        } finally {
            await cleanupResource(rs, nameApk).catch(e => console.error(`TC-RS-036 cleanup APK: ${e.message}`));
            await cleanupResource(rs, nameZip).catch(e => console.error(`TC-RS-036 cleanup ZIP: ${e.message}`));
        }
    });

    // ── TC-RS-037 ───────────────────────────────────────────────────────────────
    test('TC-RS-037: APK and ZIP with identical display name — both allowed (no cross-type uniqueness)', async ({ rs }) => {
        if (!APK_RESOURCE_FILE) {
            test.skip(true, 'No APK file configured. Set resources.apkFile to enable this test.');
        }

        const sharedName = generateTestResourceNameWithSuffix('AutoTest_RSRC', 'xname37');

        try {
            await test.step('Create APK resource with the shared name', async () => {
                await createResourceViaModal(rs, sharedName, APK_RESOURCE_FILE);
            });

            await test.step('Create ZIP resource with the SAME name', async () => {
                await rs.gotoList();
                await createResourceViaModal(rs, sharedName, RESOURCE_FILE);
            });

            await test.step('Search returns 2 rows — duplicate name across APK/ZIP is allowed', async () => {
                await rs.gotoList();
                await rs.searchFor(sharedName);

                const rows = rs.page.locator('table tbody tr').filter({ hasText: sharedName });
                await expect(rows).toHaveCount(2, { timeout: 10000 });
            });
        } finally {
            await cleanupAutoTestResources(rs.page).catch(e => console.error(`TC-RS-037 cleanup: ${e.message}`));
        }
    });

});
