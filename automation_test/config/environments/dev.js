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
      listUrl: 'https://app-dev-v2.datarealities.com/user/iot/devices',
      detailPath: '/user/iot/devices',

      // Online device: Auto test - 8C:FC:A0:31:59:34 - 3576M (cmo2cimuo012114b2csz0wxxm)
      // Offline device: Auto test - 24:1C:04:27:0C:8B - DN76 (cmo2e0ih2016714b2cvo4567z)
      onlineDeviceId: 'cmo2cimuo012114b2csz0wxxm',
      offlineDeviceId: 'cmo2e0ih2016714b2cvo4567z',
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
      },

      control: {
        targetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        failureTargetDeviceId: 'cmo2e0ih2016714b2cvo4567z',
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
     deviceProfiles: {
            url: 'https://app-dev-v2.datarealities.com/user/iot/device-profiles',
            profileWithDevicesId: 'cmn2yfvw70021ygu0fwwqrtrl',
            profileWithDevicesName: 'DN74-profile',
            profileWithoutDevicesId: 'cmmnr86oc002r100okcqr3y0n',
            profileWithoutDevicesName: 'Dn74config',
            profileWithDescriptionId: 'cmmkpp7ms000313ydcuvcfwdf',
            profileWithDescriptionName: 'd',
            invalidProfileId: 'nonexistent-profile-999',
      },
  },
};
