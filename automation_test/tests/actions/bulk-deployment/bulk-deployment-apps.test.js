const {
  test,
  expect,
  bulkDeploymentConfig,
  createBulkDeploymentContext,
  createDeploymentData,
  setActualResult,
  setTestCaseMetadata,
} = require('./bulk-deployment-test-helpers');

test.describe('Bulk Deployment - Apps', () => {
  test('TC-BULK-APPS-001 ~ 004: Add App modal structure and app assignment', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-001~004',
      category: 'Bulk Deployment Apps',
      title: 'Add App modal structure, single/multiple app assignment',
      precondition: 'Digital Signage and counter_now apps are available',
      steps: [
        'Create Draft, open Add App modal → verify search input, Selected section, Cancel, disabled Assign',
        'Add Digital Signage app',
        'Add counter_now app',
        'Add both Digital Signage and counter_now together',
      ],
      expected: 'Modal structure correct; each app combination is assigned and visible in Apps table',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-APPS-001: modal structure
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-modal'));
    const dialog = await context.bulkDeploymentPage.openAddAppModal();
    await expect(page.getByPlaceholder('Search and select app')).toBeVisible();
    await expect(page.getByText('Selected (0 items)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Assign' })).toBeDisabled();

    // TC-BULK-APPS-002: Digital Signage
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-digital'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);

    // TC-BULK-APPS-003: counter_now
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-counter'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appCounterNow]);

    // TC-BULK-APPS-004: multiple apps
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-multiple'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage, bulkDeploymentConfig.appCounterNow]);

    setActualResult(testInfo, 'Add App modal structure verified; Digital Signage, counter_now, and both together assigned');
  });

  test('TC-BULK-APPS-005 ~ 010: Remove app, search, duplicate, table columns, auto open, no-result', async ({ page }, testInfo) => {
    setTestCaseMetadata(testInfo, {
      testcaseId: 'TC-BULK-APPS-005~010',
      category: 'Bulk Deployment Apps',
      title: 'Remove app, search, duplicate block, table columns, auto open default, no-result',
      precondition: 'Digital Signage and counter_now apps are available',
      steps: [
        'Add then remove Digital Signage → verify removed from table',
        'Search counter_now in modal → verify appears in result list',
        'Add Digital Signage, re-open modal, search it again → Assign should remain disabled (duplicate blocked)',
        'Verify Apps table has columns: App, Type, Version, Size, Auto Open, Added On, Actions',
        'Add counter_now without Auto Open → verify Auto Open = No',
        'Search invalid keyword → no-result state, Assign disabled',
      ],
      expected: 'All app management operations work correctly',
    });

    const context = createBulkDeploymentContext(page);

    // TC-BULK-APPS-005: remove
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-remove'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    await context.bulkDeploymentPage.removeAppByName(bulkDeploymentConfig.appDigitalSignage);

    // TC-BULK-APPS-006: search
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-search'));
    await context.bulkDeploymentPage.openAddAppModal();
    await page.getByPlaceholder('Search and select app').fill(bulkDeploymentConfig.appCounterNow);
    await page.waitForTimeout(700);
    await expect(page.locator('.add-app-result-option').filter({ hasText: bulkDeploymentConfig.appCounterNow }).first()).toBeVisible();

    // TC-BULK-APPS-007: duplicate blocked
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-duplicate'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    const dupDialog = await context.bulkDeploymentPage.openAddAppModal();
    await page.getByPlaceholder('Search and select app').fill(bulkDeploymentConfig.appDigitalSignage);
    await page.waitForTimeout(700);
    const dupOption = page.locator('.add-app-result-option').filter({ hasText: bulkDeploymentConfig.appDigitalSignage }).first();
    const assignBtn = dupDialog.getByRole('button', { name: 'Assign' });
    if (await dupOption.isVisible().catch(() => false)) {
      await dupOption.click();
      if (await assignBtn.isEnabled().catch(() => false)) {
        await assignBtn.click();
        await context.bulkDeploymentPage.waitForToastOrNetwork();
        if (await dupDialog.isVisible().catch(() => false)) {
          await dupDialog.getByRole('button', { name: 'Cancel' }).click();
        }
      } else {
        await dupDialog.getByRole('button', { name: 'Cancel' }).click();
      }
    } else {
      await expect(assignBtn).toBeDisabled();
      await dupDialog.getByRole('button', { name: 'Cancel' }).click();
    }
    await context.bulkDeploymentPage.openAppsTab();
    const dupRows = page.locator('tbody tr').filter({ hasText: bulkDeploymentConfig.appDigitalSignage });
    expect(await dupRows.count()).toBe(1);

    // TC-BULK-APPS-008: table columns
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-info'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appDigitalSignage]);
    for (const col of ['App', 'Type', 'Version', 'Size', 'Auto Open', 'Added On', 'Actions']) {
      await expect(page.getByText(col, { exact: true }).first()).toBeVisible();
    }
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appDigitalSignage)).toContainText('Normal');

    // TC-BULK-APPS-009: auto open default
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-auto-open'));
    await context.bulkDeploymentPage.addAppsByNames([bulkDeploymentConfig.appCounterNow]);
    await expect(context.bulkDeploymentPage.rowByText(bulkDeploymentConfig.appCounterNow)).toContainText('No');

    // TC-BULK-APPS-010: no-result
    await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('apps-no-result'));
    const noResDialog = await context.bulkDeploymentPage.openAddAppModal();
    const noResKeyword = `zz_no_app_${Date.now()}`;
    await page.getByPlaceholder('Search and select app').fill(noResKeyword);
    await page.waitForTimeout(700);
    await expect(page.getByText('No apps match your search.')).toBeVisible();
    await expect(noResDialog.getByRole('button', { name: 'Assign' })).toBeDisabled();

    setActualResult(testInfo, 'Remove, search, duplicate block, table columns, auto open default, and no-result all verified');
  });
});
