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

const snapshotConfig = config.pageURL?.devices?.snapshot || {};
const targetDeviceId =
  snapshotConfig.targetDeviceId ||
  config.pageURL?.devices?.snapshotTargetDeviceId;
const terminalVerifyCommand =
  snapshotConfig.terminalVerifyCommand || config.pageURL?.devices?.terminal?.smokeCommand || 'id';
const terminalVerifyExpectedPattern =
  snapshotConfig.terminalVerifyExpectedPattern ||
  config.pageURL?.devices?.terminal?.smokeExpectedPattern ||
  'uid=';

function createSnapshotContext(page) {
  return {
    config,
    snapshotConfig,
    targetDeviceId,
    terminalVerifyCommand,
    terminalVerifyExpectedPattern,
    deviceDetailPage: new DeviceDetailPage(page, {
      appUrl: config.appURL,
      devicePath: config.pageURL?.devices?.detailPath,
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        snapshotImage: config.timeouts?.snapshotImageMs,
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

async function prepareSnapshotFlow(context) {
  await context.deviceDetailPage.openActivityTab();
  await context.deviceDetailPage.waitForPageReady();
  await context.deviceDetailPage.verifyDeviceIsOnline();
  await context.deviceDetailPage.waitForActivityLogsReady();
}

async function runSnapshotHappyFlow(context) {
  const existingLogSignatures = await context.deviceDetailPage.getActivityLogSignatures();

  await context.deviceDetailPage.triggerSnapshot();
  await context.deviceDetailPage.waitForSnapshotImage();
  await context.deviceDetailPage.closeSnapshotModalIfVisible();

  const snapshotLog = await context.deviceDetailPage.waitForNewSnapshotSuccessLog(
    existingLogSignatures
  );

  expect(
    snapshotLog,
    'Expected a new Snapshot-related Activity Log entry after triggering Snapshot.'
  ).not.toBeNull();
  expect(
    snapshotLog.statusText,
    'Snapshot Activity Log status should be Success.'
  ).toMatch(/success/i);
  expect(
    `${snapshotLog.descriptionText} ${snapshotLog.detailsText} ${snapshotLog.rowText}`,
    'Matched Activity Log entry should be related to Snapshot.'
  ).toMatch(/screenshot|snapshot|captured screenshot/i);

  return snapshotLog;
}

module.exports = {
  test,
  expect,
  createSnapshotContext,
  prepareSnapshotFlow,
  runSnapshotHappyFlow,
  snapshotConfig,
  terminalVerifyCommand,
  terminalVerifyExpectedPattern,
  setActualResult,
  setTestCaseMetadata,
};
