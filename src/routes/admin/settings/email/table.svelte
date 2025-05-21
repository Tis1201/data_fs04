<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, Power, Star, Mail } from "lucide-svelte";
    import type { EmailServiceProvider } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";

    // Props for DataTable component
    export let props = {
        records: [] as EmailServiceProvider[],
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
        loading: false,
        filters: {
            providerTypes: [] as {id: string, name: string}[],
            types: [] as string[],
            isActive: ''
        }
    };
    
    // State for confirmation dialogs
    let deleteState = {
        selectedRecord: null as EmailServiceProvider | null,
        confirmationOpen: false
    };

    let defaultState = {
        selectedRecord: null as EmailServiceProvider | null,
        confirmationOpen: false
    };

    let toggleState = {
        selectedRecord: null as EmailServiceProvider | null,
        confirmationOpen: false,
        newStatus: false
    };

    // Functions to open confirmation dialogs
    function confirmDelete(provider: EmailServiceProvider) {
        deleteState.selectedRecord = provider;
        deleteState.confirmationOpen = true;
    }

    function confirmSetDefault(provider: EmailServiceProvider) {
        defaultState.selectedRecord = provider;
        defaultState.confirmationOpen = true;
    }

    function confirmToggleActive(provider: EmailServiceProvider, newStatus: boolean) {
        toggleState.selectedRecord = provider;
        toggleState.newStatus = newStatus;
        toggleState.confirmationOpen = true;
    }
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });
</script>

<!-- Column definitions for the email providers table -->
<script lang="ts" context="module">
    import { Badge } from "$lib/components/ui/badge";
    
    // Define columns for the email providers table
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: EmailServiceProvider) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/settings/email",
                    showId: true
                }
            })
        },
        {
            id: "type",
            label: "Type",
            sortable: true,
            width: "10%",
            render: (record: EmailServiceProvider) => {
                const typeColors = {
                    smtp: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100",
                    resend: "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100",
                    sendgrid: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
                    mailgun: "bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100",
                    ses: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100",
                    postmark: "bg-pink-100 text-pink-800 dark:bg-pink-800 dark:text-pink-100"
                };
                
                const typeClass = typeColors[record.type as keyof typeof typeColors] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
                
                return {
                    component: Badge,
                    props: {
                        variant: "outline",
                        class: typeClass,
                        children: record.type.toUpperCase()
                    }
                };
            }
        },
        {
            id: "fromEmail",
            label: "From Email",
            width: "15%",
            render: (record: EmailServiceProvider) => record.fromEmail
        },
        {
            id: "status",
            label: "Status",
            width: "15%",
            render: (record: EmailServiceProvider) => {
                const badges = [];
                
                // Default badge
                if (record.isDefault) {
                    badges.push({
                        component: Badge,
                        props: {
                            variant: "outline",
                            class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 mr-2",
                            children: "DEFAULT"
                        }
                    });
                }
                
                // Active/Inactive badge
                const activeClass = record.isActive 
                    ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" 
                    : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100";
                
                badges.push({
                    component: Badge,
                    props: {
                        variant: "outline",
                        class: activeClass,
                        children: record.isActive ? "ACTIVE" : "INACTIVE"
                    }
                });
                
                return {
                    component: 'div',
                    props: {
                        class: "flex flex-row items-center",
                        children: badges
                    }
                };
            }
        },
        {
            id: "totalSent",
            label: "Emails Sent",
            sortable: true,
            width: "10%",
            render: (record: EmailServiceProvider) => record.totalSent.toLocaleString()
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: EmailServiceProvider) => ({
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
            id: "actions",
            label: "Actions",
            width: "15%",
            render: (record: EmailServiceProvider) => {
                // Define action items here
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/settings/email/${record.id}`)
                    },
                    {
                        label: "Test Send",
                        icon: Mail,
                        onClick: () => goto(`/admin/settings/email/${record.id}/test`)
                    }
                ];
                
                // Add Set Default action if not already default
                if (!record.isDefault) {
                    actionItems.push({
                        label: "Set Default",
                        icon: Star,
                        onClick: () => confirmSetDefault(record)
                    });
                }
                
                // Add Toggle Active action
                actionItems.push({
                    label: record.isActive ? "Deactivate" : "Activate",
                    icon: Power,
                    onClick: () => confirmToggleActive(record, !record.isActive)
                });
                
                // Add Delete action
                actionItems.push({
                    label: "Delete",
                    icon: Trash,
                    onClick: () => confirmDelete(record)
                });
                
                return {
                    component: RecordActions,
                    props: {
                        items: actionItems
                    }
                };
            }
        }
    ];
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        state={deleteState}
        actionName="deleteEmailProvider"
        onConfirm={() => {
            // Refresh the page to update the email providers list
            window.location.reload();
        }}
    />
    
    <!-- Set Default Confirmation Dialog -->
    <RecordUpdateDialog
        state={defaultState}
        title="Set Default Email Provider"
        description="Are you sure you want to set this provider as the default? This will make it the primary provider for sending emails."
        actionName="setDefault"
        buttonText="Set as Default"
        onConfirm={() => {
            // Refresh the page to update the email providers list
            window.location.reload();
        }}
    />
    
    <!-- Toggle Active Confirmation Dialog -->
    <RecordUpdateDialog
        state={toggleState}
        title={toggleState.newStatus ? "Activate Email Provider" : "Deactivate Email Provider"}
        description={toggleState.newStatus 
            ? "Are you sure you want to activate this provider? It will be available for sending emails."
            : "Are you sure you want to deactivate this provider? It will no longer be used for sending emails."}
        actionName="toggleActive"
        buttonText={toggleState.newStatus ? "Activate" : "Deactivate"}
        extraParams={{ active: toggleState.newStatus }}
        onConfirm={() => {
            // Refresh the page to update the email providers list
            window.location.reload();
        }}
    />

    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name, ID, or email..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Provider type filter -->
            <PopoverFilter
                label="Provider Type"
                options={props.filters.providerTypes?.map(type => ({ label: type.name, value: type.id })) || []}
                selectedValues={props.filters.types || []}
                key="types"
            />
            
            <!-- Active status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Active', value: 'true' },
                    { label: 'Inactive', value: 'false' }
                ]}
                selectedValues={props.filters.isActive ? [props.filters.isActive] : []}
                key="isActive"
                singleSelect={true}
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
