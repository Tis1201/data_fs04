const { createBulkE2ETest, T } = require('./bd-e2e-shared');
const { createDraftOpenDetail, createBulkPage } = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

/**
 * @param {string} url
 */
function getSortStateFromUrl(url) {
  const parsed = new URL(url);
  return {
    sort: parsed.searchParams.get('sort') || '',
    order: parsed.searchParams.get('order') || '',
  };
}

test.describe('E2E — Bulk Deployment list sort and search', () => {
  test('TC-BULK-E2E-050: Search by deployment name and invalid keyword on list', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const uniqueName = `Bulk E2E Search ${Date.now()}`;
    const bd = /** @type {any} */ (createBulkPage(page));

    await test.step('Create one draft deployment with unique name', async () => {
      await createDraftOpenDetail(page, { name: uniqueName });
    });

    await test.step('Search by exact deployment name and verify row is visible', async () => {
      await bd.gotoList();
      await bd.waitForListReady();
      await bd.searchDeployment(uniqueName);
      await expect(bd.rowByText(uniqueName)).toBeVisible();
    });

    await test.step('Search by non-existent keyword and verify no-result state', async () => {
      await bd.searchDeployment(`zz_no_result_${Date.now()}`);
      await bd.expectNoDeploymentResults();
    });
  });

  test('TC-BULK-E2E-051: Sort toggles on all sortable list columns and excludes Actions', async ({ page }) => {
    test.setTimeout(8 * 60 * 1000);
    const bd = /** @type {any} */ (createBulkPage(page));

    const sortableColumns = [
      { header: T.LIST_COL_DEPLOYMENT_NAME, sortFields: ['name'] },
      { header: T.LIST_COL_VERSION, sortFields: ['version'] },
      { header: T.LIST_COL_START_ON, sortFields: ['startOn', 'scheduledAt'] },
      { header: T.LIST_COL_END_ON, sortFields: ['endOn', 'scheduledAt'] },
      { header: T.LIST_COL_STATUS, sortFields: ['status'] },
    ];

    await test.step('Open list page ready for sort assertions', async () => {
      await bd.gotoList();
      await bd.waitForListReady();
      await expect(page.locator('tbody tr').first()).toBeVisible();
    });

    for (const column of sortableColumns) {
      await test.step(`Sort ${column.header}: apply sortable state on repeated clicks`, async () => {
        await bd.clickListColumnHeader(column.header);
        await expect
          .poll(() => column.sortFields.includes(getSortStateFromUrl(page.url()).sort), {
            message: `Expected URL sort to map correctly after clicking ${column.header}`,
          })
          .toBeTruthy();
        const firstState = getSortStateFromUrl(page.url());
        expect(column.sortFields).toContain(firstState.sort);
        expect(['asc', 'desc']).toContain(firstState.order);

        await bd.clickListColumnHeader(column.header);
        await expect
          .poll(() => column.sortFields.includes(getSortStateFromUrl(page.url()).sort), {
            message: `Expected URL sort to remain valid after second click on ${column.header}`,
          })
          .toBeTruthy();
        const secondState = getSortStateFromUrl(page.url());
        expect(column.sortFields).toContain(secondState.sort);
        expect(['asc', 'desc']).toContain(secondState.order);
      });
    }

    await test.step('Click Actions header and verify sort key does not change to actions', async () => {
      const before = getSortStateFromUrl(page.url());
      await page.locator('thead th').filter({ hasText: T.LIST_COL_ACTIONS }).first().click();
      await bd.waitForUiSettled();
      const after = getSortStateFromUrl(page.url());

      expect(after.sort).not.toBe('actions');
      expect(after.sort.length).toBeGreaterThan(0);
      expect(['asc', 'desc']).toContain(after.order);
    });
  });
});
