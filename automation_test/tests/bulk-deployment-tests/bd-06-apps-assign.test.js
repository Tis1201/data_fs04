const { createBulkTest, bulkTestData } = require('./bd-shared');
const { createDraftOpenDetail } = require('../../pages/iot/modules/bulk-deployment/flows');

const test = createBulkTest();
const expect = test.expect;

test.describe('Section 6 — Assign apps to draft (TC-BULK-APPS-002~004, TC-BULK-CREATE-022~024)', () => {
  test('TC-BULK-APPS-002 / TC-BULK-CREATE-022: Add Digital Signage', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk AppDS ${Date.now()}` });
    const app = bulkTestData.digitalSignageAppName;

    await test.step(`Assign "${app}" from Add App modal`, async () => {
      await bulkPage.addAppsByNames([app]);
      await expect(bulkPage.rowByText(app)).toBeVisible();
    });
  });

  test('TC-BULK-APPS-003 / TC-BULK-CREATE-023: Add counter_now', async ({ page }) => {
    test.setTimeout(4 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk AppCounter ${Date.now()}` });
    const app = bulkTestData.counterNowAppName;

    await test.step(`Assign "${app}"`, async () => {
      await bulkPage.addAppsByNames([app]);
      await expect(bulkPage.rowByText(app)).toBeVisible();
    });
  });

  test('TC-BULK-APPS-004 / TC-BULK-CREATE-024: Add multiple apps in one assignment', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const { bulkPage } = await createDraftOpenDetail(page, { name: `Bulk AppMulti ${Date.now()}` });
    const apps = [bulkTestData.digitalSignageAppName, bulkTestData.counterNowAppName];

    await test.step('Assign two apps in one modal session', async () => {
      await bulkPage.addAppsByNames(apps);
      for (const app of apps) {
        await expect(bulkPage.rowByText(app)).toBeVisible();
      }
    });
  });
});
