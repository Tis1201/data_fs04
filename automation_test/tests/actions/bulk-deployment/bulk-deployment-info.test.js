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
const { BULK_DEPLOYMENT } = require('../../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

test.describe('Bulk Deployment - Info - Detail Page', () => {
  test('TC-BULK-INFO-001: Detail page renders title, overview section, and tabs', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-001',
      category: 'Bulk Deployment Info',
      title: 'Detail page renders title, overview section, and tab buttons',
      precondition: 'User is logged in; deployment exists',
      steps: ['Navigate to Deployment Detail page', 'Verify page title, overview section, and tabs'],
      expected: 'Page title, overview title, Devices, Apps, and Batches tabs are visible',
    });

    const context = createBulkDeploymentContext(page);
    await openBulkDeploymentDetail(context);
    await expect(context.bulkDeploymentPage.pageTitle).toBeVisible();
    await expect(context.bulkDeploymentPage.overviewTitle).toBeVisible();
    await expect(context.bulkDeploymentPage.devicesTab).toBeVisible();
    await expect(context.bulkDeploymentPage.appsTab).toBeVisible();
    await expect(context.bulkDeploymentPage.batchesTab).toBeVisible();

    setActualResult(testInfo, 'Page title, overview, and all tabs visible');
  });

  test('TC-BULK-INFO-002: All overview fields are visible on detail page', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-002',
      category: 'Bulk Deployment Info',
      title: 'All overview fields are visible on detail page',
      precondition: 'User is logged in; deployment exists',
      steps: ['Verify all overview fields are visible'],
      expected: 'All 10 overview fields are rendered',
    });

    const context = createBulkDeploymentContext(page);
    await openBulkDeploymentDetail(context);
    for (const field of [
      T.OVERVIEW_FIELD_DEPLOYMENT_NAME,
      T.OVERVIEW_FIELD_STATUS,
      T.OVERVIEW_FIELD_TARGET_OS,
      T.OVERVIEW_FIELD_VERSION,
      T.OVERVIEW_FIELD_BATCH_SIZE,
      T.OVERVIEW_FIELD_START_ON,
      T.OVERVIEW_FIELD_END_ON,
      T.OVERVIEW_FIELD_DESCRIPTION,
      T.OVERVIEW_FIELD_REBOOT_DEVICE,
      T.OVERVIEW_FIELD_FORCE_UPDATE,
    ]) {
      await context.bulkDeploymentPage.expectOverviewFieldVisible(field);
    }

    setActualResult(testInfo, 'All overview fields visible');
  });

  test('TC-BULK-INFO-003: Status badge is visible and non-empty', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-003',
      category: 'Bulk Deployment Info',
      title: 'Status badge is visible and non-empty on detail page',
      precondition: 'User is logged in; deployment exists',
      steps: ['Verify status badge is visible and non-empty'],
      expected: 'A known status badge is visible',
    });

    const context = createBulkDeploymentContext(page);
    await openBulkDeploymentDetail(context);
    const detectedStatus = await context.bulkDeploymentPage.expectStatusBadgeVisible();
    expect(detectedStatus).toBeTruthy();

    setActualResult(testInfo, `Status badge "${detectedStatus}" visible`);
  });

  test('TC-BULK-INFO-004: Audit info is visible on detail page', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-004',
      category: 'Bulk Deployment Info',
      title: 'Audit information is visible on detail page',
      precondition: 'User is logged in; deployment exists',
      steps: ['Verify audit information (Created by / Last updated by)'],
      expected: 'Created by and Last updated by are visible',
    });

    const context = createBulkDeploymentContext(page);
    await openBulkDeploymentDetail(context);
    await context.bulkDeploymentPage.expectAuditInfoVisible();

    setActualResult(testInfo, 'Audit info visible');
  });
});

test.describe('Bulk Deployment - Info - Detail Tabs', () => {
  test('TC-BULK-INFO-005: Devices tab renders action buttons, search, and empty state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-005',
      category: 'Bulk Deployment Info',
      title: 'Devices tab shows Import CSV, Assign by tag, Add Device, search input, and empty state',
      precondition: 'User is logged in; draft deployment without assigned devices',
      steps: ['Create draft → Devices tab: verify action buttons, search input, empty state'],
      expected: 'Devices tab renders with all expected controls and empty state',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-tabs-devices'));
    await context.bulkDeploymentPage.openDevicesTab();
    await expect(context.bulkDeploymentPage.importCsvButton).toBeVisible();
    await expect(context.bulkDeploymentPage.assignByTagButton).toBeVisible();
    await expect(context.bulkDeploymentPage.addDeviceButton).toBeVisible();
    await expect(context.bulkDeploymentPage.getDeviceTableSearchInput()).toBeVisible();
    await context.bulkDeploymentPage.expectDevicesEmptyState();

    setActualResult(testInfo, 'Devices tab structure and empty state verified');
  });

  test('TC-BULK-INFO-006: Apps tab renders Add App button and empty state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-006',
      category: 'Bulk Deployment Info',
      title: 'Apps tab shows Add App button and empty state for draft with no apps',
      precondition: 'User is logged in; draft deployment without assigned apps',
      steps: ['Create draft → Apps tab: verify Add App button and empty state'],
      expected: 'Apps tab renders Add App button and empty state',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-tabs-apps'));
    await context.bulkDeploymentPage.openAppsTab();
    await expect(context.bulkDeploymentPage.addAppButton).toBeVisible();
    await context.bulkDeploymentPage.expectAppsEmptyState();

    setActualResult(testInfo, 'Apps tab Add App button and empty state verified');
  });

  test('TC-BULK-INFO-007: Batches tab renders all metric labels and empty state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-007',
      category: 'Bulk Deployment Info',
      title: 'Batches tab shows all metric labels and empty state for draft',
      precondition: 'User is logged in; draft deployment',
      steps: ['Create draft → Batches tab: verify metric labels and empty state'],
      expected: 'All metric labels are visible and empty state is shown',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-tabs-batches'));
    await context.bulkDeploymentPage.openBatchesTab();
    for (const metric of [
      T.BATCH_METRIC_TOTAL,
      T.BATCH_METRIC_COMPLETED,
      T.BATCH_METRIC_IN_PROGRESS,
      T.BATCH_METRIC_FAILED,
      T.BATCH_METRIC_CANCELED,
    ]) {
      await expect(context.bulkDeploymentPage.getBatchMetricLabel(metric)).toBeVisible();
    }
    await context.bulkDeploymentPage.expectBatchesEmptyState();

    setActualResult(testInfo, 'Batches tab metric labels and empty state verified');
  });
});

test.describe('Bulk Deployment - Info - List Page', () => {
  test('TC-BULK-INFO-008: List page renders expected structure', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-008',
      category: 'Bulk Deployment Info',
      title: 'List page renders title, search, add button, and column headers',
      precondition: 'User is logged in',
      steps: ['Navigate to Bulk Deployments list page', 'Verify list page structure'],
      expected: 'List page structure is correct',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();

    setActualResult(testInfo, 'List page structure verified');
  });

  test('TC-BULK-INFO-009: Search by name returns matching deployment', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-009',
      category: 'Bulk Deployment Info',
      title: 'Search by deployment name returns matching row',
      precondition: 'User is logged in',
      steps: ['Create a deployment and search by its name', 'Verify match appears in results'],
      expected: 'Matching deployment name is visible in search results',
    });

    const context = createBulkDeploymentContext(page);
    const data = createDeploymentData('info-list-search');
    await context.bulkDeploymentPage.createDraftDeployment(data);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    await expect(context.bulkDeploymentPage.rowByText(data.name)).toBeVisible();

    setActualResult(testInfo, `Search found deployment "${data.name}"`);
  });

  test('TC-BULK-INFO-010: Search with invalid keyword shows no-result state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-010',
      category: 'Bulk Deployment Info',
      title: 'Search with invalid keyword shows no-result state',
      precondition: 'User is logged in',
      steps: ['Search by invalid keyword and verify no-result state'],
      expected: 'No deployments found message is visible',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    const noResultKeyword = `zz_none_${Date.now()}`;
    await context.bulkDeploymentPage.searchDeployment(noResultKeyword);
    await context.bulkDeploymentPage.expectNoDeploymentResults();

    setActualResult(testInfo, `Invalid keyword "${noResultKeyword}" showed no-result state`);
  });
});

test.describe('Bulk Deployment - Info - Extended', () => {
  test('TC-BULK-INFO-011: Sorting list by Deployment Name keeps list stable', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-011',
      category: 'Bulk Deployment Info',
      title: 'Sorting list by Deployment Name column is stable',
      precondition: 'User is logged in; at least one deployment exists',
      steps: ['Navigate to list page and sort by Deployment Name twice'],
      expected: 'List remains stable after two sort clicks',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.clickListColumnHeader(T.LIST_COL_DEPLOYMENT_NAME);
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.clickListColumnHeader(T.LIST_COL_DEPLOYMENT_NAME);
    await context.bulkDeploymentPage.waitForListReady();

    setActualResult(testInfo, 'List sort completed twice without errors');
  });

  test('TC-BULK-INFO-012: Draft row action menu contains expected actions', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-012',
      category: 'Bulk Deployment Info',
      title: 'Draft row action menu contains Publish, View, Edit, Duplicate, Delete',
      precondition: 'User is logged in; Draft deployment exists',
      steps: ['Create deployment and verify Draft row action menu contains Publish/View/Edit/Duplicate/Delete'],
      expected: 'All 5 expected actions are present in the row menu',
    });

    const context = createBulkDeploymentContext(page);
    const data = createDeploymentData('info-row-actions');
    await context.bulkDeploymentPage.createDraftDeployment(data);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    const labels = await context.bulkDeploymentPage.getRowActionLabels(data.name);
    expect(labels).toEqual(expect.arrayContaining([
      T.ROW_ACTION_PUBLISH,
      T.ROW_ACTION_VIEW,
      T.ROW_ACTION_EDIT,
      T.ROW_ACTION_DUPLICATE,
      T.ROW_ACTION_DELETE,
    ]));

    setActualResult(testInfo, `Row actions correct: ${labels.join(', ')}`);
  });

  test('TC-BULK-INFO-013: Draft status is consistent between detail and list', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-013',
      category: 'Bulk Deployment Info',
      title: 'Draft status badge is consistent between detail and list row',
      precondition: 'User is logged in; Draft deployment exists',
      steps: ['Verify Draft status badge is consistent between detail and list row'],
      expected: 'Status shows Draft in both detail overview and list row',
    });

    const context = createBulkDeploymentContext(page);
    const data = createDeploymentData('info-status-sync');
    await context.bulkDeploymentPage.createDraftDeployment(data);
    await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_STATUS, T.STATUS_DRAFT);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    const listStatus = await context.bulkDeploymentPage.getListCellText(data.name, 'status');
    expect(listStatus).toContain(T.STATUS_DRAFT);

    setActualResult(testInfo, 'Draft status consistent in detail and list');
  });

  test('TC-BULK-INFO-014: Version is consistent between detail and list', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-014',
      category: 'Bulk Deployment Info',
      title: 'Version is consistent between detail overview and list page',
      precondition: 'User is logged in',
      steps: ['Create deployment with custom version and verify consistency between detail and list'],
      expected: 'Version is identical in detail overview and list row',
    });

    const context = createBulkDeploymentContext(page);
    const data = createDeploymentData('info-version-actions', { version: '2.4.1' });
    await context.bulkDeploymentPage.createDraftDeployment(data);
    await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, data.version);
    await context.bulkDeploymentPage.gotoList();
    await context.bulkDeploymentPage.waitForListReady();
    await context.bulkDeploymentPage.searchDeployment(data.name);
    const listVersion = await context.bulkDeploymentPage.getListCellText(data.name, 'version');
    expect(listVersion).toContain(data.version);

    setActualResult(testInfo, `Version ${data.version} consistent in detail and list`);
  });

  test('TC-BULK-INFO-015: Version remains correct when switching between tabs', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-015',
      category: 'Bulk Deployment Info',
      title: 'Version in overview is stable when switching between Apps, Batches, and Devices tabs',
      precondition: 'User is logged in',
      steps: ['Verify Version stays same when switching between Devices/Apps/Batches tabs'],
      expected: 'Version is unchanged regardless of which tab is active',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-tab-version', { version: '12.3.4' }));
    for (const openTab of [
      () => context.bulkDeploymentPage.openAppsTab(),
      () => context.bulkDeploymentPage.openBatchesTab(),
      () => context.bulkDeploymentPage.openDevicesTab(),
    ]) {
      await openTab();
      await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, '12.3.4');
    }

    setActualResult(testInfo, 'Version 12.3.4 stable across tab switches');
  });

  test('TC-BULK-INFO-016: Draft detail page shows all four action buttons', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-016',
      category: 'Bulk Deployment Info',
      title: 'Draft detail page shows Edit, Publish, Duplicate, and Delete buttons',
      precondition: 'User is logged in',
      steps: ['Verify Edit/Publish/Duplicate/Delete buttons are all visible on Draft detail page'],
      expected: 'All 4 action buttons are visible for a Draft deployment',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-detail-actions'));
    for (const action of [T.EDIT, T.PUBLISH, T.DUPLICATE, T.DELETE]) {
      expect(
        await context.bulkDeploymentPage.isDetailActionVisible(action),
        `${action} should be visible`
      ).toBe(true);
    }

    setActualResult(testInfo, 'All Draft detail action buttons visible');
  });

  test('TC-BULK-INFO-017: Refresh keeps detail page structure intact', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-017',
      category: 'Bulk Deployment Info',
      title: 'Refreshing detail page keeps overview and tabs visible',
      precondition: 'User is logged in',
      steps: ['Create a deployment, refresh detail page, verify structure remains'],
      expected: 'Overview and tabs are still visible after page refresh',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('info-refresh'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await context.bulkDeploymentPage.waitForPageReady();

    setActualResult(testInfo, 'Page structure intact after refresh');
  });

  test('TC-BULK-INFO-018: Invalid deployment ID URL returns error or not-found state', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-INFO-018',
      category: 'Bulk Deployment Info',
      title: 'Navigating to invalid deployment ID returns error or not-found state',
      precondition: 'User is logged in',
      steps: ['Navigate to an invalid deployment ID URL, verify error/not-found state'],
      expected: 'Error or not-found state is displayed for invalid ID',
    });

    const context = createBulkDeploymentContext(page);
    const invalidId = `invalid-bulk-${Date.now()}`;
    await page.goto(`${config.appURL}/user/iot/bundles/${invalidId}`, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeouts?.pageLoadMs || 30000,
    });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await expect(
      page.getByText(/not found|unable|does not exist/i).or(page.locator('[data-testid="not-found"]'))
    ).toBeVisible({ timeout: config.timeouts?.pageLoadMs || 30000 });

    setActualResult(testInfo, `Invalid ID "${invalidId}" showed not-found state`);
  });
});
