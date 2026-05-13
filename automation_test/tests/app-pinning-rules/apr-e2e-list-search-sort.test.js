const { createAppPinningRulesE2ETest } = require('./apr-e2e-shared');
const {
  createPinRulesPage,
  createPinRuleViaApi,
} = require('../../pages/app-pinning-rules/flows');

const test = createAppPinningRulesE2ETest();
const expect = test.expect;

function getSortState(url) {
  const parsed = new URL(url);
  return {
    sort: parsed.searchParams.get('sort') || '',
    order: parsed.searchParams.get('order') || '',
  };
}

test.describe('E2E — App Pinning Rules list, search, and sort', () => {
  test('TC-PIN-E2E-001: List page renders core App Pinning Rules UI', async ({ page }) => {
    const pinRules = createPinRulesPage(page);

    await test.step('Open App Pinning Rules list page', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
    });

    await test.step('Verify list controls and table headers are visible', async () => {
      await expect(pinRules.pageTitle).toBeVisible();
      await expect(pinRules.searchInput).toBeVisible();
      await expect(pinRules.addRuleButton).toBeVisible();
      await expect(page.locator('thead th').filter({ hasText: 'Actions' })).toBeVisible();
    });
  });

  test('TC-PIN-E2E-006/007: Search finds exact rule and shows no-result for unknown keyword', async ({
    page,
  }) => {
    test.setTimeout(4 * 60 * 1000);
    const pinRules = createPinRulesPage(page);
    const name = `PIN E2E Search ${Date.now()}`;

    await test.step('Create a searchable custom pin rule through API setup', async () => {
      await createPinRuleViaApi(page, { name, isActive: true });
    });

    await test.step('Search by exact rule name and verify matching row', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      await pinRules.searchRule(name);
      await expect(pinRules.rowByText(name)).toBeVisible();
    });

    await test.step('Search by unknown keyword and verify empty state', async () => {
      await pinRules.searchRule(`zz_no_pin_rule_${Date.now()}`);
      await pinRules.expectNoRulesFound();
    });
  });

  test('TC-PIN-E2E-008/009/010: Sort supported columns and keep Actions non-sortable', async ({
    page,
  }) => {
    test.setTimeout(4 * 60 * 1000);
    const pinRules = createPinRulesPage(page);
    const sortableColumns = [
      { header: 'Name', sortFields: ['name'] },
      { header: 'Pinned Apps', sortFields: ['pinnedApps'] },
      { header: 'Last Updated On', sortFields: ['updatedAt'] },
      { header: 'Status', sortFields: ['status', 'isActive'] },
    ];

    await test.step('Create at least two rules to make sorting meaningful', async () => {
      await createPinRuleViaApi(page, { name: `PIN E2E Sort B ${Date.now()}`, isActive: false });
      await createPinRuleViaApi(page, { name: `PIN E2E Sort A ${Date.now()}`, isActive: true });
      await pinRules.gotoList();
      await pinRules.waitForListReady();
    });

    for (const column of sortableColumns) {
      await test.step(`Click sortable column: ${column.header}`, async () => {
        await pinRules.clickColumnHeader(column.header);
        await expect
          .poll(() => column.sortFields.includes(getSortState(page.url()).sort), {
            message: `Expected sort query to map to ${column.header}`,
          })
          .toBeTruthy();
        expect(['asc', 'desc']).toContain(getSortState(page.url()).order);
      });
    }

    await test.step('Click Actions header and verify it never becomes the sort key', async () => {
      await page.locator('thead th').filter({ hasText: 'Actions' }).first().click();
      await pinRules.waitForUiSettled();
      expect(getSortState(page.url()).sort).not.toBe('actions');
    });
  });
});
