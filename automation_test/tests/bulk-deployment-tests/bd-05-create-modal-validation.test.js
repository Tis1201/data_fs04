const { createBulkTest } = require('./bd-shared');
const { T, buildDraftPayload } = require('../../pages/bulk-deployments/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 5 — Add Deployment modal validation (subset of TC-BULK-CREATE / VERSION)', () => {
  test('TC-BULK-CREATE-003: Empty Deployment Name blocks Save as Draft', async ({ bd }) => {
    await test.step('Open Add Deployment with only non-name fields', async () => {
      await bd.openAddDeploymentModal();
      await bd.inputByLabel(T.FORM.NAME_LABEL).click({ clickCount: 3 });
      await bd.inputByLabel(T.FORM.NAME_LABEL).fill('');
      await bd.fillDeploymentForm({
        targetOS: T.FORM.ANDROID,
        version: '1.0.0',
        batchSize: 100,
        schedule: T.FORM.NONE,
      });
      await bd.saveAsDraftExpectBlocked();
    });
  });

  test('TC-BULK-CREATE-007: Deployment Name max length enforced (50 chars)', async ({ bd }) => {
    await test.step('Fill 50 characters and see max counter', async () => {
      await bd.openAddDeploymentModal();
      const longName = 'a'.repeat(50);
      await bd.fillInput(T.FORM.NAME_LABEL, longName);
      await expect(bd.getCharCounterNameMax()).toBeVisible();
    });
  });

  test('TC-BULK-VERSION-001 / TC-BULK-CREATE-011: Version defaults to 1.0.0 on Add Deployment', async ({ bd }) => {
    await test.step('Version field shows default', async () => {
      await bd.openAddDeploymentModal();
      await expect(bd.inputByLabel(T.FORM.VERSION_LABEL)).toHaveValue('1.0.0');
    });
  });

  test('TC-BULK-VERSION-002: Version field accepts edits during create', async ({ bd }) => {
    await test.step('Change Version input', async () => {
      await bd.openAddDeploymentModal();
      await bd.fillInput(T.FORM.VERSION_LABEL, '1.2.3');
      await expect(bd.inputByLabel(T.FORM.VERSION_LABEL)).toHaveValue('1.2.3');
    });
  });

  test('TC-BULK-CREATE-014: Cancel Add Deployment does not create deployment', async ({ bd }) => {
    test.setTimeout(3 * 60 * 1000);
    const unique = `Bulk CancelModal ${Date.now()}`;

    await test.step('Fill form then Cancel', async () => {
      await bd.openAddDeploymentModal();
      await bd.fillDeploymentForm(buildDraftPayload({ name: unique }));
      await bd.cancelButton.click();
      await expect(bd.addDeploymentDialog).toBeHidden({ timeout: bd.timeout });
    });

    await test.step('Search list — created name not present', async () => {
      await bd.gotoList();
      await bd.waitForListReady();
      await bd.searchDeployment(unique);
      await bd.expectNoDeploymentResults();
    });
  });
});
