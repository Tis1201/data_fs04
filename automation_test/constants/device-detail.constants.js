module.exports = {
  DEVICE_DETAIL: {
    QUERY_PARAMS: {
      TAB: 'tab',
      ACTIVITY: 'activity',
    },

    DEFAULTS: {
      ACTIVITY_LOG_MAX_ROWS: 100,
    },

    UI_TEXT: {
      SNAPSHOT_BUTTON: 'Snapshot',
      INSTALL_APP_BUTTON: 'Install App',
      CONTROL_BUTTON: 'Control',
      TERMINAL_BUTTON: 'Terminal',
      PUSH_FILE_BUTTON: 'Push File',
      PULL_FILE_BUTTON: 'Pull File',
      REBOOT_BUTTON: 'Reboot',

      ACTIVITY_LOGS_HEADING: 'Activity Logs',
      ACTIVITY_LOGS_LOADING: 'Loading activity logs...',
      ACTIVITY_LOGS_EMPTY: 'No activity logs found for this device.',

      CONNECTION_STATUS_LABEL: 'Connection Status',
      ONLINE_STATUS: 'Online',
      CLOSE_BUTTON: 'Close',

      SCREENSHOT_ALT: 'Screenshot',

      INSTALL_MODAL_TITLE: 'Install New App',
      INSTALL_SEARCH_PLACEHOLDER: 'Search and select app',
      INSTALL_SEARCH_INPUT_LABEL: 'Search and select app',
      SEARCH_BUTTON: 'Search',
      CONFIRM_BUTTON: 'Confirm',
      CANCEL_BUTTON: 'Cancel',
      CLOSE_MODAL_BUTTON: 'Close modal',
      INSTALL_NO_APPS_FOUND: 'No apps found',
      INSTALL_SELECTED_EMPTY: 'No apps selected',
      INSTALL_SELECT_ALL: 'Select All',
      ALREADY_ON_DEVICE_BADGE: 'Already on device',
      INSTALLED_APPS_TAB: 'Installed Apps',
      INSTALLED_APPS_HEADING: 'Installed Apps',
      INSTALLED_APPS_LOADING: 'Loading apps...',
      INSTALLED_APPS_SEARCH_PLACEHOLDER: 'Search by name or package',
      INSTALL_NEW_APP_BUTTON: 'Install New App',
      UNINSTALL_APP_MENU_ITEM: 'Uninstall App',
      UNINSTALL_MODAL_TITLE: 'Uninstall App',
      UNINSTALL_CONFIRM_BUTTON: 'Uninstall',

      CONTROL_PAGE_TITLE: 'Remote desktop',
      CONTROL_CARD_TITLE: 'Remote Desktop Connection',
      CONTROL_CONNECTION_STATE_LABEL: 'Connection State',
      CONTROL_CONNECTING_TEXT: 'Connecting to remote desktop',
      CONTROL_NOT_CONNECTED_TEXT: 'Could not connect to remote desktop',
      CONNECTING_STATUS: 'Connecting',
      CONNECTED_STATUS: 'Connected',
      DISCONNECTED_STATUS: 'Disconnected',
      CONTROL_TIMEOUT_TEXT: 'Connection timeout',

      TERMINAL_PAGE_TITLE: 'Device Terminal',
      TERMINAL_CARD_TITLE: 'Terminal Connection',
      BACK_TO_DEVICE_BUTTON: 'Back to Device',

      PUSH_FILE_MODAL_TITLE: 'Push File',
      PUSH_FILE_DESTINATION_PLACEHOLDER: 'eg: /home/user/downloads/',
      PUSH_FILE_SEARCH_PLACEHOLDER: 'Search files',
      PUSH_FILE_LOADING: 'Loading files...',
      PUSH_FILE_EMPTY: 'No files found',

      PULL_FILE_MODAL_TITLE: 'Pull File',
      PULL_FILE_SOURCE_PLACEHOLDER: 'eg: /home/user/documents/file.txt',
      PULL_FILE_CONFIRM_BUTTON: 'Pull File',

      REBOOT_MODAL_TITLE: 'Reboot Device',
      REBOOT_MODAL_DESCRIPTION:
        'Are you sure you want to reboot this device? This will restart the device and may take a few minutes.',
      REBOOT_CONFIRM_BUTTON: 'Reboot',
      REBOOT_SUCCESS_TOAST: 'Reboot command sent to device',
      REBOOT_INITIATED_TEXT: 'Reboot initiated',
    },

    PATTERNS: {
      SUCCESS_STATUS: /success/i,
      IN_PROGRESS_STATUS: /in\s*progress|pending|initiated/i,
      FAILED_STATUS: /failed|error/i,

      SNAPSHOT_RELATED: [/screenshot/i, /snapshot/i, /captured screenshot/i],
      INSTALL_RELATED: [/install app/i, /installed application/i, /install/i],
      CONTROL_RELATED: [/remote desktop/i, /rdp/i, /control/i],
      CONTROL_LOADING: [/connecting/i, /loading/i, /establishing/i],
      CONTROL_TIMEOUT: [/timeout/i, /timed out/i, /could not connect/i, /disconnected/i],

      VALID_IMAGE_SRC: [/^data:image\//i, /^blob:/i, /^https?:\/\//i],

      TERMINAL_READY: [
        /terminal ready/i,
        /welcome to terminal/i,
        /connecting to device terminal/i,
        /terminal connected/i,
        /connected/i,
      ],
      TERMINAL_PROMPT: [/:\/ \$/m, /\$\s*$/m, /#\s*$/m],
      TERMINAL_ERROR: [
        /not found/i,
        /inaccessible/i,
        /unknown command/i,
        /no such file/i,
        /permission denied/i,
      ],

      PUSH_FILE_RELATED: [/push file/i, /file push/i, /pushing/i, /pushed/i],
      PULL_FILE_RELATED: [
        /pull file/i,
        /pulled file/i,
        /file pulled/i,
        /pulled successfully/i,
        /file not found/i,
        /not found:\s*\/.+/i,
        /download file/i,
        /file download/i,
        /transfer file/i,
        /retrieve file/i,
      ],
      REBOOT_RELATED: [/reboot/i, /reboot initiated/i, /rebooted device/i],
      UNINSTALL_RELATED: [/uninstall/i, /uninstalled/i, /remov/i],
    },

    SELECTORS: {
      INFO_ROW: '.info-row',
      ACTIVITY_ROW: '.activity-row',
      ACTIVITY_EVENT: '.activity-col-event',
      ACTIVITY_DESCRIPTION: '.activity-col-description',
      ACTIVITY_STATUS: '.activity-col-status',
      ACTIVITY_EXPAND_BUTTON: '.activity-col-expand button',
      ACTIVITY_DETAILS_ROW_XPATH:
        'xpath=following-sibling::*[1][contains(@class,"activity-details-row")]',
      DIALOG: '[role="dialog"], .fixed.inset-0.z-50',
      XTERM_ROOT: '.xterm',
      XTERM_ROWS: '.xterm-rows',
      XTERM_SCREEN: '.xterm-screen',
      XTERM_VIEWPORT: '.xterm-viewport',

      CONTROL_MEDIA: 'video, img[alt="RDP Frame"], canvas',
      PUSH_FILE_ITEM: '.push-file-item',
    },
  },
};
