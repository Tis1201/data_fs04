const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../../config/config-loader');
const DeviceDetailPage = require('../../../pages/devices/device-detail/device-detail-page');
const DeviceTerminalPage = require('../../../pages/iot/device-terminal-page');
const {
  setActualResult,
  setTestCaseMetadata,
} = require('../../support/usecase-annotations');

const authFile = path.resolve(__dirname, '../../../user.json');

test.use({ storageState: authFile });

const rebootConfig = config.pageURL?.devices?.reboot || {};
const targetDeviceId =
  rebootConfig.targetDeviceId ||
  config.pageURL?.devices?.terminal?.targetDeviceId ||
  config.pageURL?.devices?.installApp?.targetDeviceId ||
  config.pageURL?.devices?.snapshotTargetDeviceId;
const terminalVerifyCommand =
  rebootConfig.terminalVerifyCommand || config.pageURL?.devices?.terminal?.recoveryCommand || 'id';
const terminalVerifyExpectedPattern =
  rebootConfig.terminalVerifyExpectedPattern ||
  config.pageURL?.devices?.terminal?.recoveryExpectedPattern ||
  'uid=';

function createRebootContext(page) {
  return {
    config,
    targetDeviceId,
    rebootConfig,
    terminalVerifyCommand,
    terminalVerifyExpectedPattern,
    deviceDetailPage: new DeviceDetailPage(page, {
      appUrl: config.appURL,
      devicePath: config.pageURL?.devices?.detailPath,
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        activityLog: config.timeouts?.activityLogMs,
        rebootFinalStatus:
          rebootConfig.finalStatusTimeoutMs || config.timeouts?.rebootFinalStatusMs,
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

async function openActivityTabReady(context) {
  await context.deviceDetailPage.openActivityTab();
  await context.deviceDetailPage.waitForPageReady();
  await context.deviceDetailPage.verifyDeviceIsOnline();
  await context.deviceDetailPage.waitForActivityLogsReady();
}

module.exports = {
  test,
  expect,
  createRebootContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  rebootConfig,
  terminalVerifyCommand,
  terminalVerifyExpectedPattern,
  setActualResult,
  setTestCaseMetadata,
};
