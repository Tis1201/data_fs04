/**
 * Permission Components
 * 
 * Components for permission-aware UI rendering.
 * These components integrate with the module permission system
 * to show/hide UI elements based on user permissions.
 * 
 * @example
 * ```svelte
 * <script>
 *   import { ActionButtons, PermissionGuard } from '$lib/components/permissions';
 * </script>
 * 
 * <ActionButtons
 *   module="USER_DEVICES"
 *   permissions={data.modulePermissions}
 *   userSystemRole={data.user?.systemRole}
 *   onCreate={() => goto('/user/iot/devices/new')}
 * />
 * 
 * <PermissionGuard module="USER_DEVICES" action="DELETE">
 *   <DangerButton on:click={handleDelete}>Delete All</DangerButton>
 * </PermissionGuard>
 * ```
 */

export { default as ActionButtons } from './ActionButtons.svelte';
export { default as PermissionGuard } from './PermissionGuard.svelte';

// Re-export utility functions for convenience
export {
	hasPermission,
	canView,
	canCreate,
	canEdit,
	canDelete,
	hasAnyPermission,
	hasAllPermissions,
	getAllowedActions,
	getHighestPermission,
	createPermissionContext,
	type ModulePermissions,
	type PermissionContext
} from '$lib/utils/permissions';


