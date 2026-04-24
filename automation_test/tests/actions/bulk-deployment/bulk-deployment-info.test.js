const {
  test,
  expect,
  config,
  createBulkDeploymentContext,
  createDeploymentData,
  openBulkDeploymentDetail,
  setActualResult,
  setTestCaseMetadata,
} = require('./bulk-deployment-test-helpers');

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-INFO-001..004 : Detail page structure / overview / status / audit
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Info - Detail Page', () => {
  test('TC-BULK-INFO-001 ~ 004: Detail page structure, overview fields, status badge, audit info', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-001~004',
      category: 'Bulk Deployment Info',
      title: 'Detail page structure, overview fields, status badge, and audit info',
      precondition: 'User is logged in; deployment exists',
      steps: [
        'Navigate to Deployment Detail page',
        'Verify page title, overview section, and tabs',
        'Verify all overview fields are visible',
        'Verify status badge is visible and non-empty',
        'Verify audit information (Created by / Last updated by)',
      ],
      expected: 'Page structure, overview fields, status badge, and audit section all render correctly',
    });

    const context = createBulkDeploymentContext(page);
    await openBulkDeploymentDetail(context);

    // TC-BULK-INFO-001: page structure
    await expect(context.bulkDeploymentPage.pageTitle).toBeVisible();
    await expect(context.bulkDeploymentPage.overviewTitle).toBeVisible();
    await expect(context.bulkDeploymentPage.devicesTab).toBeVisible();
    await expect(context.bulkDeploymentPage.appsTab).toBeVisible();
    await expect(context.bulkDeploymentPage.batchesTab).toBeVisible();

    // TC-BULK-INFO-002: overview fields
    for (const field of ['Deployment Name', 'Status', 'Target OS', 'Version', 'Batch Size', 'Start On', 'End On', 'Description', 'Reboot Device', 'Force Update']) {
      await context.bulkDeploymentPage.expectOverviewFieldVisible(field);
    }

    // TC-BULK-INFO-003: status badge
    const detectedStatus = await context.bulkDeploymentPage.expectStatusBadgeVisible();
    expect(detectedStatus).toBeTruthy();

    // TC-BULK-INFO-004: audit info
    await context.bulkDeploymentPage.expectAuditInfoVisible();

    setActualResult(testInfo, `Page structure, overview, status badge ("${detectedStatus}"), and audit info all rendered correctly`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-INFO-005..007 : Detail tabs — Devices / Apps / Batches empty states
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Info - Detail Tabs', () => {
  test('TC-BULK-INFO-005 ~ 007: Devices / Apps / Batches tabs structure and empty state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-005~007',
      category: 'Bulk Deployment Info',
      title: 'Devices, Apps, and Batches tabs structure and empty states',
      precondition: 'User is logged in; draft deployment without assigned devices or apps',
      steps: [
        'Create a draft deployment',
        'Verify Devices tab: Import CSV / Assign by tag / Add Device buttons, search input, empty state',
        'Verify Apps tab: Add App button, empty state',
        'Verify Batches tab: all metric labels visible, empty state',
      ],
      expected: 'Each tab renders with the expected actions/metrics and empty state when no data exists',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-tabs-empty'));

    // Devices tab (TC-BULK-INFO-005)
    await context.bulkDeploymentPage.openDevicesTab();
    await expect(context.bulkDeploymentPage.importCsvButton).toBeVisible();
    await expect(context.bulkDeploymentPage.assignByTagButton).toBeVisible();
    await expect(context.bulkDeploymentPage.addDeviceButton).toBeVisible();
    await expect(page.getByPlaceholder('Search by device name or ID...')).toBeVisible();
    await context.bulkDeploymentPage.expectDevicesEmptyState();

    // Apps tab (TC-BULK-INFO-006)
    await context.bulkDeploymentPage.openAppsTab();
    await expect(context.bulkDeploymentPage.addAppButton).toBeVisible();
    await context.bulkDeploymentPage.expectAppsEmptyState();

    // Batches tab (TC-BULK-INFO-007)
    await context.bulkDeploymentPage.openBatchesTab();
    for (const metric of ['Total Batches', 'Batches Completed', 'Batches In-Progress', 'Batches Failed', 'Batches Canceled']) {
      await expect(page.getByText(metric, { exact: true })).toBeVisible();
    }
    await context.bulkDeploymentPage.expectBatchesEmptyState();

    setActualResult(testInfo, 'Devices, Apps, and Batches tabs all rendered with expected structure and empty states');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-INFO-008..010 : List page structure, search, no-result
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Info - List Page', () => {
  test('TC-BULK-INFO-008 ~ 010: List page structure, search by name, and no-result state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-008~010',
      category: 'Bulk Deployment Info',
      title: 'List page structure, search by name, and no-result state',
      precondition: 'User is logged in',
      steps: [
        'Navigate to Bulk Deployments list page',
        'Verify list page structure',
        'Create a deployment and search by its name',
        'Verify match appears in results',
        'Search by invalid keyword and verify no-result state',
      ],
      expected: 'List page renders correctly, name search returns matching rows, invalid keyword shows no-result state',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-INFO-008: list page structure
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();

    // TC-BULK-INFO-009: search by name
    const data = createDeploymentData('info-list-search');
    await context.bulkDeploymentPage.createDraftDeployment(data);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    await expect(page.getByText(data.name, { exact: true }).first()).toBeVisible();

    // TC-BULK-INFO-010: no-result
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    const noResultKeyword = `zz_none_${Date.now()}`;
    await context.bulkDeploymentPage.searchDeployment(noResultKeyword);
    await context.bulkDeploymentPage.expectNoDeploymentResults();

    setActualResult(testInfo, `List page structure verified; search found "${data.name}"; invalid keyword showed no-result state`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BULK-INFO-011..018 : Extended info — sort, row actions, consistency, refresh, invalid ID
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Bulk Deployment - Info - Extended', () => {
  test('TC-BULK-INFO-011 ~ 013: Sort list, row action menu, status consistency', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-011~013',
      category: 'Bulk Deployment Info',
      title: 'List sort, row action menu, and status/version consistency',
      precondition: 'User is logged in; at least one deployment exists',
      steps: [
        'Navigate to list page and sort by Deployment Name twice',
        'Create deployment and verify Draft row action menu contains Publish/View/Edit/Duplicate/Delete',
        'Verify Draft status badge is consistent between detail and list row',
      ],
      expected: 'Sorting keeps list stable, row actions are correct for Draft, status/version are consistent',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-INFO-011: sort
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.clickListColumnHeader('Deployment Name');
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.clickListColumnHeader('Deployment Name');
    await context.bulkDeploymentPage.waitForListReady();

    // TC-BULK-INFO-012: row actions
    const data = createDeploymentData('info-row-actions');
    await context.bulkDeploymentPage.createDraftDeployment(data);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    const labels = await context.bulkDeploymentPage.getRowActionLabels(data.name);
    expect(labels).toEqual(expect.arrayContaining(['Publish', 'View', 'Edit', 'Duplicate', 'Delete']));

    // TC-BULK-INFO-013: status consistent between detail and list
    await context.bulkDeploymentPage.expectOverviewValue('Status', 'Draft');
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    const listStatus = await context.bulkDeploymentPage.getListCellText(data.name, 'status');
    expect(listStatus).toContain('Draft');

    setActualResult(testInfo, `Sort completed; Draft row actions were correct; Draft status was consistent`);
  });

  test('TC-BULK-INFO-014 ~ 016: Version consistency, tab switching keeps version, detail action buttons', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-014~016',
      category: 'Bulk Deployment Info',
      title: 'Version consistency, tab switching, and Draft detail action buttons',
      precondition: 'User is logged in',
      steps: [
        'Create deployment with custom version and verify consistency between detail and list',
        'Verify Version stays same when switching between Devices/Apps/Batches tabs',
        'Verify Edit/Publish/Duplicate/Delete buttons are all visible on Draft detail page',
      ],
      expected: 'Version is consistent across detail/list/tabs; Draft has all 4 action buttons',
    });

    const context = createBulkDeploymentContext(page);
    const data = createDeploymentData('info-version-actions', { version: '2.4.1' });
    await context.bulkDeploymentPage.createDraftDeployment(data);

    // TC-BULK-INFO-014: version consistency detail vs list
    await context.bulkDeploymentPage.expectOverviewValue('Version', data.version);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    const listVersion = await context.bulkDeploymentPage.getListCellText(data.name, 'version');
    expect(listVersion).toContain(data.version);

    // TC-BULK-INFO-015: tab switching
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-tab-version', { version: '12.3.4' }));
    for (const openTab of [
      () => context.bulkDeploymentPage.openAppsTab(),
      () => context.bulkDeploymentPage.openBatchesTab(),
      () => context.bulkDeploymentPage.openDevicesTab(),
    ]) {
      await openTab();
      await context.bulkDeploymentPage.expectOverviewValue('Version', '12.3.4');
    }

    // TC-BULK-INFO-016: detail action buttons for Draft
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-detail-actions'));
    for (const action of ['Edit', 'Publish', 'Duplicate', 'Delete']) {
      expect(await context.bulkDeploymentPage.isDetailActionVisible(action), `${action} should be visible`).toBe(true);
    }

    setActualResult(testInfo, 'Version consistent; tab switching stable; Draft detail actions visible');
  });

  test('TC-BULK-INFO-017 ~ 018: Refresh keeps page structure; invalid ID shows error state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-017~018',
      category: 'Bulk Deployment Info',
      title: 'Refresh keeps page structure; invalid ID returns error/not-found state',
      precondition: 'User is logged in',
      steps: [
        'Create a deployment, refresh detail page, verify structure remains',
        'Navigate to an invalid deployment ID URL, verify error/not-found state',
      ],
      expected: 'Refresh keeps overview and tabs visible; invalid ID returns 404 or error page state',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-INFO-017: refresh keeps structure
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-refresh'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await context.bulkDeploymentPage.waitForPageReady();

    // TC-BULK-INFO-018: invalid ID
    const invalidId = `invalid-bulk-${Date.now()}`;
    const response = await page.goto(`${config.appURL}/user/iot/bundles/${invalidId}`, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeouts?.pageLoadMs || 30000,
    });
    await page.waitForLoadState('networkidle').catch(() => {});
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasErrorState = /not found|404|unable|error|does not exist/i.test(bodyText);
    const hasHttpError = response ? response.status() >= 400 : false;
    expect(hasErrorState || hasHttpError).toBe(true);

    setActualResult(testInfo, `Refresh kept structure; invalid ID returned HTTP ${response?.status() || 'unknown'} errorState=${hasErrorState}`);
  });
});
