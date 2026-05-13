const { expect } = require('@playwright/test');
const { DEVICE_DETAIL } = require('../../../constants/device-detail.constants');

const deviceDetailActivityLogs = {
  async safeText(locator) {
    const count = await locator.count().catch(() => 0);
    if (count === 0) return '';
    return this.normalizeActivityLogText(
      (await locator.first().textContent().catch(() => '')) || ''
    );
  },

  async extractActivityLogRowData(index, { includeDetails = true } = {}) {
    const row = this.activityLogRows.nth(index);
    const eventName = await this.safeText(row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_EVENT));
    const descriptionText = await this.safeText(
      row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_DESCRIPTION)
    );
    const rowText = this.normalizeActivityLogText(
      (await row.textContent().catch(() => '')) || ''
    );
    const rawStatusText = await this.safeText(
      row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_STATUS)
    );
    const buttonStatusText = this.normalizeActivityLogText(
      (await row.getByRole('button').last().textContent().catch(() => '')) || ''
    );

    let detailsText = '';
    if (includeDetails) {
      const expanded = await this.expandActivityLogRow(index);
      if (expanded) {
        detailsText = this.normalizeActivityLogText(
          (await this.getActivityLogDetailsRow(index).textContent().catch(() => '')) || ''
        );
      }
    }

    const statusText =
      [rawStatusText, buttonStatusText, detailsText, rowText].find((value) =>
        this.getActivityLogStatusPattern().test(value || '')
      ) ||
      rawStatusText ||
      buttonStatusText ||
      rowText;

    const combinedText = this.normalizeActivityLogText(
      [eventName, descriptionText, detailsText, rowText].filter(Boolean).join(' ')
    );

    return { eventName, descriptionText, statusText, detailsText, rowText, combinedText };
  },
  async getActivityLogRowSignature(index) {
    const rowData = await this.extractActivityLogRowData(index, { includeDetails: false });
    return rowData.rowText;
  },

  async getActivityLogSignatures(maxRows = this.maxActivityLogRows) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);
    const signatures = [];
    for (let i = 0; i < rowCount; i++) {
      signatures.push(await this.getActivityLogRowSignature(i));
    }
    return signatures;
  },

  buildSignatureCountMap(signatures = []) {
    const map = new Map();
    for (const signature of signatures) {
      map.set(signature, (map.get(signature) || 0) + 1);
    }
    return map;
  },

  async getActivityLogSignatureCountMap(maxRows = this.maxActivityLogRows) {
    const signatures = await this.getActivityLogSignatures(maxRows);
    return this.buildSignatureCountMap(signatures);
  },

  getActivityLogDetailsRow(index) {
    return this.activityLogRows
      .nth(index)
      .locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_DETAILS_ROW_XPATH);
  },

  async expandActivityLogRow(index) {
    const row = this.activityLogRows.nth(index);
    const expandButton = row.locator(DEVICE_DETAIL.SELECTORS.ACTIVITY_EXPAND_BUTTON);

    const isVisible = await expandButton.isVisible().catch(() => false);
    const isEnabled = await expandButton.isEnabled().catch(() => false);

    if (!isVisible || !isEnabled) return false;

    const detailsRow = this.getActivityLogDetailsRow(index);
    const detailsVisible = await detailsRow.isVisible().catch(() => false);
    if (detailsVisible) return true;

    try {
      await expandButton.click();
      await detailsRow.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },

  async findNewActivityLogByStatus({
    previousSignatures = [],
    statusPattern,
    isRelated,
    maxRows = this.maxActivityLogRows,
  }) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);
    const previousSignatureCountMap = this.buildSignatureCountMap(previousSignatures);
    const currentSeenCountMap = new Map();

    for (let i = 0; i < rowCount; i++) {
      const signature = await this.getActivityLogRowSignature(i);

      const currentSeenCount = (currentSeenCountMap.get(signature) || 0) + 1;
      currentSeenCountMap.set(signature, currentSeenCount);

      const previousSeenCount = previousSignatureCountMap.get(signature) || 0;
      if (currentSeenCount <= previousSeenCount) continue;

      const rowData = await this.extractActivityLogRowData(i);
      const matchesStatus =
        statusPattern.test(rowData.statusText) ||
        statusPattern.test(rowData.rowText) ||
        statusPattern.test(rowData.detailsText);
      const matchesBasic =
        isRelated(rowData.eventName) ||
        isRelated(rowData.descriptionText) ||
        isRelated(rowData.detailsText) ||
        isRelated(rowData.rowText) ||
        isRelated(rowData.combinedText);

      if (matchesBasic && matchesStatus) {
        return {
          index: i, signature,
          eventName: rowData.eventName, descriptionText: rowData.descriptionText,
          statusText: rowData.statusText, detailsText: rowData.detailsText,
          rowText: rowData.rowText, combinedText: rowData.combinedText,
        };
      }
    }
    return null;
  },

  async waitForNewActivityLogByStatus({
    previousSignatures = [],
    statusPattern,
    isRelated,
    maxRows = this.maxActivityLogRows,
    timeout = this.timeouts.activityLog,
    message,
  }) {
    let matchedLog = null;
    await expect.poll(
      async () => {
        await this.waitForActivityLogsReady();
        matchedLog = await this.findNewActivityLogByStatus({ previousSignatures, statusPattern, isRelated, maxRows });
        return matchedLog ? 'found' : 'not-found';
      },
      { timeout, message }
    ).toBe('found');
    return matchedLog;
  },

  async findLatestActivityLogByStatus({
    statusPattern,
    isRelated,
    maxRows = this.maxActivityLogRows,
  }) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);
    for (let index = 0; index < rowCount; index += 1) {
      const signature = await this.getActivityLogRowSignature(index);
      const rowData = await this.extractActivityLogRowData(index);
      const matchesStatus =
        statusPattern.test(rowData.statusText) ||
        statusPattern.test(rowData.rowText) ||
        statusPattern.test(rowData.detailsText);
      const matchesBasic =
        isRelated(rowData.eventName) ||
        isRelated(rowData.descriptionText) ||
        isRelated(rowData.detailsText) ||
        isRelated(rowData.rowText) ||
        isRelated(rowData.combinedText);

      if (matchesBasic && matchesStatus) {
        return {
          index, signature,
          eventName: rowData.eventName, descriptionText: rowData.descriptionText,
          statusText: rowData.statusText, detailsText: rowData.detailsText,
          rowText: rowData.rowText, combinedText: rowData.combinedText,
        };
      }
    }
    return null;
  },

  isSnapshotRelatedText(text = '') {
    return DEVICE_DETAIL.PATTERNS.SNAPSHOT_RELATED.some((pattern) => pattern.test(text));
  },
  isRebootRelatedText(text = '') {
    return (DEVICE_DETAIL?.PATTERNS?.REBOOT_RELATED || [/reboot/i, /reboot initiated/i])
      .some((pattern) => pattern.test(text));
  },
  isPushFileRelatedText(text = '') {
    return (DEVICE_DETAIL?.PATTERNS?.PUSH_FILE_RELATED || [/push file/i, /file push/i, /pushing/i])
      .some((pattern) => pattern.test(text));
  },
  isPullFileRelatedText(text = '') {
    return (
      DEVICE_DETAIL?.PATTERNS?.PULL_FILE_RELATED || [
        /pull file/i, /pulled file/i, /file pulled/i,
        /\bpull(?:ed|ing)?\b/i, /\bfile\b.*\bpull(?:ed|ing)?\b/i,
      ]
    ).some((pattern) => pattern.test(text));
  },
  isInstallRelatedText(text = '') {
    return [
      /install app/i, /install new app/i, /installation of/i,
      /installing /i, /\binstall(?:ation|ing|ed)?\b/i,
      /download failed/i, /succeeded/i,
    ].some((pattern) => pattern.test(text));
  },
  isControlRelatedText(text = '') {
    return DEVICE_DETAIL.PATTERNS.CONTROL_RELATED.some((pattern) => pattern.test(text));
  },
  isRefreshRelatedText(text = '') {
    return (
      DEVICE_DETAIL?.PATTERNS?.REFRESH_RELATED || [
        /refresh/i,
        /refreshed/i,
        /device info(?:rmation)?.*refresh/i,
        /reload/i,
      ]
    ).some((pattern) => pattern.test(text));
  },
  getInstallFinalStatusPattern() {
    return /success|failed|error/i;
  },
  getInstallInProgressStatusPattern() {
    return this.getInProgressStatusPattern();
  },

  // ── Generic log helpers ─────────────────────────────────────────────

  _resolveStatusPattern(statusType) {
    const map = {
      success: DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS,
      failed: this.getFailedStatusPattern(),
      inprogress: this.getInProgressStatusPattern(),
    };
    return (typeof statusType === 'string' ? map[statusType.toLowerCase()] : statusType) || statusType;
  },

  async findNewFeatureLog(featureName, isRelatedFn, previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewActivityLogByStatus({
      previousSignatures, statusPattern, maxRows,
      isRelated: (text) => isRelatedFn.call(this, text),
    });
  },

  async waitForNewFeatureLog(featureName, isRelatedFn, statusType, {
    previousSignatures = [],
    maxRows = this.maxActivityLogRows,
    timeout = this.timeouts.activityLog,
  } = {}) {
    const statusPattern = this._resolveStatusPattern(statusType);
    const label = typeof statusType === 'string' ? statusType : 'expected';
    return this.waitForNewActivityLogByStatus({
      previousSignatures, statusPattern, maxRows, timeout,
      isRelated: (text) => isRelatedFn.call(this, text),
      message: `Activity Log did not show a new ${featureName} entry with ${label} status.`,
    });
  },

  async waitForNewLogWithFallback({ previousSignatures = [], statusPattern, isRelated, maxRows = this.maxActivityLogRows, timeout, message }) {
    let matchedLog = null;
    const previousTopSignature = previousSignatures[0] || '';
    await expect.poll(
      async () => {
        await this.waitForActivityLogsReady();
        matchedLog = await this.findNewActivityLogByStatus({ previousSignatures, statusPattern, maxRows, isRelated });
        if (matchedLog) return 'found';
        const latest = await this.findLatestActivityLogByStatus({ statusPattern, maxRows, isRelated });
        if (latest?.signature && latest.signature !== previousTopSignature) {
          matchedLog = latest;
          return 'found';
        }
        return 'not-found';
      },
      { timeout: timeout || this.timeouts.activityLog, message }
    ).toBe('found');
    return matchedLog;
  },

  // ── Snapshot logs ───────────────────────────────────────────────────

  async findNewSnapshotSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.findNewFeatureLog('Snapshot', this.isSnapshotRelatedText, previousSignatures, DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS, maxRows);
  },
  async waitForNewSnapshotSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Snapshot', this.isSnapshotRelatedText, 'success', { previousSignatures, maxRows });
  },

  // ── Reboot logs ────────────────────────────────────────────────────

  async findNewRebootLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewFeatureLog('Reboot', this.isRebootRelatedText, previousSignatures, statusPattern, maxRows);
  },
  async waitForNewRebootLogByStatus(previousSignatures = [], statusPattern, message, timeout = this.timeouts.activityLog, maxRows = this.maxActivityLogRows) {
    return this.waitForNewActivityLogByStatus({
      previousSignatures, statusPattern, maxRows, timeout, message,
      isRelated: (text) => this.isRebootRelatedText(text),
    });
  },
  async waitForNewRebootInProgressLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Reboot', this.isRebootRelatedText, 'inprogress', { previousSignatures, maxRows });
  },
  async waitForNewRebootSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Reboot', this.isRebootRelatedText, 'success', { previousSignatures, maxRows, timeout: this.timeouts.rebootFinalStatus });
  },
  async waitForNewRebootFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Reboot', this.isRebootRelatedText, 'failed', { previousSignatures, maxRows, timeout: this.timeouts.rebootFinalStatus });
  },

  // ── Push File logs ─────────────────────────────────────────────────

  async findNewPushFileLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewFeatureLog('Push File', this.isPushFileRelatedText, previousSignatures, statusPattern, maxRows);
  },

  async findLatestPushFileLogByRowText(statusPattern, maxRows = this.maxActivityLogRows) {
    const rowCount = Math.min(await this.activityLogRows.count(), maxRows);
    for (let index = 0; index < rowCount; index += 1) {
      const rowData = await this.extractActivityLogRowData(index, { includeDetails: false });
      const normalizedRowText = this.normalizeActivityLogText(rowData.rowText);
      const matchesStatus =
        statusPattern.test(rowData.statusText) || statusPattern.test(normalizedRowText);
      const matchesPushRow =
        this.isPushFileRelatedText(normalizedRowText) ||
        /\bfile\b.*\bpushed\b/i.test(normalizedRowText) ||
        /pushed successfully to/i.test(normalizedRowText);

      if (matchesStatus && matchesPushRow) {
        return {
          index, signature: rowData.rowText,
          eventName: rowData.eventName, descriptionText: rowData.descriptionText,
          statusText: rowData.statusText, detailsText: rowData.detailsText,
          rowText: rowData.rowText, combinedText: rowData.combinedText,
        };
      }
    }
    return null;
  },

  async waitForNewPushFileLogByStatus(previousSignatures = [], statusPattern, message, maxRows = this.maxActivityLogRows) {
    const isRelated = (text) => this.isPushFileRelatedText(text);
    let matchedLog = null;
    const previousTopSignature = previousSignatures[0] || '';
    await expect.poll(
      async () => {
        await this.waitForActivityLogsReady();
        matchedLog = await this.findNewActivityLogByStatus({ previousSignatures, statusPattern, maxRows, isRelated });
        if (matchedLog) return 'found';
        const latest = await this.findLatestActivityLogByStatus({ statusPattern, maxRows, isRelated });
        if (latest?.signature && latest.signature !== previousTopSignature) { matchedLog = latest; return 'found'; }
        const rowMatch = await this.findLatestPushFileLogByRowText(statusPattern, maxRows);
        if (rowMatch?.signature && rowMatch.signature !== previousTopSignature) { matchedLog = rowMatch; return 'found'; }
        return 'not-found';
      },
      { timeout: this.timeouts.activityLog, message }
    ).toBe('found');
    return matchedLog;
  },
  async waitForNewPushFileSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPushFileLogByStatus(previousSignatures, DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS, 'Activity Log did not show a new Push File entry with Success status.', maxRows);
  },
  async waitForNewPushFileFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPushFileLogByStatus(previousSignatures, this.getFailedStatusPattern(), 'Activity Log did not show a new Push File entry with Failed status.', maxRows);
  },

  // ── Pull File logs ─────────────────────────────────────────────────

  async findNewPullFileLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewFeatureLog('Pull File', this.isPullFileRelatedText, previousSignatures, statusPattern, maxRows);
  },
  async waitForNewPullFileLogByStatus(previousSignatures = [], statusPattern, message, maxRows = this.maxActivityLogRows) {
    return this.waitForNewLogWithFallback({
      previousSignatures, statusPattern, maxRows, message,
      isRelated: (text) => this.isPullFileRelatedText(text),
    });
  },
  async waitForNewPullFileSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPullFileLogByStatus(previousSignatures, DEVICE_DETAIL.PATTERNS.SUCCESS_STATUS, 'Activity Log did not show a new Pull File entry with Success status.', maxRows);
  },
  async waitForNewPullFileFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewPullFileLogByStatus(previousSignatures, DEVICE_DETAIL.PATTERNS.FAILED_STATUS, 'Activity Log did not show a new Pull File entry with Failed status.', maxRows);
  },

  // ── Install App logs ───────────────────────────────────────────────

  async findNewInstallLogByStatus(previousSignatures = [], statusPattern, maxRows = this.maxActivityLogRows) {
    return this.findNewFeatureLog('Install App', this.isInstallRelatedText, previousSignatures, statusPattern, maxRows);
  },
  async waitForNewInstallLogByStatus(previousSignatures = [], statusPattern, message, timeout = this.timeouts.installFinalStatus, maxRows = this.maxActivityLogRows) {
    return this.waitForNewActivityLogByStatus({
      previousSignatures, statusPattern, maxRows, timeout, message,
      isRelated: (text) => this.isInstallRelatedText(text),
    });
  },
  async waitForNewInstallInProgressLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Install App', this.isInstallRelatedText, 'inprogress', { previousSignatures, maxRows });
  },
  async waitForNewInstallSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Install App', this.isInstallRelatedText, 'success', { previousSignatures, maxRows, timeout: this.timeouts.installFinalStatus });
  },
  async waitForNewInstallFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Install App', this.isInstallRelatedText, 'failed', { previousSignatures, maxRows, timeout: this.timeouts.installFinalStatus });
  },
  async waitForNewInstallFinalLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Install App', this.isInstallRelatedText, this.getInstallFinalStatusPattern(), { previousSignatures, maxRows, timeout: this.timeouts.installFinalStatus });
  },

  // ── Control logs ───────────────────────────────────────────────────

  async findNewControlLog(previousSignatures = [], { statusPattern = null, maxRows = this.maxActivityLogRows } = {}) {
    return this.findNewFeatureLog('Control', this.isControlRelatedText, previousSignatures, statusPattern || /.*/, maxRows);
  },
  async waitForNewControlSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Control', this.isControlRelatedText, 'success', { previousSignatures, maxRows });
  },
  async waitForNewControlFailedLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Control', this.isControlRelatedText, 'failed', { previousSignatures, maxRows });
  },

  // ── Refresh device info logs ───────────────────────────────────────

  async waitForNewRefreshSuccessLog(previousSignatures = [], maxRows = this.maxActivityLogRows) {
    return this.waitForNewFeatureLog('Refresh', this.isRefreshRelatedText, 'success', {
      previousSignatures,
      maxRows,
    });
  },
};

module.exports = deviceDetailActivityLogs;
