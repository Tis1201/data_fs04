const { createBulkTest } = require('./bd-shared');
const { createDraftOpenDetail, assertListPageStructure } = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 1 — Bulk Deployments list (TC-BULK-INFO-008~010)', () => {
  test('TC-BULK-INFO-008: List page structure (title, search, Add Deployment, table headers)', async ({ bd }) => {
    await test.step('Verify list page chrome and table headers', async () => {
      await assertListPageStructure(bd);
    });
  });

  test('TC-BULK-INFO-009: Search deployment by name', async ({ page, bd }) => {
    test.setTimeout(3 * 60 * 1000);

    const registry = {};
    const { payload } = await createDraftOpenDetail(
      page,
      { name: `Bulk ListSearch ${Date.now()}` },
      registry
    );

    await bd.gotoList();
    await bd.waitForListReady();

    await test.step('Search by deployment name returns a row', async () => {
      await bd.searchDeployment(payload.name);
      await expect(bd.rowByText(payload.name)).toBeVisible();
    });
  });

  test('TC-BULK-INFO-010: Invalid list search shows no-result state', async ({ bd }) => {
    await test.step('Search bogus keyword shows empty / no deployments state', async () => {
      await bd.searchDeployment(`zz_no_deploy_${Date.now()}`);
      await bd.expectNoDeploymentResults();
    });
  });
});
