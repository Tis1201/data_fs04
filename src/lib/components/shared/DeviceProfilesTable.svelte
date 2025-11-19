<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, Users, MoreHorizontal } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";

    // Define the DeviceProfile type based on our API response
    interface DeviceProfile {
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        createdBy: string;
        updatedBy: string;
        account: {
            id: string;
            name: string;
        };
        _count: {
            assignments: number;
        };
    }

    // Props for DataTable component
    export let props = {
        records: [] as DeviceProfile[],
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

    // Context props to determine if this is admin or user context
    export let context: 'admin' | 'user' = 'admin';
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as DeviceProfile | null,
        confirmationOpen: false
    };


    // Function to open delete confirmation dialog
    function confirmDelete(profile: DeviceProfile) {
        state.selectedRecord = profile;
        state.confirmationOpen = true;
    }

    // Stores for filters and table state
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );
    
    $: {
        // Keep selectedStatuses in sync with URL changes
        const urlStatuses = $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlStatuses) !== JSON.stringify($selectedStatuses)) {
            selectedStatuses.set(urlStatuses);
        }
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

    // Status options for filter
    const statusOptions = [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' }
    ];

    // Function to handle delete confirmation
    async function handleDelete() {
        if (!state.selectedRecord) return;

        try {
            const response = await fetch(`/api/v2/device-profiles/${state.selectedRecord.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toast.success('Device profile deleted successfully');
                // Refresh the page to update the list
                window.location.reload();
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to delete device profile');
            }
        } catch (error) {
            console.error('Error deleting device profile:', error);
            toast.error('Failed to delete device profile');
        } finally {
            state.confirmationOpen = false;
            state.selectedRecord = null;
        }
    }

    // Function to handle device assignment
    function handleAssignDevices(profile: DeviceProfile) {
        const basePath = context === 'admin' ? '/admin/iot' : '/user/iot';
        goto(`${basePath}/device-profiles/${profile.id}/assign`);
    }

    // Function to handle edit
    function handleEdit(profile: DeviceProfile) {
        const basePath = context === 'admin' ? '/admin/iot' : '/user/iot';
        goto(`${basePath}/device-profiles/${profile.id}/edit`);
    }


    // Table columns configuration
    const columns = [
        {
            id: 'name',
            label: 'Profile Name',
            sortable: true,
            width: '25%',
            render: (record: DeviceProfile) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Profile'
                    },
                    baseUrl: `${context === 'admin' ? '/admin/iot/device-profiles' : '/user/iot/device-profiles'}/${record.id}/edit`,
                    showId: true,
                    useDirectUrl: true
                }
            })
        },
        {
            id: 'description',
            label: 'Description',
            sortable: false,
            width: '20%',
            render: (record: DeviceProfile) => record.description || 'No description'
        },
        {
            id: 'isActive',
            label: 'Status',
            sortable: true,
            width: '10%',
            render: (record: DeviceProfile) => {
                const status = record.isActive ? 'Active' : 'Inactive';
                const variant = record.isActive ? 'default' : 'secondary';
                return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant === 'default' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${status}</span>`;
            }
        },
        {
            id: 'assignments',
            label: 'Assigned Devices',
            sortable: false,
            width: '15%',
            render: (record: DeviceProfile) => `${record._count.assignments} devices`
        },
        {
            id: 'account',
            label: 'Account',
            sortable: false,
            width: '15%',
            render: (record: DeviceProfile) => record.account.name
        },
        {
            id: 'createdAt',
            label: 'Created',
            sortable: true,
            width: '15%',
            render: (record: DeviceProfile) => ({
                component: RelativeDate,
                props: {
                    date: record.createdAt,
                    format: 'relative',
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: 'actions',
            label: 'Actions',
            width: '10%',
            render: (record: DeviceProfile) => {
                const actionItems = [
                    {
                        label: 'Edit',
                        icon: Pencil,
                        onClick: () => handleEdit(record)
                    },
                    {
                        label: 'Delete',
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
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name or ID..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={statusOptions}
                selectedValues={$selectedStatuses}
                onChange={(values) => {
                    selectedStatuses.set(values);
                    const url = new URL(window.location.href);
                    url.searchParams.set('statuses', values.join(','));
                    if (!values.length) url.searchParams.delete('statuses');
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
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

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
    bind:open={state.confirmationOpen}
    recordName={state.selectedRecord?.name || ''}
    recordType="device profile"
    state={state}
    onConfirm={handleDelete}
    useFormSubmission={false}
    onCancel={() => {
        state.confirmationOpen = false;
        state.selectedRecord = null;
    }}
/>

