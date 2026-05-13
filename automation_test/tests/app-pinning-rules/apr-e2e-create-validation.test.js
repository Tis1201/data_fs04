const { createAppPinningRulesE2ETest } = require('./apr-e2e-shared');
const config = require('../../config/config-loader');
const {
  createPinRulesPage,
  createPinRuleViaApi,
  expectDeviceAppPinned,
  expectDeviceAppNotPinned,
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

  test('TC-PIN-E2E-017: Device-scoped rule pins app on target device only; excluded device stays unpinned', async ({
    page,
  }) => {
    test.setTimeout(4 * 60 * 1000);

    const targetDeviceId =
      config.pageURL?.appPinningRules?.targetDeviceId || config.pageURL?.devices?.onlineDeviceId;
    const excludedDeviceId =
      config.pageURL?.appPinningRules?.excludedDeviceId ||
      config.pageURL?.devices?.secondaryOnlineDeviceId;
    const preferredPackage = config.pageURL?.devices?.installApp?.packageName;

    test.skip(
      !targetDeviceId || !excludedDeviceId,
      'Set devices.onlineDeviceId and appPinningRules.excludedDeviceId (or devices.secondaryOnlineDeviceId).',
    );
    test.skip(
      targetDeviceId === excludedDeviceId,
      'Target and excluded device ids must be different for TC-PIN-E2E-017.',
    );

    const name = `PIN E2E Selected vs excluded ${Date.now()}`;
    let installedOnTarget;

    await test.step('Pick an installed package present on both devices', async () => {
      installedOnTarget = await getFirstInstalledAppForDevice(page, targetDeviceId, preferredPackage);
      await getFirstInstalledAppForDevice(page, excludedDeviceId, installedOnTarget.packageName);
    });

    await test.step('Create active pin rule targeting only the first device', async () => {
      await createPinRuleViaApi(page, {
        name,
        appPackage: installedOnTarget.packageName,
        apps: [installedOnTarget.packageName],
        targetType: 'devices',
        targetValue: [targetDeviceId],
        isActive: true,
      });
    });

    await test.step('Target device: API reports app pinned', async () => {
      await expectDeviceAppPinned(page, targetDeviceId, installedOnTarget.packageName);
    });

    await test.step('Excluded device: same package must not be pinned by this rule', async () => {
      await expectDeviceAppNotPinned(page, excludedDeviceId, installedOnTarget.packageName);
    });
  });
});
