const { createBulkTest } = require('./bd-shared');
const {
  createDraftOpenDetail,
  assertAddDeviceModalShell,
  assertAddDeviceModalInvalidSearch,
  T,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 7 — Devices tab modals (TC-BULK-DEVICES-001,007,008,011)', () => {
  test('TC-BULK-DEVICES-001: Add Device modal structure', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DevModal ${Date.now()}` });

    await test.step('Add Device modal: search, selected section, Add disabled', async () => {
      const dialog = await bulkPage.openAddDeviceModal();
      await assertAddDeviceModalShell(bulkPage, dialog);
      await bulkPage.page.keyboard.press('Escape').catch(() => {});
      await expect(dialog).toBeHidden({ timeout: bulkPage.timeout }).catch(() => {});
    });
  });

  test('TC-BULK-DEVICES-007: Import CSV modal', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk ImportCsv ${Date.now()}` });
    await bulkPage.openDevicesTab();

    await test.step('Import CSV dialog with template and disabled Import', async () => {
      const dialog = await bulkPage.openImportCsvModal();
      await expect(dialog.getByText(T.CSV_TEMPLATE)).toBeVisible();
      await expect(dialog.getByText(T.UPLOAD_FILE)).toBeVisible();
      const importBtn = dialog.getByRole('button', { name: /^import$/i });
      await expect(importBtn).toBeDisabled();
      await dialog.getByRole('button', { name: T.CANCEL }).click();
      await expect(dialog).toBeHidden({ timeout: bulkPage.timeout }).catch(() => {});
    });
  });

  test('TC-BULK-DEVICES-008: Assign by tag modal', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk AssignTag ${Date.now()}` });
    await bulkPage.openDevicesTab();

    await test.step('Assign by tag dialog with tag search and disabled Add', async () => {
      const dialog = await bulkPage.openAssignByTagModal();
      await expect(bulkPage.getTagSearchInput()).toBeVisible();
      const addBtn = dialog.getByRole('button', { name: new RegExp(`^${T.ADD}$`) });
      await expect(addBtn).toBeDisabled();
      await dialog.getByRole('button', { name: T.CANCEL }).click();
      await expect(dialog).toBeHidden({ timeout: bulkPage.timeout }).catch(() => {});
    });
  });

  test('TC-BULK-DEVICES-011: Add Device search — no results, Add disabled', async ({ page }) => {
    test.setTimeout(3 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk DevSearch ${Date.now()}` });

    await test.step('Invalid device keyword in Add Device modal', async () => {
      await bulkPage.openAddDeviceModal();
      await assertAddDeviceModalInvalidSearch(bulkPage, `zz_no_device_${Date.now()}`);
    });
  });
});
