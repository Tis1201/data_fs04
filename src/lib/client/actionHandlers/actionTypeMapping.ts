/**
 * Centralized Action Type Mapping
 * 
 * All actions use snake_case consistently across UI, Database, Device, and Server.
 * No legacy mappings - one canonical name per action.
 */

/**
 * Action types - used consistently everywhere
 */
export type ActionType = 
  | 'refresh' 
  | 'reboot' 
  | 'restart'
  | 'install_app' 
  | 'update_firmware' 
  | 'pull_file' 
  | 'push_file' 
  | 'get_logs' 
  | 'snapshot'
  | 'uninstall_app' 
  | 'restart_app' 
  | 'config_app'
  | 'bundle_status';

/**
 * Action labels for UI display
 */
const ACTION_LABELS: Record<ActionType, string> = {
  'refresh': 'Refresh',
  'reboot': 'Reboot',
  'restart': 'Restart',
  'install_app': 'Install App',
  'update_firmware': 'Update Firmware',
  'pull_file': 'Pull File',
  'push_file': 'Push File',
  'get_logs': 'Get Logs',
  'snapshot': 'Screenshot',
  'uninstall_app': 'Uninstall App',
  'restart_app': 'Restart App',
  'config_app': 'Config App',
  'bundle_status': 'Bundle Status'
};

/**
 * Handler routing map - maps actions to their handler keys
 * Now using snake_case consistently, so most actions map to themselves
 */
const HANDLER_MAP: Record<string, string> = {
  'refresh': 'refresh',
  'reboot': 'reboot',
  'restart': 'restart',
  'install_app': 'install_app',
  'push_file': 'push_file',
  'pull_file': 'pull_file',
  'update_firmware': 'update_firmware',
  'get_logs': 'get_logs',
  'bundle_status': 'bundle_status',
  'uninstall_app': 'uninstall_app',
  'restart_app': 'restart_app',
  'config_app': 'config_app',
  'snapshot': 'snapshot'
};

/**
 * Actions that track progress
 */
const PROGRESS_ACTIONS: ActionType[] = [
  'install_app',
  'update_firmware',
  'pull_file',
  'push_file',
  'get_logs'
];

/**
 * Get display label for action type
 */
export function getActionLabel(actionType: string): string {
  return ACTION_LABELS[actionType as ActionType] || actionType;
}

/**
 * Check if action type tracks progress
 */
export function actionHasProgress(actionType: string): boolean {
  return PROGRESS_ACTIONS.includes(actionType as ActionType);
}

/**
 * Map action to handler key for routing
 */
export function mapActionToHandlerKey(action: string): string | null {
  return HANDLER_MAP[action] || null;
}

/**
 * Map action type to database format (no-op now since everything is already snake_case)
 */
export function mapActionTypeToDb(actionType: string | undefined | null): ActionType | undefined {
  if (!actionType) {
    console.warn('[actionTypeMapping] No action type provided');
    return undefined;
  }
  
  // Return as-is since we use snake_case everywhere now
  return actionType as ActionType;
}
