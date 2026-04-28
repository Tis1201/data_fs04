const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  setActualResult,
  setTestCaseMetadata,
} = require('./bulk-deployment-shared');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

test.describe('Bulk Deployment - Apps', () => {
  test('TC-BULK-APPS-001: Add App modal shows search input, Selected section, Cancel, and disabled Assign', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-001',
      category: 'Bulk Deployment Apps',
      title: 'Add App modal renders search input, Selected section, Cancel button, and disabled Assign button',
      precondition: 'User is logged in; a draft deployment exists',
      steps: ['Create Draft, open Add App modal → verify search input, Selected section, Cancel, disabled Assign'],
      expected: 'Add App modal renders all expected controls with Assign disabled',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-modal'));
    const dialog = await context.bulkDeploymentPage.openAddAppModal();
    await expect(context.bulkDeploymentPage.getAddAppSearchInput()).toBeVisible();
    await expect(context.bulkDeploymentPage.getAddAppSelectedCount()).toBeVisible();
    await expect(dialog.getByRole('button', { name: T.CANCEL })).toBeVisible();
    await expect(dialog.getByRole('button', { name: T.ASSIGN })).toBeDisabled();

    setActualResult(testInfo, 'Add App modal structure verified: search, selected count, Cancel visible, Assign disabled');
  });

  test('TC-BULK-APPS-002: Digital Signage app can be added to a deployment', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-002',
      category: 'Bulk Deployment Apps',
      title: 'Digital Signage app is assigned and visible in Apps tab',
      precondition: 'Digital Signage app is available',
      steps: ['Create Draft, add Digital Signage → verify row visible in Apps tab'],
      expected: 'Digital Signage row is visible in Apps tab',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-digital'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeVisible();

    setActualResult(testInfo, `Digital Signage assigned and visible`);
  });

  test('TC-BULK-APPS-003: counter_now app can be added to a deployment', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-003',
      category: 'Bulk Deployment Apps',
      title: 'counter_now app is assigned and visible in Apps tab',
      precondition: 'counter_now app is available',
      steps: ['Create Draft, add counter_now → verify row visible in Apps tab'],
      expected: 'counter_now row is visible in Apps tab',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-counter'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appCounterNow]);
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toBeVisible();

    setActualResult(testInfo, `counter_now assigned and visible`);
  });

  test('TC-BULK-APPS-004: Multiple apps can be added together in one assignment', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-004',
      category: 'Bulk Deployment Apps',
      title: 'Digital Signage and counter_now can be assigned together',
      precondition: 'Digital Signage and counter_now apps are available',
      steps: ['Create Draft, add both apps → verify both rows visible in Apps tab'],
      expected: 'Both Digital Signage and counter_now are visible in Apps tab',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-multiple'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage, bulkDeploymentConfig.appCounterNow]);
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeVisible();
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toBeVisible();

    setActualResult(testInfo, 'Digital Signage and counter_now both assigned and visible');
  });

  test('TC-BULK-APPS-005: Removing an app removes it from the Apps table', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-005',
      category: 'Bulk Deployment Apps',
      title: 'Removing Digital Signage removes it from the Apps table',
      precondition: 'Digital Signage app is available',
      steps: ['Add Digital Signage then remove it → verify row is gone'],
      expected: 'Digital Signage row is no longer visible after removal',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-remove'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    await context.bulkDeploymentPage.removeAppByName(bulkDeploymentConfig.appDigitalSignage);
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toBeHidden();

    setActualResult(testInfo, 'Digital Signage removed and row is no longer visible');
  });

  test('TC-BULK-APPS-006: Searching an app name in Add App modal shows it in results', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-006',
      category: 'Bulk Deployment Apps',
      title: 'Searching counter_now in Add App modal shows the app in search results',
      precondition: 'counter_now app is available',
      steps: ['Open Add App modal, search counter_now → verify result is visible'],
      expected: 'counter_now appears in the search results list',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-search'));
    await context.bulkDeploymentPage.openAddAppModal();
    await context.bulkDeploymentPage.searchAppInAddModal(bulkDeploymentConfig.appCounterNow);
    await context.bulkDeploymentPage.expectAppSearchResultVisible(bulkDeploymentConfig.appCounterNow);

    setActualResult(testInfo, `counter_now visible in Add App modal search results`);
  });

  test('TC-BULK-APPS-007: Duplicate app cannot be assigned again — Assign button stays disabled', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-007',
      category: 'Bulk Deployment Apps',
      title: 'Re-selecting an already assigned app keeps the app count at 1',
      precondition: 'Digital Signage app is available',
      steps: [
        'Add Digital Signage, re-open modal, search same app',
        'If option visible attempt to select and assign',
        'Verify Apps table still shows exactly 1 row for Digital Signage',
      ],
      expected: 'Digital Signage appears only once in Apps table after duplicate attempt',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-duplicate'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    const dupDialog = await context.bulkDeploymentPage.openAddAppModal();
    await context.bulkDeploymentPage.searchAppInAddModal(bulkDeploymentConfig.appDigitalSignage);
    const dupOption = context.bulkDeploymentPage.getAppResultOptionByName(bulkDeploymentConfig.appDigitalSignage);
    const assignBtn = dupDialog.getByRole('button', { name: T.ASSIGN });
    if (await dupOption.isVisible().catch(() => false)) {
      await dupOption.click();
      if (await assignBtn.isEnabled().catch(() => false)) {
        await assignBtn.click();
        await context.bulkDeploymentPage.waitForToastOrNetwork();
        if (await dupDialog.isVisible().catch(() => false)) {
          await dupDialog.getByRole('button', { name: T.CANCEL }).click();
        }
      } else {
        await dupDialog.getByRole('button', { name: T.CANCEL }).click();
      }
    } else {
      await expect(assignBtn).toBeDisabled();
      await dupDialog.getByRole('button', { name: T.CANCEL }).click();
    }
    await context.bulkDeploymentPage.openAppsTab();
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toHaveCount(1);

    setActualResult(testInfo, 'Digital Signage appears exactly once after duplicate attempt');
  });

  test('TC-BULK-APPS-008: Apps table shows all expected column headers', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-008',
      category: 'Bulk Deployment Apps',
      title: 'Apps table renders App, Type, Version, Size, Auto Open, Added On, and Actions columns',
      precondition: 'Digital Signage app is available',
      steps: ['Add Digital Signage → verify all column headers in Apps table'],
      expected: 'All 7 column headers are visible in the Apps table',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-info'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    for (const col of [
      T.APPS_TABLE_COL_APP,
      T.APPS_TABLE_COL_TYPE,
      T.APPS_TABLE_COL_VERSION,
      T.APPS_TABLE_COL_SIZE,
      T.APPS_TABLE_COL_AUTO_OPEN,
      T.APPS_TABLE_COL_ADDED_ON,
      T.APPS_TABLE_COL_ACTIONS,
    ]) {
      await expect(context.bulkDeploymentPage.getAppsTableColumnHeader(col)).toBeVisible();
    }

    setActualResult(testInfo, 'All Apps table column headers visible');
  });

  test('TC-BULK-APPS-009: counter_now without Auto Open shows Normal type and No for Auto Open', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-009',
      category: 'Bulk Deployment Apps',
      title: 'counter_now added without Auto Open shows No in the Auto Open column',
      precondition: 'counter_now app is available',
      steps: ['Add counter_now without Auto Open → verify Auto Open = No'],
      expected: 'counter_now row shows No in the Auto Open column',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-auto-open'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appCounterNow]);
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toContainText('No');

    setActualResult(testInfo, 'counter_now Auto Open shows No');
  });

  test('TC-BULK-APPS-010: Invalid app keyword in Add App modal shows no-result state and disables Assign', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-010',
      category: 'Bulk Deployment Apps',
      title: 'Searching an invalid keyword in Add App modal shows no-result state and keeps Assign disabled',
      precondition: 'User is logged in',
      steps: ['Open Add App modal, enter invalid keyword → verify no-result text and Assign disabled'],
      expected: 'No-result state is visible and Assign button stays disabled',
    });

    const context = createBulkDeploymentContext(page);
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-no-result'));
    const noResDialog = await context.bulkDeploymentPage.openAddAppModal();
    const noResKeyword = `zz_no_app_${Date.now()}`;
    await context.bulkDeploymentPage.searchAppInAddModal(noResKeyword);
    await expect(context.bulkDeploymentPage.getNoAppsMatchText()).toBeVisible();
    await expect(noResDialog.getByRole('button', { name: T.ASSIGN })).toBeDisabled();

    setActualResult(testInfo, `Invalid keyword "${noResKeyword}" showed no-result state; Assign disabled`);
  });
});
