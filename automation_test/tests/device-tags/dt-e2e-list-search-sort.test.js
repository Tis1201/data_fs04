const { createDeviceTagsE2ETest, buildTagName } = require('./device-tags-e2e-shared');

const test = createDeviceTagsE2ETest();
const expect = test.expect;

function getSortStateFromUrl(url) {
  const parsed = new URL(url);
  return {
    sort: parsed.searchParams.get('sort') || '',
    order: parsed.searchParams.get('order') || '',
  };
}

test.describe('E2E — Device Tags list, search, and sort', () => {
  test('TC-DT-E2E-001: Tags list renders and search handles match and no-result keywords', async ({
    tags,
    trackedTagNames,
  }) => {
    const tagName = buildTagName('E2E Tag Search');
    trackedTagNames.push(tagName);

    await test.step('Verify Tags list page structure', async () => {
      await expect(tags.listTitle).toBeVisible();
      await expect(tags.listSubtitle).toBeVisible();
      await expect(tags.searchInput).toBeVisible();
      await expect(tags.addTagButton).toBeEnabled();
      await expect(tags.table).toBeVisible();
      await expect(tags.columnHeader('Name')).toBeVisible();
      await expect(tags.columnHeader('Description')).toBeVisible();
      await expect(tags.columnHeader('Assigned Devices')).toBeVisible();
      await expect(tags.columnHeader('Actions')).toBeVisible();
    });

    await test.step('Create a unique tag for search verification', async () => {
      await tags.createTag({
        name: tagName,
        description: 'Search coverage tag created by E2E flow.',
      });
    });

    await test.step('Search by exact tag name and verify only matching data is visible', async () => {
      await tags.searchByName(tagName);
      await expect(tags.rowByText(tagName)).toBeVisible();
      expect(new URL(tags.page.url()).searchParams.get('search')).toBe(tagName);
    });

    await test.step('Search by invalid keyword and verify empty state', async () => {
      const noResultKeyword = `zz_no_tag_result_${Date.now()}`;
      await tags.searchByName(noResultKeyword);
      await tags.expectNoResults();
      expect(new URL(tags.page.url()).searchParams.get('search')).toBe(noResultKeyword);
    });
  });

  test('TC-DT-E2E-002: Sort toggles all sortable columns and Actions remains non-sortable', async ({
    tags,
    trackedTagNames,
  }) => {
    const tagName = buildTagName('E2E Tag Sort');
    trackedTagNames.push(tagName);

    const sortableColumns = [
      { header: 'Name', sortField: 'name' },
      { header: 'Description', sortField: 'description' },
      { header: 'Assigned Devices', sortField: 'devicesCount' },
    ];

    await test.step('Create one tag so the list has sortable table data', async () => {
      await tags.createTag({
        name: tagName,
        description: 'Sort coverage tag created by E2E flow.',
      });
      await tags.searchByName('');
      await expect(tags.rowByText(tagName)).toBeVisible();
    });

    for (const column of sortableColumns) {
      await test.step(`Sort ${column.header} column twice and verify URL sort state`, async () => {
        await tags.clickColumnHeader(column.header);
        await expect
          .poll(() => getSortStateFromUrl(tags.page.url()), {
            message: `Expected ${column.header} to apply sort field`,
          })
          .toEqual({ sort: column.sortField, order: 'asc' });
        const firstState = getSortStateFromUrl(tags.page.url());
        expect(firstState.order).toBe('asc');

        await tags.clickColumnHeader(column.header);
        await expect
          .poll(() => getSortStateFromUrl(tags.page.url()), {
            message: `Expected ${column.header} to keep sort field after second click`,
          })
          .toEqual({ sort: column.sortField, order: 'desc' });
        const secondState = getSortStateFromUrl(tags.page.url());
        expect(secondState.order).toBe('desc');
      });
    }

    await test.step('Click Actions header and verify it does not become a sort field', async () => {
      const before = getSortStateFromUrl(tags.page.url());
      await tags.columnHeader('Actions').click();
      const after = getSortStateFromUrl(tags.page.url());

      expect(after.sort).not.toBe('actions');
      expect(after.sort).toBe(before.sort);
      expect(after.order).toBe(before.order);
    });
  });
});
