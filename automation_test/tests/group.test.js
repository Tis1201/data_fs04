const { expect } = require('@playwright/test');
const { test } = require('../utils/persistent-browser');
const config = require('../config/config-loader');
const AssetLoader = require('../utils/asset-loader');
const { GroupPage } = require('../pages/groups/group-page');

const groupName = config.pageURL.groups?.name || `Test Group ${Date.now()}`;
const accountName = config.pageURL.groups?.accountName || 'Test Account';

test.describe('Group Management', () => {
    let groupPage;

    test.beforeEach(async ({ page }) => {
        groupPage = new GroupPage(page);
    });

    test('Given group details, when creating a new group, then it should be created successfully', async () => {
        await groupPage.createGroup(groupName, accountName, {
            description: 'Test group for automation testing',
            permissions: '{}'
        });
    });

    test('Given a group name, when editing the group name, then it should be updated successfully', async () => {
        await groupPage.editGroupNameViaName(groupName, groupName + "1");
    });

    test('Given a group name, when deleting the group via dialog, then it should be deleted successfully', async () => {
        await groupPage.deleteGroup(groupName);
    });

    test('Given a group name, when canceling delete dialog, then the group should remain in the list', async () => {
        await groupPage.cancelDeleteGroup(groupName);
    });

    test('Given groups list, when sorting by different columns, then sorting should work correctly', async () => {
        await groupPage.verifyAllSort();
    });
}); 