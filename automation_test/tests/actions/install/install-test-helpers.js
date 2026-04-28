const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../../config/config-loader');
const DeviceDetailPage = require('../../../pages/devices/device-detail/device-detail-page');
const InstallAppModal = require('../../../pages/iot/install-app-modal');
const InstalledAppsPanel = require('../../../pages/iot/installed-apps-panel');
const DeviceTerminalPage = require('../../../pages/iot/device-terminal-page');
const {
  setActualResult,
  setTestCaseMetadata,
} = require('../../support/usecase-annotations');
const {
  openTerminalSession,
} = require('../shared/device-action-common');

const authFile = path.resolve(__dirname, '../../../user.json');

test.use({ storageState: authFile });

const installConfig = config.pageURL?.devices?.installApp || {};
const remoteCleanupPattern = /\bremote\b/i;

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegex(matcher) {
  if (matcher instanceof RegExp) {
    return matcher;
  }

  return new RegExp(escapeRegex(String(matcher)), 'i');
}

function buildRecordText(record = {}) {
  return `${record.name || ''} ${record.packageName || ''} ${record.resourceId || ''}`.trim();
}

function buildSignatureCountMap(signatures = []) {
  const map = new Map();

  for (const signature of signatures) {
    map.set(signature, (map.get(signature) || 0) + 1);
  }

  return map;
}

function looksLikePackageName(value = '') {
  return /^(?=.*[A-Za-z])[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(value.trim());
}

function normalizeConfiguredRecord(record = {}) {
  const normalized = { ...record };
  const configuredPackageName = installConfig.packageName || '';
  const configuredName = installConfig.resourceExactName || '';
  const rawRecordText = [record.rawText, record.name, record.packageName].filter(Boolean).join(' ');
  const likelyConfiguredRecord =
    (!!configuredPackageName && rawRecordText.includes(configuredPackageName)) ||
    (!!configuredName && rawRecordText.includes(configuredName));

  if (
    !looksLikePackageName(normalized.packageName) &&
    looksLikePackageName(configuredPackageName) &&
    likelyConfiguredRecord
  ) {
    normalized.packageName = configuredPackageName;
  }

  if (
    configuredName &&
    likelyConfiguredRecord &&
    (!normalized.name ||
      normalized.name === normalized.rawText ||
      normalized.name.includes(configuredPackageName) ||
      rawRecordText.includes(configuredName))
  ) {
    normalized.name = configuredName;
  }

  return normalized;
}

function isProtectedPackage(packageName = '') {
  if (!packageName) {
    return false;
  }

  const protectedNames = Array.isArray(installConfig.protectedPackageNames)
    ? installConfig.protectedPackageNames
    : [];
  const protectedPrefixes = Array.isArray(installConfig.protectedPackagePrefixes)
    ? installConfig.protectedPackagePrefixes
    : [];

  if (protectedNames.includes(packageName)) {
    return true;
  }

  return protectedPrefixes.some((prefix) => packageName.startsWith(prefix));
}

function isForbiddenCleanupRecord(record = {}) {
  const recordText = buildRecordText(record);
  return isProtectedPackage(record.packageName) || remoteCleanupPattern.test(recordText);
}

function assertManagedInstallCandidate(record = {}) {
  expect(
    record && (record.packageName || record.name),
    'Install App selection did not return a usable app record.'
  ).toBeTruthy();

  expect(
    record.alreadyOnDevice,
    `Configured install candidate "${record.packageName || record.name}" is already on the device. Choose a package that is not pre-installed so cleanup can restore the original state.`
  ).toBeFalsy();

  expect(
    isForbiddenCleanupRecord(record),
    `Configured install candidate "${record.packageName || record.name}" is blocked from managed cleanup because it matches a protected or remote app rule.`
  ).toBeFalsy();
}

function isManagedInstallCandidate(record = {}) {
  return Boolean(
    record &&
      (record.packageName || record.name) &&
      !record.alreadyOnDevice &&
      !isForbiddenCleanupRecord(record)
  );
}

function createInstallContext(page) {
  const targetDeviceId = installConfig.targetDeviceId;

  return {
    config,
    installConfig,
    deviceDetailPage: new DeviceDetailPage(page, {
      appUrl: config.appURL,
      devicePath: config.pageURL?.devices?.detailPath,
      deviceId: targetDeviceId,
      timeouts: {
        pageLoad: config.timeouts?.pageLoadMs,
        activityLog: config.timeouts?.activityLogMs,
        installFinalStatus: installConfig.finalStatusTimeoutMs,
      },
      maxActivityLogRows: 50,
    }),
    installModal: new InstallAppModal(page, {
      timeout: config.timeouts?.pageLoadMs,
      searchDelayMs: 800,
    }),
    installedAppsPanel: new InstalledAppsPanel(page, {
      timeout: config.timeouts?.pageLoadMs,
      searchDelayMs: 800,
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

async function openInstallModal(context) {
  await openOnlineDeviceDetail(context);
  await context.deviceDetailPage.clickInstallApp();
  await context.installModal.waitForVisible();
}

async function openActivityTabReady(context) {
  await context.deviceDetailPage.openActivityTab();
  await context.deviceDetailPage.waitForPageReady();
  await context.deviceDetailPage.verifyDeviceIsOnline();
  await context.deviceDetailPage.waitForActivityLogsReady();
}

async function selectConfiguredInstallApp(
  context,
  { blockedPackageNames = new Set() } = {}
) {
  const preferredRecords = [
    {
      name: installConfig.resourceExactName,
      packageName: installConfig.packageName,
    },
    {
      packageName: installConfig.packageName,
    },
    {
      name: installConfig.resourceExactName,
    },
  ].filter((record) => record.name || record.packageName);

  const searchTerms = [
    installConfig.packageName,
    installConfig.resourceExactName,
    installConfig.resourceSearchKeyword,
  ].filter(Boolean);

  for (const searchTerm of searchTerms) {
    await context.installModal.search(searchTerm);

    for (const preferredRecord of preferredRecords) {
      try {
        const selectedRecord = normalizeConfiguredRecord(
          await context.installModal.selectAppByRecord(preferredRecord)
        );
        if (
          isManagedInstallCandidate(selectedRecord) &&
          !blockedPackageNames.has(selectedRecord.packageName)
        ) {
          assertManagedInstallCandidate(selectedRecord);
          return selectedRecord;
        }
      } catch {
        // Try the next candidate against the current search result.
      }
    }
  }

  await context.installModal.clearSearch().catch(() => {});
  const allRecords = await context.installModal.collectAllUniqueAppRecords();
  const fallbackRecord = allRecords.find(
    (record) =>
      isManagedInstallCandidate(record) && !blockedPackageNames.has(record.packageName)
  );

  expect(
    fallbackRecord,
    `No managed install candidate is available in Install App modal. Configure a non-installed, non-protected app or ensure the resource list contains at least one removable candidate.`
  ).toBeTruthy();

  const fallbackSearchKeyword = looksLikePackageName(fallbackRecord.packageName)
    ? fallbackRecord.packageName
    : fallbackRecord.name || fallbackRecord.packageName || '';

  await context.installModal.search(fallbackSearchKeyword);
  const fallbackSelectionResult =
    looksLikePackageName(fallbackRecord.packageName)
      ? await context.installModal.selectAppByRecord(fallbackRecord)
      : await context.installModal.selectAppByName(fallbackSearchKeyword);
  const selectedFallbackRecord = normalizeConfiguredRecord(
    {
      ...fallbackSelectionResult,
      name: fallbackRecord.name || fallbackSelectionResult.name,
      packageName: looksLikePackageName(fallbackRecord.packageName)
        ? fallbackRecord.packageName
        : fallbackSelectionResult.packageName,
      resourceId: fallbackRecord.resourceId || fallbackSelectionResult.resourceId,
    }
  );
  assertManagedInstallCandidate(selectedFallbackRecord);
  return selectedFallbackRecord;
}

async function extractActivityRowDetails(deviceDetailPage, index) {
  const row = deviceDetailPage.activityLogRows.nth(index);
  const eventName = await deviceDetailPage.safeText(row.locator('.activity-col-event'));
  const descriptionText = await deviceDetailPage.safeText(
    row.locator('.activity-col-description')
  );
  const rowText = ((await row.textContent().catch(() => '')) || '').trim();
  const rawStatusText = await deviceDetailPage.safeText(row.locator('.activity-col-status'));
  const buttonStatusText = ((await row.getByRole('button').last().textContent().catch(() => '')) || '')
    .trim();
  const statusText =
    [rawStatusText, buttonStatusText, rowText].find((value) =>
      /success|failed|error|progress|pending|cancel/i.test(value || '')
    ) || rawStatusText || buttonStatusText || rowText;

  let detailsText = '';
  const expanded = await deviceDetailPage.expandActivityLogRow(index);
  if (expanded) {
    detailsText = (
      (await deviceDetailPage.getActivityLogDetailsRow(index).textContent().catch(() => '')) || ''
    ).trim();
  }

  const combinedText = [eventName, descriptionText, detailsText, rowText]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    eventName,
    descriptionText,
    statusText,
    detailsText,
    rowText,
    combinedText,
  };
}

async function getActivityRowSignature(deviceDetailPage, index) {
  const row = deviceDetailPage.activityLogRows.nth(index);
  return ((await row.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
}

async function getActivityLogSignatures(deviceDetailPage, maxRows = deviceDetailPage.maxActivityLogRows) {
  const rowCount = Math.min(await deviceDetailPage.activityLogRows.count(), maxRows);
  const signatures = [];

  for (let index = 0; index < rowCount; index++) {
    signatures.push(await getActivityRowSignature(deviceDetailPage, index));
  }

  return signatures;
}

function matchesPatternGroup(text, patterns = []) {
  return patterns.every((pattern) => toRegex(pattern).test(text));
}

async function findNewActivityLogStrict(
  deviceDetailPage,
  {
    previousSignatures = [],
    statusPattern,
    requiredAllPatterns = [],
    requiredAnyPatternGroups = [],
    forbiddenPatterns = [],
    maxRows = deviceDetailPage.maxActivityLogRows,
  }
) {
  const rowCount = Math.min(await deviceDetailPage.activityLogRows.count(), maxRows);
  const previousSignatureCountMap = buildSignatureCountMap(previousSignatures);
  const currentSeenCountMap = new Map();

  for (let index = 0; index < rowCount; index++) {
    const signature = await getActivityRowSignature(deviceDetailPage, index);
    const currentSeenCount = (currentSeenCountMap.get(signature) || 0) + 1;
    currentSeenCountMap.set(signature, currentSeenCount);

    const previousSeenCount = previousSignatureCountMap.get(signature) || 0;
    if (currentSeenCount <= previousSeenCount) {
      continue;
    }

    const rowDetails = await extractActivityRowDetails(deviceDetailPage, index);
    const statusMatches = toRegex(statusPattern).test(rowDetails.statusText);
    const requiredAllMatch = matchesPatternGroup(
      rowDetails.combinedText,
      requiredAllPatterns
    );
    const requiredAnyMatch =
      !requiredAnyPatternGroups.length ||
      requiredAnyPatternGroups.some((group) =>
        matchesPatternGroup(rowDetails.combinedText, group)
      );
    const hasForbiddenMatch = forbiddenPatterns.some((pattern) =>
      toRegex(pattern).test(rowDetails.combinedText)
    );

    if (statusMatches && requiredAllMatch && requiredAnyMatch && !hasForbiddenMatch) {
      return {
        index,
        signature,
        ...rowDetails,
      };
    }
  }

  return null;
}

async function waitForNewActivityLogStrict(
  deviceDetailPage,
  {
    previousSignatures = [],
    statusPattern,
    requiredAllPatterns = [],
    requiredAnyPatternGroups = [],
    forbiddenPatterns = [],
    timeout = deviceDetailPage.timeouts?.activityLog || 90000,
    message,
    maxRows = deviceDetailPage.maxActivityLogRows,
  }
) {
  let matchedLog = null;

  await expect.poll(
    async () => {
      await deviceDetailPage.waitForActivityLogsReady();
      matchedLog = await findNewActivityLogStrict(deviceDetailPage, {
        previousSignatures,
        statusPattern,
        requiredAllPatterns,
        requiredAnyPatternGroups,
        forbiddenPatterns,
        maxRows,
      });
      return matchedLog ? 'found' : 'not-found';
    },
    {
      timeout,
      message,
    }
  ).toBe('found');

  return matchedLog;
}

function buildInstallLogGroups(record = {}) {
  const groups = [];

  if (looksLikePackageName(record.packageName)) {
    groups.push([/install/i, record.packageName]);
  }

  if (record.name) {
    groups.push([/install/i, record.name]);
  }

  if (record.resourceId) {
    groups.push([/install/i, record.resourceId]);
  }

  return groups.length ? groups : [[/install/i]];
}

function buildUninstallLogGroups(record = {}) {
  const groups = [];

  if (looksLikePackageName(record.packageName)) {
    groups.push([/uninstall|remove/i, record.packageName]);
  }

  if (record.name) {
    groups.push([/uninstall|remove/i, record.name]);
  }

  return groups.length ? groups : [[/uninstall|remove/i]];
}

function buildPackageRemovalCommands(packageName = '') {
  if (!packageName) {
    return [];
  }

  return [
    `pm uninstall ${packageName}`,
    `pm uninstall --user 0 ${packageName}`,
    `cmd package uninstall ${packageName}`,
  ];
}

async function isPackageVisibleOnFreshInstalledAppsPage(context, packageName) {
  await openOnlineDeviceDetail(context);
  await context.installedAppsPanel.open();
  return context.installedAppsPanel.isPackageVisible(packageName);
}

async function waitForPackageAbsentInInstalledApps(
  context,
  packageName,
  timeout = installConfig.uninstallFinalStatusTimeoutMs || 90000
) {
  let latestVisible = null;

  await expect.poll(
    async () => {
      const visible = await isPackageVisibleOnFreshInstalledAppsPage(
        context,
        packageName
      ).catch(() => null);

      if (typeof visible !== 'boolean') {
        return 'retry';
      }

      latestVisible = visible;
      return latestVisible ? 'present' : 'absent';
    },
    {
      timeout,
      message: `Installed Apps should not contain package "${packageName}" after cleanup.`,
    }
  ).toBe('absent');

  return {
    packageVisible: latestVisible,
    terminalInstalled: null,
    terminalCommand: '',
    terminalOutput: '',
  };
}

async function uninstallPackageViaUi(context, packageName) {
  await openActivityTabReady(context);
  const previousSignatures = await getActivityLogSignatures(context.deviceDetailPage);
  await context.installedAppsPanel.open();

  const visible = await context.installedAppsPanel.isPackageVisible(packageName);
  if (!visible) {
    return {
      attempted: false,
      reason: 'already_absent_in_ui',
    };
  }

  await context.installedAppsPanel.uninstallPackage(packageName);
  await context.installedAppsPanel.confirmUninstall();

  let uninstallLog = null;
  try {
    await openActivityTabReady(context);
    uninstallLog = await waitForNewActivityLogStrict(context.deviceDetailPage, {
      previousSignatures,
      statusPattern: /success|failed|error/i,
      requiredAnyPatternGroups: buildUninstallLogGroups({ packageName }),
      timeout:
        installConfig.uninstallFinalStatusTimeoutMs ||
        context.deviceDetailPage.timeouts?.activityLog ||
        90000,
      message: `Activity Logs did not show a new uninstall entry for "${packageName}".`,
    });
  } catch (error) {
    uninstallLog = {
      statusText: '',
      rowText: '',
      detailsText: error?.message || String(error),
    };
  }

  return {
    attempted: true,
    reason: 'ui_uninstall_submitted',
    uninstallLog,
    success: /success/i.test(uninstallLog?.statusText || ''),
  };
}

async function uninstallPackageViaApi(context, packageName) {
  await openActivityTabReady(context);
  const previousSignatures = await getActivityLogSignatures(context.deviceDetailPage);

  const response = await context.deviceDetailPage.page.evaluate(
    async ({ deviceId, uninstallPackageName }) => {
      const res = await fetch(`/api/devices/${deviceId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'uninstall',
          packageName: uninstallPackageName,
        }),
      });

      const body = await res.json().catch(() => null);
      return {
        ok: res.ok,
        status: res.status,
        body,
      };
    },
    {
      deviceId: context.installConfig.targetDeviceId,
      uninstallPackageName: packageName,
    }
  );

  if (!response?.ok || !response?.body?.success) {
    return {
      attempted: false,
      reason: 'api_uninstall_failed',
      response,
      success: false,
    };
  }

  let uninstallLog = null;
  try {
    uninstallLog = await waitForNewActivityLogStrict(context.deviceDetailPage, {
      previousSignatures,
      statusPattern: /success|failed|error/i,
      requiredAnyPatternGroups: buildUninstallLogGroups({ packageName }),
      timeout:
        installConfig.uninstallFinalStatusTimeoutMs ||
        context.deviceDetailPage.timeouts?.activityLog ||
        90000,
      message: `Activity Logs did not show a new API-triggered uninstall entry for "${packageName}".`,
    });
  } catch (error) {
    uninstallLog = {
      statusText: '',
      rowText: '',
      detailsText: error?.message || String(error),
    };
  }

  return {
    attempted: true,
    reason: 'api_uninstall_submitted',
    response,
    uninstallLog,
    success: /success/i.test(uninstallLog?.statusText || ''),
  };
}

async function uninstallPackageViaTerminal(context, packageName) {
  const commands = buildPackageRemovalCommands(packageName);
  const expectedPattern = /success|failure|error|unknown|not found|delete failed/i;
  let lastResult = {
    attempted: false,
    command: '',
    output: '',
  };

  if (!commands.length) {
    return lastResult;
  }

  await openOnlineDeviceDetail(context);
  await openTerminalSession(context);

  for (const command of commands) {
    lastResult = {
      attempted: true,
      command,
      output: '',
    };

    try {
      lastResult.output = await context.terminalPage.runCommandAndWaitForOutput(
        command,
        expectedPattern
      );

      if (/success/i.test(lastResult.output)) {
        return {
          ...lastResult,
          success: true,
        };
      }
    } catch (error) {
      lastResult.output = error?.message || String(error);
    }
  }

  return {
    ...lastResult,
    success: false,
  };
}

async function ensurePackageAbsent(context, packageName) {
  const timeout = installConfig.uninstallFinalStatusTimeoutMs || 180000;
  const result = {
    packageName,
    cleaned: false,
    reason: 'unknown',
    uiAttempt: null,
    apiAttempt: null,
    finalState: null,
  };

  const initiallyVisible = await isPackageVisibleOnFreshInstalledAppsPage(
    context,
    packageName
  ).catch(() => null);

  if (initiallyVisible === false) {
    result.reason = 'already_absent';
    result.finalState = {
      packageVisible: false,
      terminalInstalled: null,
      terminalCommand: '',
      terminalOutput: '',
    };
    return result;
  }

  try {
    result.uiAttempt = await uninstallPackageViaUi(context, packageName);
  } catch (error) {
    result.uiAttempt = {
      attempted: false,
      reason: 'ui_uninstall_failed',
      error: error?.message || String(error),
    };
  }

  if (result.uiAttempt?.attempted) {
    try {
      result.finalState = await waitForPackageAbsentInInstalledApps(
        context,
        packageName,
        Math.min(timeout, 45000)
      );
      result.cleaned = true;
      result.reason = 'removed_via_ui';
      return result;
    } catch (error) {
      result.uiWaitError = error?.message || String(error);
    }
  }

  try {
    result.apiAttempt = await uninstallPackageViaApi(context, packageName);
  } catch (error) {
    result.apiAttempt = {
      attempted: false,
      reason: 'api_uninstall_failed',
      error: error?.message || String(error),
      success: false,
    };
  }

  if (result.apiAttempt?.attempted) {
    try {
      result.finalState = await waitForPackageAbsentInInstalledApps(
        context,
        packageName,
        Math.min(timeout, 90000)
      );
      result.cleaned = true;
      result.reason = 'removed_via_api_fallback';
      return result;
    } catch (error) {
      result.apiWaitError = error?.message || String(error);
    }
  }

  result.finalState = {
    packageVisible: await isPackageVisibleOnFreshInstalledAppsPage(
      context,
      packageName
    ).catch(() => null),
    terminalInstalled: null,
    terminalCommand: '',
    terminalOutput: '',
  };
  result.reason = 'cleanup_failed';
  throw new Error(
    `Unable to clean package "${packageName}" from the device. UI visible=${String(
      result.finalState.packageVisible
    )}, terminal installed=${String(result.finalState.terminalInstalled)}`
  );
}

async function installConfiguredApp(context) {
  const blockedPackageNames = new Set();
  if (installConfig.packageName) {
    blockedPackageNames.add(installConfig.packageName);
  }

  await openActivityTabReady(context);
  const previousSignatures = await getActivityLogSignatures(context.deviceDetailPage);

  await context.deviceDetailPage.clickInstallApp();
  await context.installModal.waitForVisible();
  const selectedRecord = await selectConfiguredInstallApp(context, {
    blockedPackageNames,
  });
  await context.installModal.confirm();

  const finalLog = await waitForNewActivityLogStrict(context.deviceDetailPage, {
    previousSignatures,
    statusPattern: /success|failed|error/i,
    requiredAnyPatternGroups: buildInstallLogGroups(selectedRecord),
    timeout:
      installConfig.finalStatusTimeoutMs ||
      context.deviceDetailPage.timeouts?.activityLog ||
      180000,
    message: `Activity Logs did not show a new install entry tied to "${selectedRecord.packageName || selectedRecord.name}".`,
  });

  return {
    selectedRecord,
    finalLog,
    installSucceeded: /success/i.test(finalLog.statusText),
  };
}

async function waitForInstalledAppVisible(context, record) {
  let matchedRecord = null;
  const packageSearchValue = looksLikePackageName(record.packageName)
    ? record.packageName
    : '';
  const nameSearchValue = record.name || '';

  await openOnlineDeviceDetail(context);
  await context.installedAppsPanel.open();

  await expect.poll(
    async () => {
      matchedRecord =
        (packageSearchValue
          ? await context.installedAppsPanel.findExactApp(packageSearchValue, record.version)
          : null) ||
        (packageSearchValue
          ? await context.installedAppsPanel.findAppByPackage(packageSearchValue)
          : null) ||
        (nameSearchValue
          ? await context.installedAppsPanel.findAppByName(nameSearchValue)
          : null);
      return matchedRecord ? 'found' : 'not-found';
    },
    {
      timeout: installConfig.finalStatusTimeoutMs || config.timeouts?.pageLoadMs || 30000,
      message: `Installed Apps did not show the installed app "${record.packageName || record.name}" after install.`,
    }
  ).toBe('found');

  return matchedRecord;
}

async function verifyInstalledAppInTerminal(context, record) {
  await openOnlineDeviceDetail(context);
  await context.deviceDetailPage.openTerminalFromDeviceDetail();
  await context.terminalPage.waitForTerminalPageReady();
  await context.terminalPage.waitForTerminalConnected();
  await context.terminalPage.waitForShellPrompt();

  const commands = [
    record.packageName === installConfig.packageName
      ? installConfig.verifyCommand || `pm path ${record.packageName}`
      : `pm path ${record.packageName}`,
    `cmd package path ${record.packageName}`,
  ].filter(Boolean);

  let output = '';
  let lastError = null;

  for (const command of commands) {
    try {
      output = await context.terminalPage.runCommandAndWaitForOutput(command, /package:/i);
      return output;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Terminal did not confirm package "${record.packageName}".`);

}

async function ensureConfiguredPackageAbsent(context) {
  const packageName = installConfig.packageName;
  if (!packageName) {
    return {
      cleaned: false,
      reason: 'missing_package_name',
    };
  }

  const result = await ensurePackageAbsent(context, packageName);

  return {
    ...result,
    reason:
      result.reason === 'already_absent'
        ? 'already_absent'
        : 'removed_before_test',
  };
}

async function cleanupInstalledApp(context, record) {
  if (!record || isForbiddenCleanupRecord(record)) {
    return {
      skipped: true,
      skipReason: 'protected_or_remote_app',
      record,
    };
  }

  const cleanupResult = await ensurePackageAbsent(context, record.packageName);

  return {
    skipped: false,
    uninstallSucceeded: cleanupResult.cleaned,
    uninstallLogMatched: false,
    uninstallLog: null,
    ...cleanupResult,
  };
}

async function attachJson(testInfo, name, data) {
  await testInfo.attach(name, {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  });
}

module.exports = {
  test,
  expect,
  config,
  installConfig,
  createInstallContext,
  openOnlineDeviceDetail,
  openInstallModal,
  openActivityTabReady,
  selectConfiguredInstallApp,
  waitForNewActivityLogStrict,
  installConfiguredApp,
  waitForInstalledAppVisible,
  verifyInstalledAppInTerminal,
  ensureConfiguredPackageAbsent,
  cleanupInstalledApp,
  isForbiddenCleanupRecord,
  attachJson,
  setActualResult,
  setTestCaseMetadata,
};
