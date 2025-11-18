<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from 'sveltekit-superforms/client';
    import { zod } from 'sveltekit-superforms/adapters';
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, FileText, Users, Shield, UserPlus } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    
    // Import permissions component
    import PermissionsCheckboxes from "../[id]/PermissionsCheckboxes.svelte";
    
    import type { PageData } from "./$types";
    import type { GroupRole } from "$lib/constants/permissions";
    
    export let data: PageData;
    const title = "Create Group";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts"],
        ["Groups", "/admin/accounts/groups"],
        "New Group"
    ];
    
    // Import form utilities and schema
    import { getDetailPageFormConfig, getFieldProps, processFormMessages, getSelectProps } from '$lib/utils/formHelpers';
    import { groupSchema } from './group';
    
    // Permissions state
    let permissions: Record<string, boolean> = {};
    let groupRole: GroupRole = 'ADMIN'; // Default to Admin Access
    
    // Selected users state
    let selectedUserIds: string[] = [];
    
    // Enhanced SuperForms setup - best practice approach
    const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
        superForm(data.form, {
            validators: zod(groupSchema), // Schema validation for proper typing
            ...getDetailPageFormConfig("Group"), // FormHelpers utilities for consistency
            onResult: async ({ result }) => {
                if (result.type === "success") {
                    toast.success("Group created successfully!", {
                        description: "The group has been created with permissions and members.",
                        duration: 4000
                    });
                    // Redirect to groups list on success
                    await goto('/admin/accounts/groups');
                }
            }
        });
    
    // Reactive states - using formHelpers pattern
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;
    
    // Get available users based on selected account
    $: availableUsers = $form.accountId 
        ? data.accountMembers.filter(m => m.accountId === $form.accountId)
        : [];
    
    // Toggle user selection
    function toggleUser(userId: string) {
        if (selectedUserIds.includes(userId)) {
            selectedUserIds = selectedUserIds.filter(id => id !== userId);
        } else {
            selectedUserIds = [...selectedUserIds, userId];
        }
    }
    
    // Custom submit handler to include permissions and users
    async function handleSubmit(event: Event) {
        event.preventDefault();
        
        // Validate form fields first using SuperForms
        // This will trigger validation errors to show
        const isValid = $form.name && $form.accountId;
        
        if (!isValid) {
            // Trigger validation by attempting to update errors
            if (!$form.name) {
                $errors.name = ['Name is required'];
            }
            if (!$form.accountId) {
                $errors.accountId = ['Account is required'];
            }
            
            toast.error("Validation Error", {
                description: "Please fill in all required fields",
                duration: 4000
            });
            return;
        }
        
        const formData = new FormData(event.target as HTMLFormElement);
        
        // Add permissions
        formData.append('permissions', JSON.stringify(permissions));
        formData.append('groupRole', groupRole);
        
        // Add selected users
        formData.append('userIds', JSON.stringify(selectedUserIds));
        
        try {
            const response = await fetch('?/create', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok && result?.type === 'success') {
                toast.success("Group created successfully!", {
                    description: "The group has been created with permissions and members.",
                    duration: 4000
                });
                await goto('/admin/accounts/groups');
            } else {
                const errorMsg = result?.data?.error || result?.error || "Failed to create group";
                toast.error("Failed to create group", {
                    description: errorMsg,
                    duration: 6000
                });
            }
        } catch (error) {
            toast.error("An error occurred", {
                description: error instanceof Error ? error.message : "Unknown error",
                duration: 6000
            });
        }
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: async () => await goto('/admin/accounts/groups'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Create Group",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9"
      }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
    <form
        method="POST"
        action="?/create"
        on:submit={handleSubmit}
        novalidate
        class="space-y-6"
    >
        <!-- Basic Information -->
        <AdminCard
            title="Group Information"
            description="Basic details about the group"
            icon={Users}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField 
                        id="name" 
                        label="Group Name" 
                        error={$errors.name}
                        required={true}
                        helpText="Enter a unique name for the group"
                    >
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="Enter group name"
                            {...getFieldProps($errors, 'name', isLoading)}
                        />
                    </FormField>
                    
                    <FormField 
                        id="accountId" 
                        label="Account" 
                        error={$errors.accountId}
                        required={true}
                        helpText="Select the parent account for this group"
                    >
                        <EnhancedSelect
                            id="accountId"
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
                            {...getSelectProps($errors, 'accountId', isLoading)}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="description" 
                        label="Description" 
                        error={$errors.description}
                        helpText="Optional description of the group's purpose"
                    >
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter group description"
                            rows="3"
                            class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                            disabled={isLoading}
                            aria-invalid={$errors.description ? true : undefined}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <!-- Permissions Section -->
        <AdminCard
            title="Group Permissions"
            description="Configure what members of this group can access and manage"
            icon={Shield}
            compact={true}
        >
            <PermissionsCheckboxes 
                bind:permissions 
                bind:groupRole 
                disabled={isLoading}
                {isLoading}
                showSaveButton={false}
            />
        </AdminCard>
        
        <!-- Add Users Section -->
        <AdminCard
            title="Add Users to Group"
            description="Select users to add to this group (optional)"
            icon={UserPlus}
            compact={true}
        >
            {#if !$form.accountId}
                <div class="text-center py-8 text-muted-foreground">
                    <p>Please select an account first to see available users</p>
                </div>
            {:else if availableUsers.length === 0}
                <div class="text-center py-8 text-muted-foreground">
                    <p>No users available in the selected account</p>
                </div>
            {:else}
                <div class="space-y-3">
                    <div class="flex items-center gap-2 mb-4">
                        <Badge variant="secondary">
                            {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                        </Badge>
                    </div>
                    
                    <div class="grid gap-2 max-h-[400px] overflow-y-auto">
                        {#each availableUsers as member}
                            {@const isSelected = selectedUserIds.includes(member.id)}
                            <button
                                type="button"
                                on:click={() => toggleUser(member.id)}
                                class="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors {isSelected ? 'border-primary bg-primary/5' : ''}"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                                        {#if isSelected}
                                            <svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        {:else}
                                            <Users class="w-4 h-4 text-muted-foreground" />
                                        {/if}
                                    </div>
                                    <div class="text-left">
                                        <p class="font-medium text-sm">
                                            {member.user.name || 'Unnamed User'}
                                        </p>
                                        <p class="text-xs text-muted-foreground">
                                            {member.user.email}
                                        </p>
                                    </div>
                                </div>
                                {#if isSelected}
                                    <Badge variant="default" class="ml-2">Selected</Badge>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </AdminCard>
        
        <!-- Submit hidden for custom handler -->
        <input type="hidden" name="accountId" bind:value={$form.accountId} />
    </form>
    </div>
</AdminPageLayout>
