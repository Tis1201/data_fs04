const { createDeviceTagsE2ETest, buildTagName, tagTestData } = require('./device-tags-e2e-shared');

const test = createDeviceTagsE2ETest();
const expect = test.expect;

test.describe('E2E — Device Tags create, edit, assign, and delete', () => {
  test('TC-DT-E2E-010: Create tag, open detail, edit, and delete with cleanup', async ({
    tags,
    trackedTagNames,
  }) => {
    const originalName = buildTagName('E2E Tag CRUD');
    const updatedName = `${originalName} Updated`;
    trackedTagNames.push(originalName, updatedName);

    await test.step('Create a new tag from the Tags list', async () => {
      await tags.createTag({
        name: originalName,
        description: 'Original description created by E2E flow.',
      });
      await expect(tags.rowByText(originalName)).toBeVisible();
    });

    await test.step('Open tag detail from row action menu and verify overview data', async () => {
      await tags.openDetailFromActionMenu(originalName);
      await expect(tags.detailOverviewCard).toContainText(originalName);
      await expect(tags.detailOverviewCard).toContainText('Original description created by E2E flow.');
    });

    await test.step('Edit the tag from detail and verify updated overview', async () => {
      await tags.editTagFromDetail({
        name: updatedName,
        description: 'Updated description created by E2E flow.',
      });
      await expect(tags.detailOverviewCard).toContainText(updatedName);
      await expect(tags.detailOverviewCard).toContainText('Updated description created by E2E flow.');
    });

    await test.step('Delete the updated tag from detail and confirm it is removed from the list', async () => {
      await tags.deleteFromDetail();
      await tags.searchByName(updatedName);
      await tags.expectNoResults();
    });
  });

  test('TC-DT-E2E-011: Duplicate tag name is blocked by validation', async ({ tags, trackedTagNames }) => {
    const tagName = buildTagName('E2E Tag Duplicate');
    trackedTagNames.push(tagName);

    await test.step('Create an initial tag with a unique name', async () => {
      await tags.createTag({
        name: tagName,
        description: 'Initial duplicate validation tag.',
      });
    });

    await test.step('Attempt to create another tag with the same name', async () => {
      const dialog = await tags.openAddTagModal();
      await tags.fillTagDialog(dialog, {
        name: tagName,
        description: 'Duplicate name should be rejected.',
      });
      await tags.submitTagDialog(dialog, /^Add$|^Save$|Create/i);
      await expect(dialog).toContainText(/already exists/i);
    });
  });

  test('TC-DT-E2E-012: Assign device to tag from detail and clean up by deleting the tag', async ({
    tags,
    trackedTagNames,
  }) => {
    const tagName = buildTagName('E2E Tag Assign Device');
    trackedTagNames.push(tagName);

    await test.step('Create a tag for device assignment', async () => {
      await tags.createTag({
        name: tagName,
        description: 'Device assignment tag created by E2E flow.',
      });
    });

    await test.step('Open detail and assign a device through Add device modal', async () => {
      await tags.openDetailByName(tagName);
      await tags.addDeviceBySearch(tagTestData.deviceSearch);
    });

    await test.step('Delete the tag and verify assignment cleanup through the product flow', async () => {
      await tags.deleteFromDetail();
      await tags.searchByName(tagName);
      await tags.expectNoResults();
    });
  });

  test('TC-DT-E2E-013: Only the selected device receives the tag; unselected device must not show it', async ({
    tags,
    trackedTagNames,
  }) => {
    test.skip(!tagTestData.assignExcludedDeviceId, 'Set deviceTags.assignExcludedDeviceId in your env config.');

    const tagName = `E2E-sel-${Date.now()}`;
    trackedTagNames.push(tagName);

    await test.step('Add tag, pick one device in the modal (search returns several)', async () => {
      await tags.createTag({
        name: tagName,
        description: 'TC-DT-E2E-013',
      });
      await tags.openDetailByName(tagName);
      await tags.addDeviceBySearchAndPick(
        tagTestData.assignModalMultiSearch,
        tagTestData.assignPickDeviceMatch,
      );
    });

    await test.step('Tag detail: only one device row, and it matches what we clicked', async () => {
      const rows = tags.assignedDevicesTable
        .locator('tbody tr')
        .filter({ hasNotText: /no devices assigned/i });
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(tagTestData.assignPickDeviceMatch, { timeout: tags.timeout });
    });

    await test.step('The other device (excluded id in config) has no chip for this tag', async () => {
      await tags.expectDeviceDetailDoesNotShowTag(tagTestData.assignExcludedDeviceId, tagName);
    });

    await test.step('Delete tag, list should be clean', async () => {
      await tags.gotoList();
      await tags.searchByName(tagName);
      await tags.openDetailByName(tagName);
      await tags.deleteFromDetail();
      await tags.searchByName(tagName);
      await tags.expectNoResults();
    });
  });
});
