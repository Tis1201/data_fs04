module.exports = {
    apiBaseURL: 'https://app-dev-v2.datarealities.com/auth/login',
    baseURL: 'https://app-dev-v2.datarealities.com/auth/login',
    username: 'minh@gmail.com',
    password: '123123',

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
      ethernetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
      wifiDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
      invalidDeviceId: 'invalid-device-id-999',
      snapshotTargetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',

      snapshot: {
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
        terminalVerifyCommand: 'id',
        terminalVerifyExpectedPattern: 'uid=',
      },

      installApp: {
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
        resourceSearchKeyword: 'counter',
        resourceExactName: 'counter_now',
        packageName: 'com.example.counter_now',
        verifyCommand: 'pm path com.example.counter_now',
        noResultSearchKeyword: 'zzzz_no_app_12345',
        offlineTargetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
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
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
        failureTargetDeviceId: 'cmo2cimuo012114b2csz0wxxm',
        terminalVerifyCommand: 'id',
        terminalVerifyExpectedPattern: 'uid=',
      },

      terminal: {
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
        smokeCommand: 'id',
        smokeExpectedPattern: 'uid=',
        invalidCommand: 'definitely_not_a_real_command_e2e_12345',
        invalidExpectedPattern: 'not found|inaccessible|unknown command|No such file|permission denied',
        recoveryCommand: 'id',
        recoveryExpectedPattern: 'uid=',
      },

      pushFile: {
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
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
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
        // Make sure this file exists on the device: echo "test" > /sdcard/Download/test.txt
        validSourceFilePath: '/sdcard/Download/test.txt',
        invalidSourceFilePath: '/sdcard/Download/file_not_exists_12345.txt',
        terminalVerifyCommand: '',
        terminalVerifyExpectedPattern: '__E2E_EXISTS__',
      },

      reboot: {
        targetDeviceId: 'cmo6pjoi000eejqh8wr6po2v5',
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
    deviceTags: {
      deviceSearch: '3576M',
      assignModalMultiSearch: '3576M',
      assignPickDeviceMatch: '3576M-2',
      assignExcludedDeviceId: 'cmo2cimuo012114b2csz0wxxm',
      assignSecondDeviceSearch: 'DN74',
      assignSecondDevicePick: 'DN74',
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
      resources: {
            url: 'https://app-dev-v2.datarealities.com/user/resources',
            applicationResourceId: 'cmojgxoif000hn409ufrtkfzc',
            applicationResourceName: 'Remote Device Manager-1.7.12-nokey',
            archiveResourceId: 'cmoitf5gc0007n409y8dxszql',
            archiveResourceName: 'display1ct4.png',
            invalidResourceId: 'nonexistent-id-999',
            accountName: 'Dang account',
            file: 'static/resourceA.zip',
            // Path to an APK file for APK-specific version tests (TC-RS-031/032).
            // Set to e.g. 'static/test.apk' if you have an APK file available.
            // Leave empty to skip those tests.
            apkFile: 'static/_testapp_19788056_v1.apk',
            // Optional: a second APK with the SAME packageName but HIGHER versionName.
            // When both apkFile and apkFileHigher are set, TC-RS-031 uploads v2 then v1
            // (lower) and TC-RS-032 uploads v1 then v2 (higher) to verify cross-version
            // coexistence within the same package. Leave empty to fall back to the
            // single-APK behaviour (just verify upload succeeds).
            apkFileHigher: 'static/_testapp_19788056_v2.apk',
            // Device IDs to try (in order) for TC-RS-035 Install App picker test.
            // The test uses the first device whose Install App button is visible (online).
            candidateDeviceIds: [
                'cmo6pjoi000eejqh8wr6po2v5', // Auto test - 8C:FC:A0:31:59:5F - 3576M-2
                'cmo2cimuo012114b2csz0wxxm', // Auto test - 8C:FC:A0:31:59:34 - 3576M Test
                'cmo0yzd4z00c014b2fn8k4o7n', // Auto test - 24:1C:04:26:88:E7 - DN74
            ],
            // Second account credentials for IDOR test (TC-RS-033).
            // Leave empty to skip that specific step.
            secondAccountUsername: '',
            secondAccountPassword: '',
            // Resource ID belonging to the second account for IDOR test.
            secondAccountResourceId: '',
      },
  },
};
