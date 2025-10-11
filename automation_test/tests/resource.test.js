const { expect } = require('@playwright/test');
const { test } = require('../utils/persistent-browser');
const config = require('../config/config-loader');
const AssetLoader = require('../utils/asset-loader');
const { ResourcePage } = require('../pages/resources/resource-page');

const name = config.pageURL.resources.name || `Test Name ${Date.now()}`;
const file = config.pageURL.resources.file;
const editName = name + "1";

test.describe('Resource Management', () => {
    let resourcePage;

    test.beforeEach(async ({ page }) => {
        resourcePage = new ResourcePage(page);
    });

    test('Create', async () => {
        await resourcePage.create(name, file);
    });

    test('Edit', async () => {
        await resourcePage.editNameViaName(name, editName);
    });

    test('Sort', async () => {
        await resourcePage.verifyAllSort();
    });

    test('Cancel delete', async () => {
        await resourcePage.cancelDelete(editName);
    });

    test('Delete', async () => {
        await resourcePage.delete(editName);
    });

});
