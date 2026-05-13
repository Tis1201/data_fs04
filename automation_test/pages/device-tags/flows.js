const config = require('../../config/config-loader');
const DeviceTagsPage = require('./device-tags-page');

function deviceTagsAppOrigin() {
  if (!config?.baseURL) {
    throw new Error('Missing required config: baseURL (config/environments/<env>.js).');
  }
  return new URL(config.baseURL).origin;
}

function createDeviceTagsPage(page, options = {}) {
  return new DeviceTagsPage(page, {
    ...options,
    appUrl: options.appUrl || deviceTagsAppOrigin(),
    timeout: options.timeout || config?.timeouts?.pageLoadMs || 30000,
  });
}

function buildTagName(prefix = 'E2E Tag') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix} ${stamp}`;
}

module.exports = {
  config,
  createDeviceTagsPage,
  buildTagName,
  deviceTagsAppOrigin,
};
