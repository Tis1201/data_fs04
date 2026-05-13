const InstallAppAuditStore = require('./install-app-audit-store');
const { waitForNewActivityLogByStatusAndText } = require('./install-app-activity');

class InstallAppAuditService {
  constructor(options = {}) {
    this.deviceDetailPage = options.deviceDetailPage;
    this.installModal = options.installModal;
    this.installedAppsPanel = options.installedAppsPanel;
    this.installConfig = options.installConfig || {};
    this.auditStore =
      options.auditStore ||
      new InstallAppAuditStore({
        rootDir: this.installConfig.auditOutputDir,
        deviceId: this.installConfig.targetDeviceId,
      });
  }

  getProtectedPackageNames() {
    return Array.isArray(this.installConfig.protectedPackageNames)
      ? this.installConfig.protectedPackageNames
      : [];
  }

  getProtectedPackagePrefixes() {
    return Array.isArray(this.installConfig.protectedPackagePrefixes)
      ? this.installConfig.protectedPackagePrefixes
      : [];
  }

  isProtectedPackage(packageName = '') {
    if (!packageName) {
      return false;
    }

    if (this.getProtectedPackageNames().includes(packageName)) {
      return true;
    }

    return this.getProtectedPackagePrefixes().some((prefix) => packageName.startsWith(prefix));
  }

  buildRecordKey(record = {}) {
    const packageName = record.packageName || record.name || 'unknown-package';
    const version = record.version || record.versionLabel || 'unknown-version';
    return `${packageName}@${version}`;
  }

  async openOnlineDeviceDetail() {
    await this.deviceDetailPage.goto();
    await this.deviceDetailPage.waitForPageReady();
    await this.deviceDetailPage.verifyDeviceIsOnline();
  }

  async collectFullAppList() {
    await this.openOnlineDeviceDetail();
    await this.deviceDetailPage.clickInstallApp();
    const appRecords = await this.installModal.collectAllUniqueAppRecords();
    this.auditStore.saveCollectedApps(appRecords);
    await this.installModal.closeIfVisible();
    return appRecords;
  }

  async loadOrCollectFullAppList() {
    const existing = this.auditStore.readCollectedApps();
    if (existing.length) {
      return existing;
    }

    return this.collectFullAppList();
  }

  async classifyAppsAlreadyInstalled(appRecords) {
    const skippedRecords = [];

    await this.openOnlineDeviceDetail();
    await this.installedAppsPanel.open();

    for (const appRecord of appRecords) {
      let skipReason = '';
      let matchedInstalledRecord = null;

      if (appRecord.alreadyOnDevice) {
        skipReason = 'already_on_device_badge';
      } else {
        matchedInstalledRecord = await this.installedAppsPanel.findExactApp(
          appRecord.packageName,
          appRecord.version
        );

        if (matchedInstalledRecord) {
          skipReason = 'installed_same_package_version';
        }
      }

      if (!skipReason) {
        continue;
      }

      skippedRecords.push({
        ...appRecord,
        skipReason,
        installedMatch: matchedInstalledRecord || null,
      });
    }

    this.auditStore.saveSkippedApps(skippedRecords);
    return skippedRecords;
  }

  async loadOrClassifySkippedApps() {
    const existing = this.auditStore.readSkippedApps();
    if (existing.length) {
      return existing;
    }

    const fullList = await this.loadOrCollectFullAppList();
    return this.classifyAppsAlreadyInstalled(fullList);
  }

  async getInstallCandidates() {
    const fullList = await this.loadOrCollectFullAppList();
    const skippedRecords = await this.loadOrClassifySkippedApps();
    const skippedKeys = new Set(skippedRecords.map((record) => this.buildRecordKey(record)));

    return fullList.filter((record) => !skippedKeys.has(this.buildRecordKey(record)));
  }

  async installCandidate(candidate) {
    await this.deviceDetailPage.openActivityTab();
    await this.deviceDetailPage.waitForPageReady();
    await this.deviceDetailPage.verifyDeviceIsOnline();
    await this.deviceDetailPage.waitForActivityLogsReady();
    const previousSignatures = await this.deviceDetailPage.getActivityLogSignatures();

    await this.deviceDetailPage.clickInstallApp();
    await this.installModal.waitForVisible();
    await this.installModal.search(candidate.packageName || candidate.name);
    const selectedRecord = await this.installModal.selectAppByRecord(candidate);
    await this.installModal.confirm();

    let inProgressLog = null;
    try {
      inProgressLog = await this.deviceDetailPage.waitForNewInstallInProgressLog(
        previousSignatures
      );
    } catch {
      inProgressLog = null;
    }

    const finalLog = await this.deviceDetailPage.waitForNewInstallFinalLog(previousSignatures);
    const isSuccess = /success/i.test(finalLog.statusText);

    return {
      ...candidate,
      selectedRecord,
      inProgressLog,
      finalLog,
      installedAt: new Date().toISOString(),
      status: isSuccess ? 'success' : 'failed',
    };
  }

  async runInstallAudit() {
    const candidates = await this.getInstallCandidates();
    const successfulInstalls = this.auditStore.readSuccessfulInstalls();
    const failedInstalls = this.auditStore.readFailedInstalls();
    const processedKeys = new Set(
      [...successfulInstalls, ...failedInstalls].map((record) => this.buildRecordKey(record))
    );

    const newSuccesses = [];
    const newFailures = [];

    for (const candidate of candidates) {
      if (processedKeys.has(this.buildRecordKey(candidate))) {
        continue;
      }

      const result = await this.installCandidate(candidate);

      if (result.status === 'success') {
        newSuccesses.push(result);
      } else {
        newFailures.push(result);
      }
    }

    if (newSuccesses.length) {
      this.auditStore.saveSuccessfulInstalls(newSuccesses);
    }

    if (newFailures.length) {
      this.auditStore.saveFailedInstalls(newFailures);
    }

    return {
      candidates,
      successfulInstalls: this.auditStore.readSuccessfulInstalls(),
      failedInstalls: this.auditStore.readFailedInstalls(),
    };
  }

  async getSuccessfulInstallCandidate({ excludeProtected = false } = {}) {
    let successes = this.auditStore.readSuccessfulInstalls();
    if (!successes.length) {
      successes = (await this.runInstallAudit()).successfulInstalls;
    }

    if (excludeProtected) {
      return successes.find((record) => !this.isProtectedPackage(record.packageName)) || null;
    }

    return successes[0] || null;
  }

  async verifyInstalledAppPresent(record) {
    await this.openOnlineDeviceDetail();
    await this.installedAppsPanel.open();

    return this.installedAppsPanel.findExactApp(record.packageName, record.version);
  }

  async uninstallInstalledApp(record) {
    if (this.isProtectedPackage(record.packageName)) {
      return {
        skipped: true,
        skipReason: 'protected_package',
        record,
      };
    }

    await this.deviceDetailPage.openActivityTab();
    await this.deviceDetailPage.waitForPageReady();
    await this.deviceDetailPage.verifyDeviceIsOnline();
    await this.deviceDetailPage.waitForActivityLogsReady();
    const previousSignatures = await this.deviceDetailPage.getActivityLogSignatures();

    await this.installedAppsPanel.open();
    await this.installedAppsPanel.uninstallPackage(record.packageName);
    await this.installedAppsPanel.confirmUninstall();

    const finalLog = await waitForNewActivityLogByStatusAndText(this.deviceDetailPage, {
      previousSignatures,
      statusPattern: /success|failed|error/i,
      textMatchers: [/uninstall/i, record.packageName],
      timeout:
        this.installConfig.uninstallFinalStatusTimeoutMs ||
        this.deviceDetailPage.timeouts?.activityLog ||
        90000,
      message: `Activity Logs did not show a new uninstall entry for "${record.packageName}".`,
    });

    const result = {
      ...record,
      uninstallAt: new Date().toISOString(),
      uninstallStatus: /success/i.test(finalLog.statusText) ? 'success' : 'failed',
      uninstallLog: finalLog,
    };

    if (result.uninstallStatus === 'success') {
      this.auditStore.saveSuccessfulUninstalls([result]);
    }

    return result;
  }

  async getProtectedInstalledApps() {
    await this.openOnlineDeviceDetail();
    await this.installedAppsPanel.open();

    const candidates = [];

    for (const packageName of this.getProtectedPackageNames()) {
      const match = await this.installedAppsPanel.findAppByPackage(packageName);
      if (match) {
        candidates.push({
          ...match,
          skipReason: 'protected_package',
        });
      }
    }

    return candidates;
  }
}

module.exports = InstallAppAuditService;
