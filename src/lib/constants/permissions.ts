// Permission system based on Admin and User sidebar access
// A group is assigned EITHER Admin role OR User role

export type GroupRole = 'ADMIN' | 'USER';
export type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE';

export interface SidebarItem {
  label: string;
  href?: string;
  actions: PermissionAction[];
}

// Admin Sidebar Items (from AdminSidebar.svelte)
export const ADMIN_SIDEBAR_ITEMS: Record<string, SidebarItem> = {
  DASHBOARD: {
    label: 'Dashboard',
    href: '/admin/dashboard',
    actions: ['VIEW']
  },
  
  // IOT Section
  FACTORY_TOKENS: {
    label: 'Factory Tokens',
    href: '/admin/iot/factory_tokens',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  DEVICES: {
    label: 'Devices',
    href: '/admin/iot/devices',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  DEVICE_TAGS: {
    label: 'Device Tags',
    href: '/admin/iot/device_tags',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  DEVICE_PROFILES: {
    label: 'Device Profiles',
    href: '/admin/iot/device-profiles',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  RESOURCES: {
    label: 'Resources',
    href: '/admin/iot/resources',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  BUNDLES: {
    label: 'Bundles',
    href: '/admin/iot/bundles',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  PRECLAIMS: {
    label: 'Preclaims',
    href: '/admin/iot/preclaims',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  PIN_RULES: {
    label: 'PIN Rules',
    href: '/admin/iot/pin-rules',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },

  // Controllers Section
  ADMIN_CONTROLLERS_RADAR: {
    label: 'Radar Controllers',
    href: '/admin/controllers/radar',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // Access Section
  ACCOUNTS: {
    label: 'Accounts',
    href: '/admin/accounts/accounts',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  COMPANIES: {
    label: 'Companies',
    href: '/admin/accounts/companies',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  ADMIN_USERS: {
    label: 'Users',
    href: '/admin/users',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  GROUPS: {
    label: 'Groups',
    href: '/admin/accounts/groups',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // Billing Section
  LICENSES: {
    label: 'Licenses',
    href: '/admin/billing/licenses',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // Integrations Section
  WEBHOOK: {
    label: 'Webhook',
    href: '/admin/settings/webhook',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  WHATSAPP: {
    label: 'Whatsapp',
    href: '/admin/settings/whatsapp/accounts',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  LISTENERS: {
    label: 'Listeners',
    href: '/admin/settings/listeners',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // Settings Section
  GENERAL_SETTINGS: {
    label: 'General Settings',
    href: '/admin/settings/general',
    actions: ['VIEW', 'EDIT']
  },
  EMAIL_SETTINGS: {
    label: 'Email Settings',
    href: '/admin/settings/email',
    actions: ['VIEW', 'EDIT']
  },
  
  // Security Section
  SIGNING_KEYS: {
    label: 'Signing Keys',
    href: '/admin/jwt/signing_keys',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  API_KEYS: {
    label: 'API Keys',
    href: '/admin/settings/api_keys',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // JWT Section
  REFRESH_TOKENS: {
    label: 'Refresh Tokens',
    href: '/admin/jwt/refresh_tokens',
    actions: ['VIEW', 'DELETE']
  },
  TOKEN_LOGS: {
    label: 'Token Logs',
    href: '/admin/jwt/token_logs',
    actions: ['VIEW']
  },
  
  // Vision Section
  STREAMS: {
    label: 'Streams',
    href: '/admin/vision/streams',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  PREVIEW: {
    label: 'Preview',
    href: '/admin/vision/preview',
    actions: ['VIEW']
  },
  
  // Monitor
  MONITOR: {
    label: 'Monitor',
    href: '/admin/monitor',
    actions: ['VIEW']
  },
  
  // Debug Section
  // DEBUG_SSE removed - SSE has been migrated to MQTT
  // Use DEBUG_MESSAGING for MQTT connection debugging
  DEBUG_MESSAGING: {
    label: 'Messaging Debug',
    href: '/admin/debug/messaging',
    actions: ['VIEW']
  },
  DEBUG_REDIS: {
    label: 'Redis Debug',
    href: '/admin/debug/redis',
    actions: ['VIEW']
  }
} as const;

// User Sidebar Items (from UserSidebar.svelte)
export const USER_SIDEBAR_ITEMS: Record<string, SidebarItem> = {
  USER_DASHBOARD: {
    label: 'Dashboard',
    href: '/user/dashboard',
    actions: ['VIEW']
  },
  
  // IOT Section
  USER_DEVICES: {
    label: 'Devices',
    href: '/user/iot/devices',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  USER_DEVICE_TAGS: {
    label: 'Device Tags',
    href: '/user/iot/device_tags',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  USER_DEVICE_PROFILES: {
    label: 'Device Profiles',
    href: '/user/iot/device-profiles',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  USER_BUNDLES: {
    label: 'Bundles',
    href: '/user/iot/bundles',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  USER_PRECLAIMS: {
    label: 'Preclaims',
    href: '/user/iot/preclaims',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  USER_PIN_RULES: {
    label: 'PIN Rules',
    href: '/user/iot/pin-rules',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },

  USER_CONTROLLERS_RADAR: {
    label: 'Radar Controllers',
    href: '/user/controllers/radar',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // Resources Section
  USER_RESOURCES: {
    label: 'Resources (Files)',
    href: '/user/resources',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  
  // Settings Section
  USER_ACCOUNT_SETTINGS: {
    label: 'Account Settings',
    href: '/user/settings/account',
    actions: ['VIEW', 'EDIT']
  },
  USER_USERS: {
    label: 'Users',
    href: '/user/settings/users',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
  USER_PROFILE: {
    label: 'Profile',
    href: '/user/profile',
    actions: ['VIEW', 'EDIT']
  },
  
  // Support
  USER_SUPPORT: {
    label: 'Help & Support',
    href: '/user/support',
    actions: ['VIEW']
  }
} as const;

// Categories for organizing sidebar items
export const ADMIN_CATEGORIES = {
  'Dashboard': ['DASHBOARD'],
  'IOT': ['FACTORY_TOKENS', 'DEVICES', 'DEVICE_TAGS', 'DEVICE_PROFILES', 'RESOURCES', 'BUNDLES', 'PRECLAIMS', 'PIN_RULES'],
  'Controllers': ['ADMIN_CONTROLLERS_RADAR'],
  'Access': ['ACCOUNTS', 'COMPANIES', 'ADMIN_USERS', 'GROUPS'],
  'Billing': ['LICENSES'],
  'Integrations': ['WEBHOOK', 'WHATSAPP', 'LISTENERS'],
  'Settings': ['GENERAL_SETTINGS', 'EMAIL_SETTINGS'],
  'Security': ['SIGNING_KEYS', 'API_KEYS'],
  'JWT': ['REFRESH_TOKENS', 'TOKEN_LOGS'],
  'Vision': ['STREAMS', 'PREVIEW'],
  'Monitor': ['MONITOR'],
  'Debug': ['DEBUG_MESSAGING', 'DEBUG_REDIS']
} as const;

export const USER_CATEGORIES = {
  'Dashboard': ['USER_DASHBOARD'],
  'IOT': ['USER_DEVICES', 'USER_DEVICE_TAGS', 'USER_DEVICE_PROFILES', 'USER_BUNDLES', 'USER_PRECLAIMS', 'USER_PIN_RULES'],
  'Controllers': ['USER_CONTROLLERS_RADAR'],
  'Resources': ['USER_RESOURCES'],
  'Settings': ['USER_ACCOUNT_SETTINGS', 'USER_USERS', 'USER_PROFILE'],
  'Support': ['USER_SUPPORT']
} as const;

// Helper function to get permission dependencies
export function getPermissionDependencies(action: PermissionAction): PermissionAction[] {
  switch (action) {
    case 'VIEW':
      return ['VIEW'];
    case 'CREATE':
      return ['VIEW', 'CREATE'];
    case 'EDIT':
      return ['VIEW', 'CREATE', 'EDIT'];
    case 'DELETE':
      return ['VIEW', 'CREATE', 'EDIT', 'DELETE'];
    default:
      return [action];
  }
}

// Helper to check if action depends on another
export function actionDependsOn(action: PermissionAction, dependency: PermissionAction): boolean {
  const deps = getPermissionDependencies(action);
  return deps.includes(dependency);
}
