const { createAppPinningRulesE2ETest } = require('./apr-e2e-shared');
const config = require('../../config/config-loader');
const {
  createPinRulesPage,
  createPinRuleViaApi,
  expectDeviceAppPinned,
  expectPinnedAppVisibleInDeviceResources,
  getFirstInstalledAppForDevice,
  openDeviceResourcesTab,
} = require('../../pages/app-pinning-rules/flows');

const test = createAppPinningRulesE2ETest();
const expect = test.expect;

test.describe('E2E — App Pinning Rules create and validation', () => {
  test('TC-PIN-E2E-002: Create active App Pinning Rule for all devices through UI', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const pinRules = createPinRulesPage(page);
    const name = `PIN E2E Create ${Date.now()}`;

    await test.step('Open Add Rule modal and fill rule basics', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      const dialog = await pinRules.openAddRuleModal();
      await pinRules.fillRuleBasics(dialog, name, 'Created by App Pinning Rules E2E');
      await pinRules.addFirstAvailableApp(dialog);
      await pinRules.saveAndPublish(dialog);
    });

    await test.step('Verify created rule appears in list with active status and pinned app count', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      await pinRules.searchRule(name);
      const row = pinRules.rowByText(name);
      await expect(row).toBeVisible();
      await expect(row.locator('td').nth(1)).toContainText('1');
      await expect(row).toContainText('All Devices');
      await expect(row).toContainText('Active');
    });
  });

  test('TC-PIN-E2E-011/012: Add Rule validates required name and pinned app', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const pinRules = createPinRulesPage(page);
    const name = `PIN E2E Validation ${Date.now()}`;

    let dialog;
    await test.step('Open Add Rule modal', async () => {
      await pinRules.gotoList();
      await pinRules.waitForListReady();
      dialog = await pinRules.openAddRuleModal();
    });

    await test.step('Attempt Save & Publish with empty name', async () => {
      await dialog.getByRole('button', { name: 'Save & Publish' }).click();
      await expect(dialog.getByText('Name is required')).toBeVisible();
    });

    await test.step('Fill name but leave apps empty', async () => {
      await dialog.getByPlaceholder('Rule name').fill(name);
      await dialog.getByRole('button', { name: 'Save & Publish' }).click();
      await expect(dialog.getByText('At least one pinned app is required for a pin rule.')).toBeVisible();
    });

    await test.step('Cancel modal after validation checks', async () => {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    });
  });

  test('TC-PIN-E2E-016: Applied App Pinning Rule pins app on target device Resources tab', async ({
    page,
  }) => {
    test.setTimeout(4 * 60 * 1000);
    const deviceId = config.pageURL?.devices?.onlineDeviceId;
    const preferredPackage = config.pageURL?.devices?.installApp?.packageName;
    const name = `PIN E2E Device Resources ${Date.now()}`;
    let installedApp;

    await test.step('Create active pin rule for an installed app on the target device', async () => {
      installedApp = await getFirstInstalledAppForDevice(page, deviceId, preferredPackage);
      await createPinRuleViaApi(page, {
        name,
        appPackage: installedApp.packageName,
        apps: [installedApp.packageName],
        targetType: 'devices',
        targetValue: [deviceId],
        isActive: true,
      });
    });

    await test.step('Verify pin state is applied for the target device', async () => {
      await expectDeviceAppPinned(page, deviceId, installedApp.packageName);
    });

    await test.step('Open Device Resources tab and verify the app row is pinned', async () => {
      await openDeviceResourcesTab(page, deviceId);
      await expectPinnedAppVisibleInDeviceResources(
        page,
        installedApp.packageName,
        installedApp.appName
      );
    });
  });
});
