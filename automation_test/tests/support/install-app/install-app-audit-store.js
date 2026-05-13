const fs = require('fs');
const path = require('path');

class InstallAppAuditStore {
  constructor(options = {}) {
    const rootDir =
      options.rootDir || path.resolve(process.cwd(), 'test-results', 'install-app-audit');
    const deviceId = options.deviceId || 'unknown-device';

    this.rootDir = rootDir;
    this.deviceId = deviceId;
    this.deviceDir = path.join(rootDir, this.sanitizeSegment(deviceId));

    fs.mkdirSync(this.deviceDir, { recursive: true });
  }

  sanitizeSegment(value = '') {
    return (
      String(value)
        .replace(/[<>:"/\\|?*\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'unknown'
    );
  }

  getFilePath(fileName) {
    return path.join(this.deviceDir, fileName);
  }

  readJson(fileName, fallback = []) {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

  writeJson(fileName, data) {
    const filePath = this.getFilePath(fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  upsertRecords(fileName, records, keyBuilder) {
    const existing = this.readJson(fileName, []);
    const map = new Map(existing.map((record) => [keyBuilder(record), record]));

    for (const record of records) {
      map.set(keyBuilder(record), record);
    }

    const merged = Array.from(map.values());
    this.writeJson(fileName, merged);
    return merged;
  }

  buildAppKey(record = {}) {
    const packageName = record.packageName || record.name || 'unknown-package';
    const version = record.version || record.versionLabel || 'unknown-version';
    return `${packageName}@${version}`;
  }

  saveCollectedApps(records) {
    return this.writeJson('collected-apps.json', records);
  }

  saveSkippedApps(records) {
    return this.upsertRecords('skipped-apps.json', records, (record) => this.buildAppKey(record));
  }

  saveSuccessfulInstalls(records) {
    return this.upsertRecords('successful-installs.json', records, (record) =>
      this.buildAppKey(record)
    );
  }

  saveFailedInstalls(records) {
    return this.upsertRecords('failed-installs.json', records, (record) =>
      this.buildAppKey(record)
    );
  }

  saveSuccessfulUninstalls(records) {
    return this.upsertRecords('successful-uninstalls.json', records, (record) =>
      this.buildAppKey(record)
    );
  }

  readCollectedApps() {
    return this.readJson('collected-apps.json', []);
  }

  readSkippedApps() {
    return this.readJson('skipped-apps.json', []);
  }

  readSuccessfulInstalls() {
    return this.readJson('successful-installs.json', []);
  }

  readFailedInstalls() {
    return this.readJson('failed-installs.json', []);
  }

  readSuccessfulUninstalls() {
    return this.readJson('successful-uninstalls.json', []);
  }
}

module.exports = InstallAppAuditStore;
