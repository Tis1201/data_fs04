<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import PasswordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/PasswordUpdateDialog.svelte";
    import ResetPasswordDialog from "$lib/components/ui_components_sveltekit/dialog/ResetPasswordDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, UserCheck, UserX, Key, KeyRound } from "lucide-svelte";
    import type { User } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";

    // Props for DataTable component
    export let props = {
        records: [] as User[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as User | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(user: User) {
        state.selectedRecord = user;
        state.confirmationOpen = true;
    }
    
    // User to be toggled (for status change)
    let userToToggle: User | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // State for password update dialog
    let passwordUpdateDialogOpen = false;
    let userToUpdatePassword: User | null = null;
    
    // State for reset password dialog
    let resetPasswordDialogOpen = false;
    let userToResetPassword: User | null = null;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(user: User) {
        userToToggle = user;
        statusToggleDialogOpen = true;
    }
    
    // Function to open password update dialog
    function openPasswordUpdateDialog(user: User) {
        userToUpdatePassword = user;
        passwordUpdateDialogOpen = true;
    }

    // Function to open reset password dialog
    function openResetPasswordDialog(user: User) {
        userToResetPassword = user;
        resetPasswordDialogOpen = true;
    }

    // Stores for filters and table state
    const selectedRoles = writable<string[]>(
        $page.url.searchParams.get("systemRoles")?.split(",").filter(Boolean) ?? []
    );
    $: {
        // Keep selectedRoles in sync with URL changes
        const urlRoles = $page.url.searchParams.get("systemRoles")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlRoles) !== JSON.stringify($selectedRoles)) {
            selectedRoles.set(urlRoles);
        }
    }
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        // Check for legacy 'roles' parameter and remove it
        if (url.searchParams.has('roles')) {
            // If systemRoles is not set but roles is, transfer the value (with uppercase conversion)
            if (!url.searchParams.has('systemRoles')) {
                const rolesValue = url.searchParams.get('roles');
                if (rolesValue) {
                    // Convert role values to uppercase to match the database format
                    const upperCaseRoles = rolesValue.split(',').map(r => r.toUpperCase()).join(',');
                    url.searchParams.set('systemRoles', upperCaseRoles);
                }
            }
            url.searchParams.delete('roles');
            needsRedirect = true;
        }
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );

    function getStatusBadge(status: string) {
        const statusText = status || "UNKNOWN";
        let variant = "default";

        switch (statusText) {
            case "ACTIVE":
                variant = "Active";
                break;
            case "INACTIVE":
                variant = "Inactive";
                break;
            case "PENDING":
                variant = "Pending";
                break;
            default:
                variant = "default";
        }

        return variant;
    }

    // Column definitions
    const columns = [
        {
            id: "email",
            label: "Email",
            sortable: true,
            width: "30%",
            render: (record: User) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/users",
                    idField: "id",
                    nameField: "email"
                }
            })
        },
        {
            id: "systemRole",
            label: "Roles",
            sortable: true,
            width: "20%",
            render: (record: User) => record.systemRole || "N/A"
        },

        // {
        //     id: "systemRole",
        //     label: "System Role",
        //     sortable: true,
        //     width: "20%",
        //     render: (record: User) => record.systemRole || "N/A"
        // },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "20%",
            render: (record: User) => ({
                component: RelativeDate,
                props: {
                    date: record.createdAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "20%",
            render: (record: User) => getStatusBadge(record.status)
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: User) => {
                // Define action items here instead of in the RecordActions component
                const actionItems = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/users/${record.id}`)
                    },
                    {
                        label: "View Sessions",
                        icon: Key,
                        onClick: () => goto(`/admin/users/${record.id}/sessions`)
                    },
                    {
                        label: "Update Password",
                        icon: KeyRound,
                        onClick: () => openPasswordUpdateDialog(record)
                    },
                    {
                        label: "Reset Password",
                        icon: KeyRound,
                        onClick: () => openResetPasswordDialog(record)
                    },
                    {
                        label: isTogglingStatus && userToToggle?.id === record.id 
                            ? "Updating..." 
                            : (record.status === 'ACTIVE' ? "Deactivate" : "Activate"),
                        icon: isTogglingStatus && userToToggle?.id === record.id 
                            ? null 
                            : (record.status === 'ACTIVE' ? UserX : UserCheck),
                        onClick: () => prepareToggleStatus(record),
                        disabled: isTogglingStatus
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record)
                    }
                ];
                
                return {
                    component: RecordActions,
                    props: {
                        items: actionItems
                    }
                };
            }
        }
    ];

    // Using imported pagination utilities for table interactions
    // These are already imported from pagination-utils
</script>

<div class="space-y-4">
    <!-- Password Update Dialog -->
    <PasswordUpdateDialog
        bind:open={passwordUpdateDialogOpen}
        bind:user={userToUpdatePassword}
        onSuccess={() => {
            // Refresh data if needed after password update
            goto($page.url.pathname, { invalidateAll: true });
        }}
    />
    
    <!-- Reset Password Dialog -->
    <ResetPasswordDialog
        bind:open={resetPasswordDialogOpen}
        bind:user={userToResetPassword}
        action="?/resetPassword"
    />
    
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        onConfirm={() => {

        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/toggleStatus"
        bind:record={userToToggle}
        bind:isProcessing={isTogglingStatus}
        title={userToToggle ? (userToToggle.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account') : null}
        description={userToToggle ? `Are you sure you want to ${userToToggle.status === 'ACTIVE' ? 'deactivate' : 'activate'} the account "${userToToggle.name}"?` : null}
        confirmText={userToToggle ? (userToToggle.status === 'ACTIVE' ? 'Deactivate' : 'Activate') : null}
        onSuccess={(result) => {
            // Update the user status in the local data without page refresh
            if (userToToggle) {
                const newStatus = userToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                
                // Find and update the user in the records array
                const index = props.records.findIndex(r => r.id === userToToggle?.id);
                if (index !== -1) {
                    props.records[index].status = newStatus;
                    // Force a UI update
                    props = { ...props };
                }
                
                toast.success(`User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                
                // Reset the userToToggle and close dialog
                userToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update user status: ${result.data?.error || 'Unknown error'}`);
            userToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="id" value={userToToggle?.id || ''} />
        <input type="hidden" name="status" value={userToToggle?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'} />
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by email..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Role filter -->
            <PopoverFilter
                label="System Role"
                options={[
                    { label: "Admin", value: "ADMIN" },
                    { label: "User", value: "USER" }
                ]}
                selectedValues={$selectedRoles}
                key="systemRoles"
            />
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" },
                    { label: "Suspended", value: "SUSPENDED" }
                ]}
                selectedValues={$selectedStatuses}
                key="statuses"
            />
        </div>

        <!-- Data table -->
        <DataTable
            {columns}
            {props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
