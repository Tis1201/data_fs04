module.exports = {
    apiBaseURL: 'https://app-dev-v2.datarealities.com/auth/login',
    baseURL: 'https://app-dev-v2.datarealities.com/auth/login',
    username: '',
    password: '',

  timeouts: {
    pageLoadMs: 30000,
    snapshotImageMs: 90000,
    activityLogMs: 90000,
    installFinalStatusMs: 180000,
    terminalReadyMs: 90000,
    terminalCommandMs: 60000,
    controlReadyMs: 45000,
    rebootFinalStatusMs: 300000,
  },

  pageURL: {
    devices: {
      url: 'https://app-dev-v2.datarealities.com/user/iot/devices',
      listUrl: 'https://app-dev-v2.datarealities.com/user/iot/devices',
      detailPath: '/user/iot/devices',

      // Online devices (from Devices list)
      // - Auto test - 24:1C:04:26:88:E7 - DN74 (cmo0yzd4z00c014b2fn8k4o7n)
      // - Auto test - 8C:FC:A0:31:59:34 - 3576M (cmo2cimuo012114b2csz0wxxm)
      // - Auto test - 8C:FC:A0:31:59:5F - 3576M-2 (cmo6pi0i00eeqjch8wr6po2v5)
      // Offline device: Auto test - 22:16:C6:7B:2D:82 - DN76 (cmm053wd7003bvdijqu4fbcej)
      // Primary device used by most device-action tests.
      onlineDeviceId: 'cmo2cimuo012114b2csz0wxxm',
      secondaryOnlineDeviceId: 'cmo0yzd4z00c014b2fn8k4o7n',
      tertiaryOnlineDeviceId: 'cmo6pi0i00eeqjch8wr6po2v5',
      offlineDeviceId: 'cmm053wd7003bvdijqu4fbcej',
      scheduleTestDeviceId: 'cmo0yzd4z00c014b2fn8k4o7n',
      ethernetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
      wifiDeviceId: 'cmo2cimuo012114b2csz0wxxm',
      invalidDeviceId: 'invalid-device-id-999',
      snapshotTargetDeviceId: 'cmo2cimuo012114b2csz0wxxm',

      snapshot: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        terminalVerifyCommand: 'id',
        terminalVerifyExpectedPattern: 'uid=',
      },

      installApp: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        resourceSearchKeyword: 'counter',
        resourceExactName: 'counter_now',
        packageName: 'com.example.counter_now',
        verifyCommand: 'pm path com.example.counter_now',
        noResultSearchKeyword: 'zzzz_no_app_12345',
        offlineTargetDeviceId: 'cmo2e0ih2016714b2cvo4567z',
        auditOutputDir: 'test-results/install-app-audit',
        protectedPackageNames: [
          'com.android.internal.systemui.navbar.threebutton',
          'com.android.egg',
          'com.android.inputmethod.latin',
          'android.ext.services',
          'android.ext.shared',
        ],
        protectedPackagePrefixes: ['com.android.', 'android.'],
        finalStatusTimeoutMs: 180000,
        uninstallFinalStatusTimeoutMs: 180000,
        /** Optional: exact catalog names for version-matrix E2E (TC-DA-E2E-013~015) when implemented */
        e2eOlderResourceExactName: '',
        e2eNewerResourceExactName: '',
        e2eEqualResourceExactName: '',
      },

      control: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        // Use an offline device to validate disconnected UI.
        failureTargetDeviceId: 'cmm053wd7003bvdijqu4fbcej',
        terminalVerifyCommand: 'id',
        terminalVerifyExpectedPattern: 'uid=',
      },

      terminal: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        smokeCommand: 'id',
        smokeExpectedPattern: 'uid=',
        invalidCommand: 'definitely_not_a_real_command_e2e_12345',
        invalidExpectedPattern: 'not found|inaccessible|unknown command|No such file|permission denied',
        recoveryCommand: 'id',
        recoveryExpectedPattern: 'uid=',
      },

      pushFile: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        resourceSearchKeyword: 'remote',
        resourceExactName: 'Remote Device Manager 1.6.2_dev',
        validDestinationPath: '/sdcard/Download/',
        invalidDestinationPath: '/system/',
        noResultSearchKeyword: 'zzzz_no_file_12345',
        terminalVerifyFileName: '',
        terminalVerifyPath: '/sdcard/Download/Remote Device Manager 1.6.2_dev',
        terminalVerifyCommand: '',
        terminalVerifyExpectedPattern: '__E2E_EXISTS__',
      },

      pullFile: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        // Make sure this file exists on the device: echo "test" > /sdcard/Download/test.txt
        validSourceFilePath: '/sdcard/Download/test.txt',
        invalidSourceFilePath: '/sdcard/Download/file_not_exists_12345.txt',
        terminalVerifyCommand: '',
        terminalVerifyExpectedPattern: '__E2E_EXISTS__',
      },

      reboot: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        finalStatusTimeoutMs: 300000,
        successToastText: 'Reboot command sent to device',
        terminalVerifyCommand: 'id',
        terminalVerifyExpectedPattern: 'uid=',
      },
    },
    bulkDeployments: {
      digitalSignageAppName: 'Digital Signage',
      counterNowAppName: 'counter_now',
      onlineDeviceSearch: '3576M',
      offlineDeviceSearch: 'DN76',
      failedDeploymentId: '',
    },

    appPinningRules: {
      /** TC-PIN-E2E-017: rule applies to targetDeviceId only; excluded device must not get pin */
      targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
      excludedDeviceId: 'cmo0yzd4z00c014b2fn8k4o7n',
    },

     deviceProfiles: {
            url: 'https://app-dev-v2.datarealities.com/user/iot/device-profiles',
            profileWithDevicesId: 'cmmx6a4wx005m101ijldfeoww',
            profileWithDevicesName: 'DN74-profile',
            profileWithoutDevicesId: 'cmmnr86oc002r100okcqr3y0n',
            profileWithoutDevicesName: 'Dn74config',
            profileWithDescriptionId: 'cmmkpp7ms000313ydcuvcfwdf',
            profileWithDescriptionName: 'd',
            invalidProfileId: 'nonexistent-profile-999',
      },
  },
};
