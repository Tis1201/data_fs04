const { expect } = require('@playwright/test');
const { test } = require('../utils/persistent-browser');
const config = require('../config/config-loader');
const AssetLoader = require('../utils/asset-loader');
const { UserPage } = require('../pages/users/user-page');

const email = config.pageURL.users?.email || `test${Date.now()}@example.com`;
const name = config.pageURL.users?.name || `Test User ${Date.now()}`;

test.describe('User Management', () => {
    let userPage;

    test.beforeEach(async ({ page }) => {
        userPage = new UserPage(page);
    });

    test('Given user details, when creating a new user, then it should be created successfully', async () => {
        await userPage.createUser(email, name, {
            password: 'TestPassword123!',
            role: 'User',
            status: 'Active'
        });
    });

    test('Given a user email, when editing the user name, then it should be updated successfully', async () => {
        await userPage.editUserNameViaEmail(email, name + "1");
    });

    test('Given a user email, when canceling deactivate dialog, then the user should remain active', async () => {
        await userPage.cancelDeactivateUser(email);
    });

    test('Given a user email, when deactivating the user via dialog, then it should be deactivated successfully', async () => {
        await userPage.deactivateUser(email);
    });

    test('Given a user email, when canceling delete dialog, then the user should remain in the list', async () => {
        await userPage.cancelDeleteUser(email);
    });

    test('Given a user email, when deleting the user via dialog, then it should be deleted successfully', async () => {
        await userPage.deleteUser(email);
    });

    test('Given users list, when sorting by different columns, then sorting should work correctly', async () => {
        await userPage.verifyAllSort();
    });
});
