const { createBulkE2ETest, bulkTestData, T } = require('./bd-e2e-shared');
const {
  createDraftOpenDetail,
  createDraftWithAssignments,
} = require('../../pages/bulk-deployments/flows');

const test = createBulkE2ETest();
const expect = test.expect;

test.describe('E2E — Bulk Deployment version matrix (older/equal/newer)', () => {
  test('TC-BULK-E2E-020: Version older baseline persists across detail and list', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const olderVersion = '1.0.0';
    const name = `Bulk E2E VerOld ${Date.now()}`;

    let bulkPage;
    await test.step('Create draft with older version', async () => {
      const created = await createDraftOpenDetail(page, { name, version: olderVersion });
      bulkPage = created.bulkPage;
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, olderVersion);
    });

    await test.step('Verify list row version matches older value', async () => {
      await bulkPage.gotoList();
      await bulkPage.waitForListReady();
      await bulkPage.searchDeployment(name);
      expect(await bulkPage.getListCellText(name, 'version')).toContain(olderVersion);
    });
  });

  test('TC-BULK-E2E-021: Version equal (same version after edit save)', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const equalVersion = '2.2.2';

    let bulkPage;
    await test.step('Create draft with equal baseline version', async () => {
      const created = await createDraftOpenDetail(page, {
        name: `Bulk E2E VerEqual ${Date.now()}`,
        version: equalVersion,
      });
      bulkPage = created.bulkPage;
    });

    await test.step('Edit and save with the same version', async () => {
      await bulkPage.openEditDeploymentModal();
      await bulkPage.fillInput(T.FORM.VERSION_LABEL, equalVersion);
      await bulkPage.saveEditExpectDetail();
    });

    await test.step('Verify version remains equal on overview', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, equalVersion);
    });
  });

  test('TC-BULK-E2E-022: Version newer survives publish and list row', async ({ page }) => {
    test.setTimeout(bulkTestData.publishFlowTimeoutMs);
    const newerVersion = '9.9.9';
    const name = `Bulk E2E VerNew ${Date.now()}`;

    let bulkPage;
    await test.step('Create draft with assignments + newer version', async () => {
      const created = await createDraftWithAssignments(page, {
        payloadOverrides: { name, version: newerVersion },
        appNames: [bulkTestData.counterNowAppName],
        deviceNames: [bulkTestData.onlineDeviceSearch],
      });
      bulkPage = created.bulkPage;
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, newerVersion);
    });

    await test.step('Publish deployment', async () => {
      await bulkPage.publishFromDetail();
      expect([T.STATUS_PUBLISHED, T.STATUS_IN_PROGRESS, T.STATUS_COMPLETED]).toContain(
        await bulkPage.expectStatusBadgeVisible()
      );
    });

    await test.step('Verify newer version still shown on detail and list', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, newerVersion);
      await bulkPage.gotoList();
      await bulkPage.waitForListReady();
      await bulkPage.searchDeployment(name);
      expect(await bulkPage.getListCellText(name, 'version')).toContain(newerVersion);
    });
  });

  test('TC-BULK-E2E-023: Upgrade in-place on draft (older -> newer) via Edit', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const older = '1.0.0';
    const newer = '2.0.0';

    let bulkPage;
    await test.step('Create draft with older version', async () => {
      const created = await createDraftOpenDetail(page, {
        name: `Bulk E2E Upgrade ${Date.now()}`,
        version: older,
      });
      bulkPage = created.bulkPage;
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, older);
    });

    await test.step('Edit version to newer and save', async () => {
      await bulkPage.openEditDeploymentModal();
      await bulkPage.fillInput(T.FORM.VERSION_LABEL, newer);
      await bulkPage.saveEditExpectDetail();
    });

    await test.step('Verify version upgraded on overview', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, newer);
    });
  });

  test('TC-BULK-E2E-024: Downgrade in-place on draft (newer -> older) via Edit', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    const newer = '5.0.0';
    const older = '3.0.0';

    let bulkPage;
    await test.step('Create draft with newer version', async () => {
      const created = await createDraftOpenDetail(page, {
        name: `Bulk E2E Downgrade ${Date.now()}`,
        version: newer,
      });
      bulkPage = created.bulkPage;
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, newer);
    });

    await test.step('Edit version to older and save', async () => {
      await bulkPage.openEditDeploymentModal();
      await bulkPage.fillInput(T.FORM.VERSION_LABEL, older);
      await bulkPage.saveEditExpectDetail();
    });

    await test.step('Verify version downgraded on overview', async () => {
      await bulkPage.expectOverviewValue(T.OVERVIEW_FIELD_VERSION, older);
    });
  });
});
