const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../../config/config-loader');
const DeviceDetailPage = require('../../../pages/devices/device-detail/device-detail-page');
const DeviceControlPage = require('../../../pages/iot/device-control-page');
const DeviceTerminalPage = require('../../../pages/iot/device-terminal-page');
const {
  setActualResult,
  setTestCaseMetadata,
} = require('../../support/usecase-annotations');

const authFile = path.resolve(__dirname, '../../../user.json');

test.use({ storageState: authFile });

const controlConfig = config.pageURL?.devices?.control || {};
const terminalVerifyCommand =
  controlConfig.terminalVerifyCommand || config.pageURL?.devices?.terminal?.smokeCommand || 'id';
const terminalVerifyExpectedPattern =
  controlConfig.terminalVerifyExpectedPattern ||
  config.pageURL?.devices?.terminal?.smokeExpectedPattern ||
  'uid=';

function createControlContext(page, deviceId = controlConfig.targetDeviceId) {
  return {
    config,
    controlConfig,
    targetDeviceId: deviceId,
    terminalVerifyCommand,
    terminalVerifyExpectedPattern,
    deviceDetailPage: new DeviceDetailPage(page, {
      appUrl: config.appURL,
      devicePath: config.pageURL?.devices?.detailPath,
      deviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        activityLog: config.timeouts?.activityLogMs,
      },
      maxActivityLogRows: 50,
    }),
    deviceControlPage: new DeviceControlPage(page, {
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        controlReady: config.timeouts?.controlReadyMs,
      },
    }),
    terminalPage: new DeviceTerminalPage(page, {
      deviceId,
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
  createControlContext,
  openOnlineDeviceDetail,
  openActivityTabReady,
  controlConfig,
  terminalVerifyCommand,
  terminalVerifyExpectedPattern,
  setActualResult,
  setTestCaseMetadata,
};
