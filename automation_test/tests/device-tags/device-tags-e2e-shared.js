const path = require('path');
const base = require('@playwright/test');
const { createDeviceTagsPage, buildTagName, config } = require('../../pages/device-tags/flows');

if (!config?.baseURL) {
  throw new Error('Missing baseURL in config-loader for Device Tags tests.');
}

const authFile = path.join(__dirname, '..', '..', 'user.json');
const tagsCfg = config.pageURL?.deviceTags || {};

const tagTestData = {
  deviceSearch: tagsCfg.deviceSearch || config.pageURL?.bulkDeployments?.onlineDeviceSearch || '3576M',
};

function createDeviceTagsE2ETest() {
  const test = base.test.extend({
    trackedTagNames: async ({ page }, use) => {
      const names = [];
      await use(names);
      const tags = createDeviceTagsPage(page);
      await tags.cleanupTagNames(names);
    },
    tags: async ({ page }, use) => {
      const tags = createDeviceTagsPage(page);
      await tags.gotoList();
      await use(tags);
    },
  });

  test.use({ storageState: authFile });
  return test;
}

module.exports = {
  authFile,
  buildTagName,
  createDeviceTagsE2ETest,
  tagTestData,
};
