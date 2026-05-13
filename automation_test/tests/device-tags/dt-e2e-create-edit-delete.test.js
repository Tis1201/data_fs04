const { createDeviceTagsE2ETest, buildTagName, tagTestData } = require('./device-tags-e2e-shared');

const test = createDeviceTagsE2ETest();
const expect = test.expect;

async function dialogDismiss(page, dialog) {
  const cancel = dialog.getByRole('button', { name: /Cancel/i }).first();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    return;
  }
  await page.keyboard.press('Escape').catch(() => {});
}

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

  test('TC-DT-E2E-014: Delete tag from list row menu removes it from the table', async ({ tags, trackedTagNames }) => {
    const tagName = buildTagName('E2E Tag Delete List');
    trackedTagNames.push(tagName);

    await test.step('Create tag then delete using row Actions → Delete on the list page', async () => {
      await tags.createTag({
        name: tagName,
        description: 'Deleted from list menu.',
      });
      await tags.deleteTagFromList(tagName);
    });

    await test.step('Tag no longer appears when searching', async () => {
      await tags.searchByName(tagName);
      await tags.expectNoResults();
    });
  });

  test('TC-DT-E2E-015: Open tag detail by clicking the tag name link on the list', async ({
    tags,
    trackedTagNames,
  }) => {
    const tagName = buildTagName('E2E Tag Name Link');
    trackedTagNames.push(tagName);

    await test.step('Create tag and open detail via the name cell link', async () => {
      await tags.createTag({
        name: tagName,
        description: 'Opened from list name link.',
      });
      await tags.openDetailByName(tagName);
      await expect(tags.detailOverviewCard).toContainText(tagName);
      await expect(tags.detailOverviewCard).toContainText('Opened from list name link.');
    });

    await test.step('Cleanup from detail delete', async () => {
      await tags.deleteFromDetail();
      await tags.searchByName(tagName);
      await tags.expectNoResults();
    });
  });

  test('TC-DT-E2E-016: Edit tag from list row menu updates list and detail', async ({ tags, trackedTagNames }) => {
    const original = buildTagName('E2E Tag Edit List');
    const renamed = `${original} Renamed`;
    trackedTagNames.push(original, renamed);

    await test.step('Create tag and edit via list Actions → Edit', async () => {
      await tags.createTag({
        name: original,
        description: 'Before list edit.',
      });
      await tags.editTagFromListMenu(original, {
        name: renamed,
        description: 'After list edit.',
      });
    });

    await test.step('List row shows updated name and description', async () => {
      await expect(tags.tagDialog()).toBeHidden({ timeout: tags.timeout });
      await tags.searchByName(renamed);
      await expect(tags.rowByText(renamed)).toBeVisible();
      await expect(tags.rowByText(renamed)).toContainText('After list edit.');
    });

    await test.step('Detail overview reflects updated fields', async () => {
      await tags.openDetailByName(renamed);
      await expect(tags.detailOverviewCard).toContainText(renamed);
      await expect(tags.detailOverviewCard).toContainText('After list edit.');
    });

    await test.step('Cleanup', async () => {
      await tags.deleteFromDetail();
    });
  });

  test('TC-DT-E2E-017: Remove device from tag via Assigned devices row menu', async ({ tags, trackedTagNames }) => {
    const tagName = buildTagName('e2e remove device');
    trackedTagNames.push(tagName);

    await test.step('Create tag, assign one device, then remove it', async () => {
      await tags.createTag({
        name: tagName,
        description: 'TC-DT-E2E-017',
      });
      await tags.openDetailByName(tagName);
      await tags.addDeviceBySearch(tagTestData.deviceSearch);
      await tags.removeAssignedDeviceByRowMatch(tagTestData.deviceSearch);
    });

    await test.step('Assigned devices table shows empty state', async () => {
      await expect(tags.assignedDevicesTable.getByText(/no devices assigned/i)).toBeVisible({
        timeout: tags.timeout,
      });
    });

    await test.step('Cleanup tag', async () => {
      await tags.deleteFromDetail();
    });
  });

  test('TC-DT-E2E-018: Create tag with empty name does not complete successfully', async ({ tags }) => {
    await test.step('Add Tag with blank name: dialog stays open or inline/server error is shown', async () => {
      const dialog = await tags.attemptSubmitNewTagWithEmptyName();
      await expect(dialog).toBeVisible({ timeout: tags.timeout });
      const nameInput = dialog.locator('input').first();
      await expect(nameInput).toHaveValue('');
      const valueMissing = await nameInput.evaluate((el) => el.validity?.valueMissing ?? false);
      if (!valueMissing) {
        await expect(
          dialog.getByText(/required|tag name|invalid|cannot be empty|enter a name/i).first(),
        ).toBeVisible({ timeout: 8000 });
      }
    });

    await test.step('Dismiss modal', async () => {
      const d = tags.tagDialog();
      if (await d.isVisible().catch(() => false)) {
        await dialogDismiss(tags.page, d);
      }
    });
  });

  test('TC-DT-E2E-019: Edit tag to an existing name is rejected', async ({ tags, trackedTagNames }) => {
    const nameA = buildTagName('e2e dup name A');
    const nameB = buildTagName('e2e dup name B');
    trackedTagNames.push(nameA, nameB);

    await test.step('Create two distinct tags', async () => {
      await tags.createTag({ name: nameA, description: 'first' });
      await tags.createTag({ name: nameB, description: 'second' });
    });

    await test.step('Rename second tag to first tag name and expect error', async () => {
      await tags.gotoList();
      await tags.searchByName(nameB);
      const menu = await tags.openRowActionMenu(nameB);
      await menu.getByText('Edit', { exact: true }).click();
      const dialog = tags.tagDialog();
      await expect(dialog).toBeVisible({ timeout: tags.timeout });
      await tags.fillTagDialog(dialog, { name: nameA, description: 'collision' });
      await tags.submitTagDialog(dialog, /^Save$|Update/i);
      await expect(dialog).toBeVisible({ timeout: tags.timeout });
      await expect(dialog).toContainText(/already exists/i);
      await dialogDismiss(tags.page, dialog);
    });
  });

  test('TC-DT-E2E-020: Assign two devices to the same tag sequentially', async ({
    tags,
    trackedTagNames,
  }) => {
    const tagName = buildTagName('e2e two devices');
    trackedTagNames.push(tagName);

    await test.step('Create tag and add two devices one after another', async () => {
      await tags.createTag({
        name: tagName,
        description: 'TC-DT-E2E-020',
      });
      await tags.openDetailByName(tagName);
      await tags.addDeviceBySearchAndPick(
        tagTestData.assignModalMultiSearch,
        tagTestData.assignPickDeviceMatch,
      );
      await tags.addDeviceBySearchAndPick(
        tagTestData.assignSecondDeviceSearch,
        tagTestData.assignSecondDevicePick,
      );
    });

    await test.step('Exactly two assigned device rows', async () => {
      await expect(tags.assignedDeviceDataRows()).toHaveCount(2);
    });

    await test.step('Cleanup', async () => {
      await tags.deleteFromDetail();
    });
  });
});
