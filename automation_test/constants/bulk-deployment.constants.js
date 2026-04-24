module.exports = {
  BULK_DEPLOYMENT: {
    URLS: {
      LIST_PATH: '/user/iot/bundles',
      DETAIL_PATH: '/user/iot/bundles',
    },

    UI_TEXT: {
      PAGE_TITLE: 'Bulk Deployments',
      DETAIL_TITLE: 'Deployment Details',
      ADD_DEPLOYMENT: 'Add Deployment',
      SAVE_AS_DRAFT: 'Save as Draft',
      CANCEL: 'Cancel',

      OVERVIEW_TITLE: 'Deployment Overview',
      DEVICES_TAB: 'Devices',
      APPS_TAB: 'Apps',
      BATCHES_TAB: 'Batches',

      DEPLOYMENT_DEVICE_TITLE: 'Deployment Device',
      DEPLOYMENT_APPS_TITLE: 'Deployment Apps',
      DEPLOYMENT_BATCHES_TITLE: 'Deployment Batches',

      ADD_DEVICE: 'Add Device',
      ADD_APP: 'Add App',
      IMPORT_CSV: 'Import CSV',
      ASSIGN_BY_TAG: 'Assign by tag',

      PUBLISH: 'Publish',
      DUPLICATE: 'Duplicate',
      DELETE: 'Delete',
      EDIT: 'Edit',

      SEARCH_LIST_PLACEHOLDER: 'Search by Name or ID',
      SEARCH_DEVICE_PLACEHOLDER: 'Search and select device',
      SEARCH_APP_PLACEHOLDER: 'Search and select app',

      NO_DEVICE_EMPTY: 'No devices added to this bundle yet',
      NO_APP_EMPTY: 'No apps added to this bundle yet',
      NO_BATCH_EMPTY: 'No Data Available.',

      STATUS_DRAFT: 'Draft',
      STATUS_FAILED: 'Failed',

      FORM: {
        NAME_LABEL: 'Deployment Name',
        TARGET_OS_LABEL: 'Target to Operating System',
        VERSION_LABEL: 'Version',
        BATCH_SIZE_LABEL: 'Batch Size',
        SCHEDULE_LABEL: 'Schedule',
        DESCRIPTION_LABEL: 'Description',
        REBOOT_DEVICE: 'Reboot Device',
        FORCE_UPDATE: 'Force Update',
        NONE: 'None',
        FUTURE: 'Future',
        ANDROID: 'Android',
      },
    },

    LIMITS: {
      DEPLOYMENT_NAME_MAX: 50,
      DESCRIPTION_MAX: 200,
    },
  },
};