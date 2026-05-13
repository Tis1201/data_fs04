const { createBulkTest, bulkTestData, bulkLimits } = require('./bd-shared');
const {
  T,
  buildDraftPayload,
  createBulkPage,
  createDraftOpenDetail,
  createDraftWithAssignments,
  buildFutureSchedulePayload,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('TC-BULK-CREATE / VERSION — extended create flows', () => {
  test('TC-BULK-CREATE-001: Draft + one app + one online device', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const name = `Bulk MinFull ${Date.now()}`;
    const { bulkPage, payload } = await createDraftWithAssignments(page, {
      payloadOverrides: { name },
      appNames: [bulkTestData.digitalSignageAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch],
    });

    await test.step('Draft overview and assignments', async () => {
      expect(await bulkPage.expectStatusBadgeVisible()).toBe(T.STATUS_DRAFT);
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, payload.name);
      await bulkPage.openAppsTab();
      await expect(bulkPage.rowByText(bulkTestData.digitalSignageAppName)).toBeVisible();
      await bulkPage.openDevicesTab();
      await bulkPage.expectDeviceRowVisible(bulkTestData.onlineDeviceSearch);
    });
  });

  test('TC-BULK-CREATE-002: Description, Future schedule, toggles, two apps, two devices', async ({ page }) => {
    test.setTimeout(12 * 60 * 1000);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const name = `Bulk Full ${Date.now()}`;
    const desc = `Full create ${Date.now()}`;
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: {
        name,
        description: desc,
        rebootDevice: true,
        forceUpdate: true,
        ...future,
      },
      appNames: [bulkTestData.digitalSignageAppName, bulkTestData.counterNowAppName],
      deviceNames: [bulkTestData.onlineDeviceSearch, bulkTestData.offlineDeviceSearch],
    });

    await test.step('Overview: description, toggles, Start On populated', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, desc);
      await expect
        .poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE))
        .toMatch(/enable/i);
      await expect
        .poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE))
        .toMatch(/enable/i);
      const startOn = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
      expect(startOn.length).toBeGreaterThan(3);
    });

    await test.step('Apps and batches draft', async () => {
      await bulkPage.openAppsTab();
      await expect(bulkPage.rowByText(bulkTestData.digitalSignageAppName)).toBeVisible();
      await expect(bulkPage.rowByText(bulkTestData.counterNowAppName)).toBeVisible();
      await bulkPage.openBatchesTab();
      await bulkPage.expectBatchesEmptyState();
    });
  });

  test('TC-BULK-CREATE-004: Cannot save without Target OS', async ({ bd }) => {
    await bd.openAddDeploymentModal();
    await bd.fillInput(T.FORM.NAME_LABEL, `Bulk NoOS ${Date.now()}`);
    await bd.setBatchSize(100);
    await bd.selectDropdown(T.FORM.SCHEDULE_LABEL, T.FORM.NONE);
    await bd.saveAsDraftExpectBlocked();
  });

  test('TC-BULK-CREATE-005: Draft without apps — Publish still available (current product)', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk NoApps ${Date.now()}` });
    await bulkPage.openAppsTab();
    await bulkPage.expectAppsEmptyState();
    await expect(bulkPage.publishButton.first()).toBeVisible();
  });

  test('TC-BULK-CREATE-006: App assigned, no devices — Publish still available (current product)', async ({
    page,
  }) => {
    test.setTimeout(6 * 60 * 1000);
    const { bulkPage } = await createDraftWithAssignments(page, {
      payloadOverrides: { name: `Bulk AppNoDev ${Date.now()}` },
      appNames: [bulkTestData.counterNowAppName],
      deviceNames: [],
    });
    await bulkPage.openDevicesTab();
    await bulkPage.expectDevicesEmptyState();
    await expect(bulkPage.publishButton.first()).toBeVisible();
  });

  test('TC-BULK-CREATE-008: Empty description shows placeholder dash in overview', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk NoDesc ${Date.now()}`,
      description: '',
    });
    const descVal = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION);
    expect(['-', '—', ''].includes(descVal) || descVal.length === 0).toBeTruthy();
  });

  test('TC-BULK-CREATE-009: Two drafts may share the same display name', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const shared = `Bulk DupName ${Date.now()}`;
    await createDraftOpenDetail(page, { name: shared });
    await createDraftOpenDetail(page, { name: shared });
    const bd = createBulkPage(page);
    await bd.gotoList();
    await bd.waitForListReady();
    await bd.searchDeployment(shared);
    const rows = bd.getTableRowsByText(shared);
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  });

  test('TC-BULK-CREATE-010: Description max length counter (200)', async ({ bd }) => {
    await bd.openAddDeploymentModal();
    const longDesc = 'd'.repeat(bulkLimits.DESCRIPTION_MAX);
    await bd.fillTextarea(T.FORM.DESCRIPTION_LABEL, longDesc);
    await expect(bd.getCharCounterDescMax()).toBeVisible();
  });

  test('TC-BULK-CREATE-012: Batch Size required — Save disabled until batch chosen', async ({ bd }) => {
    await bd.openAddDeploymentModal();
    await bd.fillInput(T.FORM.NAME_LABEL, `Bulk NoBatch ${Date.now()}`);
    await bd.selectDropdown(T.FORM.TARGET_OS_LABEL, T.FORM.ANDROID);
    await bd.selectDropdown(T.FORM.SCHEDULE_LABEL, T.FORM.NONE);
    await bd.saveAsDraftExpectBlocked();
  });

  test('TC-BULK-CREATE-013: Schedule None — Start On / End On empty on overview', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk SchedNone ${Date.now()}` });
    const start = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
    const end = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_END_ON);
    expect(start === '-' || start === '—' || start === '' || /none/i.test(start)).toBeTruthy();
    expect(end === '-' || end === '—' || end === '' || /none/i.test(end)).toBeTruthy();
  });

  test('TC-BULK-CREATE-015: Reboot Device and Force Update saved as Enable', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk Behav ${Date.now()}`,
      rebootDevice: true,
      forceUpdate: true,
    });
    await expect.poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE)).toMatch(/enable/i);
    await expect.poll(async () => bulkPage.getOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE)).toMatch(/enable/i);
  });

  test('TC-BULK-CREATE-016: Deployment Name trimmed when saved', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const core = `BulkTrim-${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name: `  ${core}  ` });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, core);
  });

  test('TC-BULK-CREATE-017: Special characters in Deployment Name', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const raw = `Bulk_Auto-01.Test_${Date.now()}`;
    const { bulkPage } = await createDraftOpenDetail(page, { name: raw });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, raw);
  });

  test('TC-BULK-CREATE-018: Custom Version on create', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk Ver ${Date.now()}`,
      version: '2.0.5',
    });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '2.0.5');
  });

  test('TC-BULK-CREATE-019: Cleared Version falls back to default in overview', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const bd = createBulkPage(page);
    await bd.openAddDeploymentModal();
    await bd.fillDeploymentForm(
      buildDraftPayload({
        name: `Bulk VerEmpty ${Date.now()}`,
        version: '9.9.9',
      })
    );
    await bd.inputByLabel(T.FORM.VERSION_LABEL).click({ clickCount: 3 });
    await bd.inputByLabel(T.FORM.VERSION_LABEL).fill('');
    const id = await bd.saveAsDraftExpectDetail();
    expect(id).toBeTruthy();
    await bd.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '1.0.0');
  });

  test('TC-BULK-CREATE-020: Version trimmed when saved', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk VerTrim ${Date.now()}`,
      version: '  3.1.4  ',
    });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '3.1.4');
  });

  test('TC-BULK-CREATE-021: Version on list row matches detail', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const name = `Bulk ListVer ${Date.now()}`;
    const { bulkPage, payload } = await createDraftOpenDetail(page, {
      name,
      version: '4.0.1',
    });
    await bulkPage.gotoList();
    await bulkPage.waitForListReady();
    await bulkPage.searchDeployment(name);
    const cell = await bulkPage.getListCellText(name, 'version');
    expect(cell).toContain('4.0.1');
  });

  test('TC-BULK-CREATE-028: Future schedule persists Start On', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const future = buildFutureSchedulePayload(bulkTestData.futureScheduleDaysAhead);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk Future ${Date.now()}`,
      ...future,
    });
    const startOn = await bulkPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON);
    expect(startOn.length).toBeGreaterThan(4);
  });

  test('TC-BULK-CREATE-029: Custom batch size saved', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, {
      name: `Bulk Batch37 ${Date.now()}`,
      batchSize: 37,
    });
    await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_BATCH_SIZE, '37');
  });
});
