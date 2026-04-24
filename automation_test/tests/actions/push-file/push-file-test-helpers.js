const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../../config/config-loader');
const DeviceDetailPage = require('../../../pages/devices/device-detail/device-detail-page');
const DeviceTerminalPage = require('../../../pages/iot/device-terminal-page');
const {
  setActualResult,
  setTestCaseMetadata,
} = require('../../support/usecase-annotations');
const {
  buildPrintfMarkerCommand,
  openTerminalSession,
} = require('../shared/device-action-common');

const authFile = path.resolve(__dirname, '../../../user.json');

test.use({ storageState: authFile });

const pushFileConfig = config.pageURL?.devices?.pushFile || {};
const targetDeviceId =
  pushFileConfig.targetDeviceId ||
  config.pageURL?.devices?.installApp?.targetDeviceId ||
  config.pageURL?.devices?.snapshotTargetDeviceId;
const validDestinationPath =
  pushFileConfig.validDestinationPath || '/sdcard/Download/';
const resourceSearchKeyword = pushFileConfig.resourceSearchKeyword || '';
const resourceExactName = pushFileConfig.resourceExactName || '';
const invalidDestinationPath = pushFileConfig.invalidDestinationPath || '/system/';
const noResultSearchKeyword =
  pushFileConfig.noResultSearchKeyword || 'zzzz_no_file_12345';
const terminalVerifyFileName =
  pushFileConfig.terminalVerifyFileName || resourceExactName || '';
const terminalVerifyPath = pushFileConfig.terminalVerifyPath || '';
const terminalVerifyCommand = pushFileConfig.terminalVerifyCommand || '';
const terminalVerifyExpectedPattern =
  pushFileConfig.terminalVerifyExpectedPattern || '__E2E_EXISTS__';

function joinUnixPath(basePath, fileName) {
  const normalizedBase = String(basePath || '').replace(/\/+$/, '');
  const normalizedName = String(fileName || '').replace(/^\/+/, '');
  return normalizedBase && normalizedName
    ? `${normalizedBase}/${normalizedName}`
    : normalizedBase || normalizedName;
}

function guessPushFileName(selectionText = '') {
  if (terminalVerifyFileName) {
    return terminalVerifyFileName;
  }

  const rawText = String(selectionText || '').trim();
  if (!rawText) {
    return '';
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  const explicitFileLine = lines.find((value) => /\.[A-Za-z0-9]{1,8}$/.test(value));
  if (explicitFileLine) {
    return explicitFileLine;
  }

  const explicitFileToken = rawText.match(/([A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8})/);
  if (explicitFileToken) {
    return explicitFileToken[1];
  }

  return resourceExactName || lines[0] || '';
}

function resolvePushFileTerminalTargetPath(selectionText = '') {
  if (terminalVerifyPath) {
    return terminalVerifyPath;
  }

  const fileName = guessPushFileName(selectionText);
  if (!fileName) {
    return '';
  }

  return joinUnixPath(validDestinationPath, fileName);
}

function escapeShellDoubleQuotes(value = '') {
  return String(value).replace(/(["\\$`])/g, '\\$1');
}

function buildSpaceTolerantShellPath(targetPath = '') {
  return String(targetPath)
    .trim()
    .replace(/\s+/g, '*');
}

function buildPushFileCleanupCommand(targetPath) {
  const cleanupPath = buildSpaceTolerantShellPath(targetPath);

  return `rm -f ${cleanupPath}`;
}

function buildPushFilePresenceProbeCommand(
  targetPath,
  presentMarker = '__E2E_PUSHFILE_STILL_EXISTS__',
  absentMarker = '__E2E_PUSHFILE_ABSENT__'
) {
  const escapedPath = escapeShellDoubleQuotes(targetPath);

  return [
    `if [ -e "${escapedPath}" ]; then`,
    `  ${buildPrintfMarkerCommand(presentMarker)};`,
    'else',
    `  ${buildPrintfMarkerCommand(absentMarker)};`,
    'fi',
  ].join(' ');
}

async function cleanupPushFileTarget(context, targetPath) {
  if (!targetPath) {
    return {
      skipped: true,
      skipReason: 'missing_target_path',
      targetPath,
    };
  }

  await openOnlineDeviceDetail(context);
  await openTerminalSession(context);

  const removeCommand = buildPushFileCleanupCommand(targetPath);
  await context.terminalPage.prepareForCommand();
  await context.terminalPage.sendCommand(removeCommand);
  await context.terminalPage.page.waitForTimeout(500);
  const removeOutput = await context.terminalPage.runCommandAndWaitForOutput('id', /uid=/i);

  const verifyCommand = buildPushFilePresenceProbeCommand(targetPath);
  const verifyOutput = await context.terminalPage.runCommandAndWaitForOutput(
    verifyCommand,
    /__E2E_PUSHFILE_(?:STILL_EXISTS|ABSENT)__/i
  );
  const stillExists =
    verifyOutput.lastIndexOf('__E2E_PUSHFILE_STILL_EXISTS__') >
    verifyOutput.lastIndexOf('__E2E_PUSHFILE_ABSENT__');

  return {
    skipped: false,
    targetPath,
    cleaned: !stillExists,
    removeCommand,
    removeOutput,
    verifyCommand,
    verifyOutput,
    failureMessage: stillExists
      ? `Push File cleanup could not remove "${targetPath}" from the device.`
      : '',
  };
}

function createPushFileContext(page) {
  return {
    config,
    targetDeviceId,
    pushFileConfig,
    validDestinationPath,
    resourceSearchKeyword,
    resourceExactName,
    invalidDestinationPath,
    noResultSearchKeyword,
    terminalVerifyFileName,
    terminalVerifyPath,
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

async function openPushFileModal(context) {
  await openOnlineDeviceDetail(context);
  await context.deviceDetailPage.clickPushFile();
  await context.deviceDetailPage.waitForPushFileModalVisible();
}

async function openActivityTabReady(context) {
  await context.deviceDetailPage.openActivityTab();
  await context.deviceDetailPage.waitForPageReady();
  await context.deviceDetailPage.verifyDeviceIsOnline();
  await context.deviceDetailPage.waitForActivityLogsReady();
}

async function selectConfiguredPushFileResource(context) {
  if (resourceSearchKeyword) {
    await context.deviceDetailPage.searchPushFileResource(resourceSearchKeyword);
  } else {
    await context.deviceDetailPage.waitForPushFileResourcesReady();
  }

  if (resourceExactName) {
    return context.deviceDetailPage.selectPushFileResourceByName(resourceExactName);
  }

  return context.deviceDetailPage.selectFirstPushFileResource();
}

module.exports = {
  test,
  expect,
  createPushFileContext,
  openOnlineDeviceDetail,
  openPushFileModal,
  openActivityTabReady,
  selectConfiguredPushFileResource,
  validDestinationPath,
  resourceSearchKeyword,
  resourceExactName,
  invalidDestinationPath,
  noResultSearchKeyword,
  terminalVerifyFileName,
  terminalVerifyPath,
  terminalVerifyCommand,
  terminalVerifyExpectedPattern,
  resolvePushFileTerminalTargetPath,
  cleanupPushFileTarget,
  setActualResult,
  setTestCaseMetadata,
};
