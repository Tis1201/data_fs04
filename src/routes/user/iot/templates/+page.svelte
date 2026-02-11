<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import {
        Button,
        InputField,
        DataTable,
        ActionMenu,
        ConfirmModal
    } from '$lib/design-system/components';
    import type { SortState, ColumnDef } from '$lib/design-system/components';
    import { Search, Plus, ChevronDown } from 'lucide-svelte';
    import type { PageData } from './$types';
    import type { TemplateRow } from './+page.server';
    import { toast } from '$lib/stores/alertToast';
    import { invalidate } from '$app/navigation';
    import AddTemplateModal from '$lib/components/ui_components_sveltekit/templates/AddTemplateModal.svelte';
    import EditTemplateModal from '$lib/components/ui_components_sveltekit/templates/EditTemplateModal.svelte';

    export let data: PageData;

    $: templates = (data.templates || []) as TemplateRow[];
    $: availableSensors = (data.availableSensors || []) as { id: string; name: string; mac?: string }[];
    $: meta = data.meta || {};
    $: serverPagination = meta.pagination || {};
    $: serverSort = meta.sort || { field: 'lastUpdatedOn', order: 'desc' };

    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    // Add Template dropdown
    let addMenuOpen = false;
    let addButtonRef: HTMLDivElement;

    // Modals: Duplicate, Delete, Set as Default
    let duplicateTarget: TemplateRow | null = null;
    let showDuplicateModal = false;
    let duplicateLoading = false;
    let deleteTarget: TemplateRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;
    let setDefaultTarget: TemplateRow | null = null;
    let showSetDefaultModal = false;
    let setDefaultLoading = false;

    // Add Template modal (Alert / Configuration)
    let showAddTemplateModal = false;
    let addTemplateType: 'alert' | 'configuration' = 'alert';

    // Edit Template modal
    let showEditTemplateModal = false;
    let editTarget: TemplateRow | null = null;
    let editTemplateLoading = false;

    // Edit Template confirm modal
    let showEditConfirmModal = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pendingEditData: any = null;

    $: pagination = {
        page: serverPagination.page ?? 1,
        pageSize: serverPagination.per_page ?? 10,
        totalItems: serverPagination.total_records ?? 0,
        totalPages: serverPagination.total_pages ?? 0
    };

    let sort: SortState = { field: 'lastUpdatedOn', direction: 'desc' };
    $: sort = {
        field: serverSort?.field || 'lastUpdatedOn',
        direction: (serverSort?.order as 'asc' | 'desc') || 'desc'
    };

    const basePath = '/user/iot/templates';

    function handleSort(event: CustomEvent<SortState>) {
        const next = event.detail;
        const url = new URL($page.url);
        if (next.field && next.direction) {
            url.searchParams.set('sort', next.field);
            url.searchParams.set('order', next.direction);
        } else {
            url.searchParams.delete('sort');
            url.searchParams.delete('order');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    // Debounced search
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const currentSearch = $page.url.searchParams.get('search') || '';
            const newSearch = searchValue.trim();
            if (newSearch === currentSearch) return;
            const url = new URL($page.url);
            if (newSearch) url.searchParams.set('search', newSearch);
            else url.searchParams.delete('search');
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { noScroll: true });
        }, 500);
    }

    function openDuplicateModal(row: TemplateRow) {
        duplicateTarget = row;
        showDuplicateModal = true;
    }

    function closeDuplicateModal() {
        showDuplicateModal = false;
        duplicateTarget = null;
    }

    async function confirmDuplicate() {
        if (!duplicateTarget) return;
        duplicateLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', duplicateTarget.id);
            const res = await fetch('?/duplicate', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result?.success === false) {
                toast.error(result?.error || 'Unable to duplicate template. Please try again!');
                return;
            }
            toast.success('Template duplicated successfully!');
            closeDuplicateModal();
            await invalidate('app:userTemplates');
        } catch {
            toast.error('Unable to duplicate template. Please try again!');
        } finally {
            duplicateLoading = false;
        }
    }

    function openDeleteModal(row: TemplateRow) {
        deleteTarget = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        deleteTarget = null;
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', deleteTarget.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result?.success === false) {
                toast.error(result?.error || 'Unable to delete template. Please try again!');
                return;
            }
            toast.success('Template deleted successfully!');
            closeDeleteModal();
            await invalidate('app:userTemplates');
        } catch {
            toast.error('Unable to delete template. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    function openSetDefaultModal(row: TemplateRow) {
        setDefaultTarget = row;
        showSetDefaultModal = true;
    }

    function closeSetDefaultModal() {
        showSetDefaultModal = false;
        setDefaultTarget = null;
    }

    async function confirmSetDefault() {
        if (!setDefaultTarget) return;
        setDefaultLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', setDefaultTarget.id);
            const res = await fetch('?/setDefault', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result?.success === false) {
                toast.error(result?.error || 'Unable to set template as default. Please try again!');
                return;
            }
            toast.success('Template set as default successfully!');
            closeSetDefaultModal();
            await invalidate('app:userTemplates');
        } catch {
            toast.error('Unable to set template as default. Please try again!');
        } finally {
            setDefaultLoading = false;
        }
    }

    function onAddMenuSelect(event: CustomEvent<{ id: string; label: string }>) {
        addMenuOpen = false;
        const id = event.detail?.id;
        if (id === 'alert') {
            addTemplateType = 'alert';
            showAddTemplateModal = true;
        } else if (id === 'config') {
            addTemplateType = 'configuration';
            showAddTemplateModal = true;
        }
    }

    function openEditModal(row: TemplateRow) {
        editTarget = row;
        showEditTemplateModal = true;
    }

    function closeEditModal() {
        showEditTemplateModal = false;
        editTarget = null;
    }

    // Prepare edit template data for modal
    $: editTemplateData = editTarget ? {
        id: editTarget.id,
        name: editTarget.name,
        type: editTarget.type as 'Alert' | 'Configuration',
        description: editTarget.description ?? null,
        config: editTarget.config ?? null,
        assignedSensors: editTarget.assignedSensorsList ?? []
    } : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleEditTemplate(event: CustomEvent<any>) {
        // Store pending data and show confirm modal
        pendingEditData = event.detail;
        showEditConfirmModal = true;
    }

    function closeEditConfirmModal() {
        showEditConfirmModal = false;
    }

    async function confirmEditTemplate() {
        if (!pendingEditData) return;
        
        editTemplateLoading = true;
        try {
            const detail = pendingEditData;
            const fd = new FormData();
            fd.set('id', detail.id);
            fd.set('name', detail.name);
            fd.set('description', detail.description || '');
            // Alert templates: send alertSettings; Configuration: send trackingArea, zones, deviceSettings
            if (detail.type === 'alert' && detail.alertSettings) {
                fd.set('alertSettings', JSON.stringify(detail.alertSettings));
                fd.set('trackingArea', JSON.stringify(detail.trackingArea || {}));
                fd.set('zones', JSON.stringify(detail.zones || []));
                fd.set('deviceSettings', JSON.stringify(detail.deviceSettings || {}));
            } else {
                fd.set('trackingArea', JSON.stringify({
                    xMin: parseFloat(detail.trackingArea?.xMin) || 0,
                    xMax: parseFloat(detail.trackingArea?.xMax) || 0,
                    yMin: parseFloat(detail.trackingArea?.yMin) || 0,
                    yMax: parseFloat(detail.trackingArea?.yMax) || 0
                }));
                fd.set('zones', JSON.stringify(detail.zones || []));
                fd.set('deviceSettings', JSON.stringify(detail.deviceSettings || {}));
            }
            fd.set('selectedSensors', JSON.stringify(detail.selectedSensors || []));

            const res = await fetch('?/update', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result?.success === false) {
                toast.error(result?.error || 'Unable to update template. Please try again!');
                return;
            }

            toast.success('Template updated successfully!');
            showEditConfirmModal = false;
            closeEditModal();
            pendingEditData = null;
            await invalidate('app:userTemplates');
        } catch {
            toast.error('Unable to update template. Please try again!');
        } finally {
            editTemplateLoading = false;
        }
    }

    interface AddTemplatePayload {
        name: string;
        description: string;
        type: string;
        trackingArea: { xMin: string; xMax: string; yMin: string; yMax: string };
        zones: { id: string; name: string; active: boolean }[];
        deviceSettings: {
            deviceMode: string;
            timezone: string;
            pathTracking: boolean;
            dwellThreshold: number;
        };
        selectedSensors: { id: string; name: string; mac?: string }[];
    }

    let addTemplateLoading = false;

    async function handleAddTemplate(event: CustomEvent<AddTemplatePayload>) {
        const payload = event.detail;

        addTemplateLoading = true;
        try {
            const fd = new FormData();
            fd.set('name', payload.name);
            fd.set('description', payload.description || '');
            fd.set('type', payload.type);
            fd.set('trackingArea', JSON.stringify(payload.trackingArea));
            fd.set('zones', JSON.stringify(payload.zones));
            fd.set('deviceSettings', JSON.stringify(payload.deviceSettings));
            fd.set('selectedSensors', JSON.stringify(payload.selectedSensors));

            const res = await fetch('?/create', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result?.success === false) {
                toast.error(result?.error || 'Unable to create template. Please try again!');
                return;
            }

            toast.success('Template created successfully!');
            showAddTemplateModal = false;
            await invalidate('app:userTemplates');
        } catch {
            toast.error('Unable to create template. Please try again!');
        } finally {
            addTemplateLoading = false;
        }
    }

    const addMenuItems = [
        { id: 'alert', label: 'Alert Template' },
        { id: 'config', label: 'Configuration Template' }
    ];

    function escapeHtml(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    let columns: ColumnDef<TemplateRow>[] = [
        {
            id: 'name',
            header: 'Template Name',
            accessor: (row: TemplateRow) => row.name ?? '',
            type: 'custom',
            sortable: true,
            width: '240px',
            render: (_value: unknown, row: TemplateRow) => {
                const name = row.name || '—';
                const star = row.isDefault
                    ? '<span class="inline-flex align-middle mr-1" style="color: var(--ds-color-warning-500);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>'
                    : '';
                const link = `<a href="${basePath}/${row.id}" class="text-[14px] font-medium text-[var(--ds-text-link)] hover:underline">${escapeHtml(name)}</a>`;
                return `<div class="flex items-center">${star}${link}</div>`;
            }
        },
        {
            id: 'type',
            header: 'Type',
            accessor: (row: TemplateRow) => row.type ?? '',
            type: 'text',
            width: '140px'
        },
        {
            id: 'assignedSensors',
            header: 'Assigned Sensors',
            accessor: (row: TemplateRow) => row.assignedSensors ?? 0,
            type: 'number',
            width: '140px'
        },
        {
            id: 'lastUpdatedOn',
            header: 'Last Updated On',
            accessor: (row: TemplateRow) => row.lastUpdatedOn ?? '',
            type: 'datetime',
            sortable: true,
            width: '180px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '80px',
            getMenuActions: (row: TemplateRow) => {
                const actions: { id: string; label: string; color?: 'danger'; onClick?: () => void }[] = [
                    {
                        id: 'view',
                        label: 'View',
                        onClick: () => goto(`${basePath}/${row.id}`)
                    },
                    {
                        id: 'edit',
                        label: 'Edit',
                        onClick: () => openEditModal(row)
                    },
                    {
                        id: 'duplicate',
                        label: 'Duplicate',
                        onClick: () => openDuplicateModal(row)
                    }
                ];
                if (!row.isDefault) {
                    actions.push({
                        id: 'setDefault',
                        label: 'Set as Default',
                        onClick: () => openSetDefaultModal(row)
                    });
                }
                actions.push({
                    id: 'delete',
                    label: 'Delete',
                    color: 'danger',
                    onClick: () => openDeleteModal(row)
                });
                return actions;
            }
        }
    ];
</script>

<svelte:head>
    <title>Templates - Data Realities</title>
</svelte:head>

<div class="templates-page flex flex-col" style="padding: 24px; gap: 16px;">
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <div style="width: 320px; height: 48px;">
            <InputField
                type="search"
                placeholder="Search by Template name"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>
        <div style="flex: 1;"></div>
        <div
            class="add-template-trigger flex items-center"
            role="button"
            tabindex="0"
            bind:this={addButtonRef}
            on:click={() => (addMenuOpen = !addMenuOpen)}
            on:keydown={(e) => e.key === 'Enter' && (addMenuOpen = !addMenuOpen)}
        >
            <Button
                variant="filled"
                color="primary"
                size="lg"
                iconLeft={true}
                iconRight={true}
            >
                <Plus size={20} slot="icon-left" />
                Add Template
                <ChevronDown size={20} slot="icon-right" />
            </Button>
        </div>
        <ActionMenu
            items={addMenuItems}
            triggerIcon="none"
            showTrigger={false}
            bind:open={addMenuOpen}
            externalTriggerRef={addButtonRef}
            align="right"
            width="200px"
            on:close={() => (addMenuOpen = false)}
            on:select={onAddMenuSelect}
        />
    </div>

    <div class="w-full">
        <DataTable
            columns={columns}
            data={templates}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            pagination={pagination}
            loading={false}
            emptyMessage="No templates found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
        />
    </div>
</div>

<!-- Add Template modal (Alert / Configuration) -->
<AddTemplateModal
    bind:open={showAddTemplateModal}
    templateType={addTemplateType}
    on:close={() => (showAddTemplateModal = false)}
    on:add={handleAddTemplate}
/>

<!-- Edit Template modal -->
<EditTemplateModal
    bind:open={showEditTemplateModal}
    template={editTemplateData}
    availableSensors={availableSensors}
    on:close={closeEditModal}
    on:save={handleEditTemplate}
/>

<!-- Edit Template Confirm - ConfirmModal (info) -->
<ConfirmModal
    open={showEditConfirmModal}
    title="Template Changes"
    description="Are you sure you want to update this template? By publish the changes will be auto updated to all assigned sensors"
    cancelText="Skip later"
    confirmText="Save & Publish"
    type="info"
    confirmLoading={editTemplateLoading}
    confirmDisabled={editTemplateLoading}
    on:close={closeEditConfirmModal}
    on:confirm={confirmEditTemplate}
/>

<!-- Duplicate Template - ConfirmModal (info) -->
<ConfirmModal
    open={showDuplicateModal}
    title="Duplicate Template"
    description="Do you want to proceed with the duplicate? The new template will use the same title and settings."
    cancelText="Cancel"
    confirmText="Duplicate"
    type="info"
    confirmLoading={duplicateLoading}
    confirmDisabled={duplicateLoading}
    on:close={closeDuplicateModal}
    on:confirm={confirmDuplicate}
/>

<!-- Delete Template - ConfirmModal (warning) -->
<ConfirmModal
    open={showDeleteModal}
    title="Delete Template"
    description="Are you sure you want to delete this template? This action can not be reverse."
    cancelText="Cancel"
    confirmText="Delete"
    type="warning"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDelete}
/>

<!-- Set Template as Default - ConfirmModal (info) -->
<ConfirmModal
    open={showSetDefaultModal}
    title="Set Template as Default"
    description="Are you sure you want to set this template as default? Each template type supports only one default. Setting this will replace the current default."
    cancelText="Cancel"
    confirmText="Set as Default"
    type="info"
    confirmLoading={setDefaultLoading}
    confirmDisabled={setDefaultLoading}
    on:close={closeSetDefaultModal}
    on:confirm={confirmSetDefault}
/>
