const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../../config/config-loader');
const DeviceDetailPage = require('../../../pages/iot/device-detail-page');
const DeviceTerminalPage = require('../../../pages/iot/device-terminal-page');
const {
  setActualResult,
  setTestCaseMetadata,
} = require('../../support/usecase-annotations');

const authFile = path.resolve(__dirname, '../../../user.json');

test.use({ storageState: authFile });

const pullFileConfig = config.pageURL?.devices?.pullFile || {};
const targetDeviceId =
  pullFileConfig.targetDeviceId ||
  config.pageURL?.devices?.pushFile?.targetDeviceId ||
  config.pageURL?.devices?.installApp?.targetDeviceId;
const validSourceFilePath =
  pullFileConfig.validSourceFilePath || '/sdcard/Download/test.txt';
const invalidSourceFilePath =
  pullFileConfig.invalidSourceFilePath || '/sdcard/Download/file_not_exists_12345.txt';
const terminalVerifyCommand = pullFileConfig.terminalVerifyCommand || '';
const terminalVerifyExpectedPattern =
  pullFileConfig.terminalVerifyExpectedPattern || '__E2E_EXISTS__';

function createPullFileContext(page) {
  return {
    config,
    targetDeviceId,
    pullFileConfig,
    validSourceFilePath,
    invalidSourceFilePath,
    terminalVerifyCommand,
    terminalVerifyExpectedPattern,
    deviceDetailPage: new DeviceDetailPage(page, {
      appUrl: config.appURL,
      devicePath: config.pageURL?.devices?.detailPath,
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        activityLog: config.timeouts?.activityLogMs,
      },
      maxActivityLogRows: 50,
    }),
    terminalPage: new DeviceTerminalPage(page, {
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        terminalReady: config.timeouts?.terminalReadyMs,
        terminalCommand: config.timeouts?.terminalCommandMs,
      },
    }),
  };
}

async function openOnlineDeviceDetail(context) {
  await context.deviceDetailPage.goto();
  await context.deviceDetailPage.waitForPageReady();
  await context.deviceDetailPage.verifyDeviceIsOnline();
}

async function openPullFileModal(context) {
  await openOnlineDeviceDetail(context);
  await context.deviceDetailPage.clickPullFile();
  await context.deviceDetailPage.waitForPullFileModalVisible();
}

async function openActivityTabReady(context) {
  await context.deviceDetailPage.openActivityTab();
  await context.deviceDetailPage.waitForPageReady();
  await context.deviceDetailPage.verifyDeviceIsOnline();
  await context.deviceDetailPage.waitForActivityLogsReady();
}

module.exports = {
  test,
  expect,
  createPullFileContext,
  openOnlineDeviceDetail,
  openPullFileModal,
  openActivityTabReady,
  pullFileConfig,
  validSourceFilePath,
  invalidSourceFilePath,
  terminalVerifyCommand,
  terminalVerifyExpectedPattern,
  setActualResult,
  setTestCaseMetadata,
};
