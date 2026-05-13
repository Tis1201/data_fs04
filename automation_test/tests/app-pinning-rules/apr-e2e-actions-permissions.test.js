const { createAppPinningRulesE2ETest } = require('./apr-e2e-shared');
const {
  appOrigin,
  createPinRulesPage,
  createPinRuleViaApi,
} = require('../../pages/app-pinning-rules/flows');

const test = createAppPinningRulesE2ETest();
const expect = test.expect;

test.describe('E2E — App Pinning Rules actions and permissions', () => {
  test('TC-PIN-E2E-007/005: Duplicate and delete custom rule from list actions', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const pinRules = createPinRulesPage(page);
    const name = `PIN E2E Actions ${Date.now()}`;
    let ruleId;

    await test.step('Create custom rule through API setup', async () => {
      const created = await createPinRuleViaApi(page, { name, isActive: true });
      ruleId = created.rule.id;
    });

    await test.step('Duplicate custom rule from row action menu', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      await pinRules.searchRule(name);
      await pinRules.duplicateRule(name);
      await pinRules.searchRule(`${name} (Copy)`);
      await expect(pinRules.rowByText(`${name} (Copy)`)).toBeVisible();
      await expect(pinRules.rowByText(`${name} (Copy)`)).toContainText('Inactive');
    });

    await test.step('Delete original rule from row action menu and verify by id', async () => {
      await pinRules.searchRule(ruleId);
      await expect(pinRules.rowByText(ruleId)).toBeVisible();
      await pinRules.deleteRule(ruleId);
      await pinRules.searchRule(ruleId);
      await pinRules.expectNoRulesFound();
    });
  });

  test('TC-PIN-E2E-015: Account System Rule does not expose duplicate/delete actions', async ({ page }) => {
    const pinRules = createPinRulesPage(page);

    await test.step('Search for system rule and inspect action menu', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      await pinRules.searchRule('Account System Rule');
      await expect(pinRules.rowByText('Account System Rule')).toBeVisible();

      const actions = await pinRules.getRowActionLabels('Account System Rule');
      expect(actions).toContain('View');
      expect(actions).not.toContain('Duplicate');
      expect(actions).not.toContain('Delete');
    });
  });

  test('TC-PIN-E2E-014: Non-admin user cannot access admin App Pinning Rules route', async ({ page }) => {
    await test.step('Open admin pin-rules URL with user session', async () => {
      await page.goto(`${appOrigin()}/admin/iot/pin-rules`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });

    await test.step('Verify access is redirected away from admin pin-rules', async () => {
      await expect
        .poll(() => page.url(), {
          timeout: 30000,
          message: 'Expected user session to be redirected away from admin pin-rules',
        })
        .not.toContain('/admin/iot/pin-rules');
    });
  });
});
