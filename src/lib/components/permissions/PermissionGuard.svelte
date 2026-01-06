<script lang="ts">
	/**
	 * PermissionGuard Component
	 * 
	 * A wrapper component that conditionally renders its children based on permissions.
	 * Useful for hiding sections of UI that require specific permissions.
	 * 
	 * @example
	 * ```svelte
	 * <PermissionGuard 
	 *   module="USER_DEVICES" 
	 *   action="DELETE"
	 *   permissions={data.modulePermissions}
	 *   userSystemRole={data.user?.systemRole}
	 * >
	 *   <DangerZoneSettings />
	 * </PermissionGuard>
	 * ```
	 */
	
	import type { PermissionAction } from '$lib/constants/permissions';
	import { hasPermission, hasAnyPermission, hasAllPermissions, type ModulePermissions } from '$lib/utils/permissions';
	
	// Props
	/** Module name for permission checking */
	export let module: string;
	
	/** Action to check - single action or array */
	export let action: PermissionAction | PermissionAction[] = 'VIEW';
	
	/** How to check multiple actions: 'any' (at least one) or 'all' (must have all) */
	export let mode: 'any' | 'all' = 'any';
	
	/** User's module permissions map */
	export let permissions: ModulePermissions | undefined | null = undefined;
	
	/** User's system role */
	export let userSystemRole: string | null = null;
	
	/** Invert the check - show when user DOESN'T have permission */
	export let invert = false;
	
	/** Show a fallback slot when permission is denied */
	export let showFallback = false;
	
	// Calculate permission
	$: actions = Array.isArray(action) ? action : [action];
	$: hasAccess = actions.length === 1
		? hasPermission(permissions, module, actions[0], userSystemRole)
		: mode === 'any'
			? hasAnyPermission(permissions, module, actions, userSystemRole)
			: hasAllPermissions(permissions, module, actions, userSystemRole);
	
	$: shouldShow = invert ? !hasAccess : hasAccess;
</script>

{#if shouldShow}
	<slot />
{:else if showFallback}
	<slot name="fallback">
		<!-- Default fallback is nothing -->
	</slot>
{/if}


