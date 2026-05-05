const path = require('path');
const config = require('../../config/config-loader');

(function validateResourcesConfig() {
    const rs = config.pageURL?.resources;
    if (!rs) throw new Error('Missing resources config in config-loader.');
    for (const key of ['url', 'applicationResourceId', 'applicationResourceName', 'archiveResourceId', 'archiveResourceName']) {
        if (!rs[key]) throw new Error(`Missing required config: resources.${key}`);
    }
})();

const _rsCfg = config.pageURL.resources;
const RESOURCE_URL = _rsCfg.url;
const APPLICATION_RESOURCE_ID = _rsCfg.applicationResourceId;
const APPLICATION_RESOURCE_NAME = _rsCfg.applicationResourceName;
const ARCHIVE_RESOURCE_ID = _rsCfg.archiveResourceId;
const ARCHIVE_RESOURCE_NAME = _rsCfg.archiveResourceName;
const INVALID_RESOURCE_ID = _rsCfg.invalidResourceId || 'nonexistent-id-999';
const ACCOUNT_NAME = _rsCfg.accountName || 'Dang account';
const RESOURCE_FILE = path.isAbsolute(_rsCfg.file || '')
    ? _rsCfg.file
    : path.join(__dirname, '..', '..', _rsCfg.file || 'static/resourceA.zip');
const APK_RESOURCE_FILE = _rsCfg.apkFile
    ? (path.isAbsolute(_rsCfg.apkFile)
        ? _rsCfg.apkFile
        : path.join(__dirname, '..', '..', _rsCfg.apkFile))
    : '';
const APK_RESOURCE_FILE_HIGHER = _rsCfg.apkFileHigher
    ? (path.isAbsolute(_rsCfg.apkFileHigher)
        ? _rsCfg.apkFileHigher
        : path.join(__dirname, '..', '..', _rsCfg.apkFileHigher))
    : '';
const IN_USE_RESOURCE_ID = _rsCfg.inUseResourceId || '';
const IN_USE_RESOURCE_NAME = _rsCfg.inUseResourceName || '';

const authFile = path.join(__dirname, '..', '..', 'user.json');

function generateTestResourceNameWithSuffix(prefix = 'AutoTest_RDM', suffix = '') {
    const ts = Date.now();
    return suffix ? `${prefix}_${suffix}_${ts}` : `${prefix}_${ts}`;
}

module.exports = {
    authFile,
    RESOURCE_URL,
    APPLICATION_RESOURCE_ID,
    APPLICATION_RESOURCE_NAME,
    ARCHIVE_RESOURCE_ID,
    ARCHIVE_RESOURCE_NAME,
    INVALID_RESOURCE_ID,
    ACCOUNT_NAME,
    RESOURCE_FILE,
    APK_RESOURCE_FILE,
    APK_RESOURCE_FILE_HIGHER,
    IN_USE_RESOURCE_ID,
    IN_USE_RESOURCE_NAME,
    generateTestResourceNameWithSuffix,
};
