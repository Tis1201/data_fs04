<script lang="ts">
	/**
	 * ActionButtons Component
	 * 
	 * A permission-aware button group that shows/hides action buttons based on user permissions.
	 * Automatically hides buttons the user doesn't have permission for.
	 * 
	 * @example
	 * ```svelte
	 * <ActionButtons
	 *   module="USER_DEVICES"
	 *   permissions={data.modulePermissions}
	 *   userSystemRole={data.user?.systemRole}
	 *   onCreate={() => goto('/user/iot/devices/new')}
	 *   onEdit={() => handleEdit(selected)}
	 *   onDelete={() => handleDelete(selected)}
	 * />
	 * ```
	 */
	
	import { Button } from '$lib/components/ui/button';
	import { canCreate, canEdit, canDelete, type ModulePermissions } from '$lib/utils/permissions';
	import { Plus, Pencil, Trash2, Eye, MoreHorizontal } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';
	
	// Props
	/** Module name for permission checking */
	export let module: string;
	
	/** User's module permissions map */
	export let permissions: ModulePermissions | undefined | null = undefined;
	
	/** User's system role (ADMIN bypasses permission checks) */
	export let userSystemRole: string | null = null;
	
	// Action callbacks - buttons only shown when callback is provided AND user has permission
	/** Callback for create action */
	export let onCreate: (() => void) | undefined = undefined;
	
	/** Callback for view action */
	export let onView: (() => void) | undefined = undefined;
	
	/** Callback for edit action */
	export let onEdit: (() => void) | undefined = undefined;
	
	/** Callback for delete action */
	export let onDelete: (() => void) | undefined = undefined;
	
	// UI customization
	/** Button size variant */
	export let size: 'default' | 'sm' | 'lg' | 'icon' = 'sm';
	
	/** Show button labels (false shows icon-only) */
	export let showLabels: boolean = true;
	
	/** Custom CSS class for container */
	let className = '';
	export { className as class };
	
	// Custom labels
	export let createLabel = 'Create';
	export let viewLabel = 'View';
	export let editLabel = 'Edit';
	export let deleteLabel = 'Delete';
	
	// Disabled states
	export let createDisabled = false;
	export let viewDisabled = false;
	export let editDisabled = false;
	export let deleteDisabled = false;
	
	// Loading states
	export let createLoading = false;
	export let viewLoading = false;
	export let editLoading = false;
	export let deleteLoading = false;
	
	// Event dispatcher for alternative usage
	const dispatch = createEventDispatcher<{
		create: void;
		view: void;
		edit: void;
		delete: void;
	}>();
	
	// Permission checks
	$: showCreate = onCreate && canCreate(permissions, module, userSystemRole);
	$: showView = onView; // VIEW is always allowed if callback provided (already passed VIEW check to see the page)
	$: showEdit = onEdit && canEdit(permissions, module, userSystemRole);
	$: showDelete = onDelete && canDelete(permissions, module, userSystemRole);
	
	// Check if any buttons are visible
	$: hasAnyButton = showCreate || showView || showEdit || showDelete;
	
	// Handlers
	function handleCreate() {
		if (onCreate) onCreate();
		dispatch('create');
	}
	
	function handleView() {
		if (onView) onView();
		dispatch('view');
	}
	
	function handleEdit() {
		if (onEdit) onEdit();
		dispatch('edit');
	}
	
	function handleDelete() {
		if (onDelete) onDelete();
		dispatch('delete');
	}
</script>

{#if hasAnyButton}
	<div class="flex items-center gap-2 {className}">
		{#if showCreate}
			<Button 
				{size}
				variant="default"
				disabled={createDisabled || createLoading}
				on:click={handleCreate}
			>
				{#if createLoading}
					<span class="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
				{:else}
					<Plus class="h-4 w-4 {showLabels ? 'mr-1.5' : ''}" />
				{/if}
				{#if showLabels}{createLabel}{/if}
			</Button>
		{/if}
		
		{#if showView}
			<Button 
				{size}
				variant="outline"
				disabled={viewDisabled || viewLoading}
				on:click={handleView}
			>
				{#if viewLoading}
					<span class="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
				{:else}
					<Eye class="h-4 w-4 {showLabels ? 'mr-1.5' : ''}" />
				{/if}
				{#if showLabels}{viewLabel}{/if}
			</Button>
		{/if}
		
		{#if showEdit}
			<Button 
				{size}
				variant="outline"
				disabled={editDisabled || editLoading}
				on:click={handleEdit}
			>
				{#if editLoading}
					<span class="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
				{:else}
					<Pencil class="h-4 w-4 {showLabels ? 'mr-1.5' : ''}" />
				{/if}
				{#if showLabels}{editLabel}{/if}
			</Button>
		{/if}
		
		{#if showDelete}
			<Button 
				{size}
				variant="destructive"
				disabled={deleteDisabled || deleteLoading}
				on:click={handleDelete}
			>
				{#if deleteLoading}
					<span class="mr-1.5 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
				{:else}
					<Trash2 class="h-4 w-4 {showLabels ? 'mr-1.5' : ''}" />
				{/if}
				{#if showLabels}{deleteLabel}{/if}
			</Button>
		{/if}
		
		<!-- Slot for additional buttons -->
		<slot />
	</div>
{/if}


