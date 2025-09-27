<script lang="ts">
  import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
  import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
  import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
  import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
  import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
  import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
  import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
  import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
  import { Pencil, Trash, Play } from "lucide-svelte";
  import type { Bundle } from "@prisma/client";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { invalidate } from '$app/navigation';

  export let baseUrl: string; // "/admin/iot/bundles" or "/user/iot/bundles"
  export let records: Bundle[] = [];
  export let pagination: any;
  export let sort: any;
  export let loading: boolean = false;

  let state = { selectedRecord: null as Bundle | null, confirmationOpen: false };
  function confirmDelete(bundle: Bundle) { state.selectedRecord = bundle; state.confirmationOpen = true; }

  function getBundleStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    const map: Record<string, string> = {
      DRAFT: 'Draft', PUBLISHED: 'Published', IN_PROGRESS: 'In Progress',
      CANCELLED: 'Cancelled', COMPLETED: 'Completed', FAILED: 'Failed'
    };
    return map[status] || String(status);
  }
  function getStatusTextBorderClasses(status: string | null | undefined): string {
    if (!status) return 'text-zinc-700 border-zinc-200';
    const map: Record<string, string> = {
      DRAFT: 'text-zinc-900 border-zinc-200', PUBLISHED: 'text-zinc-700 border-zinc-300',
      IN_PROGRESS: 'text-blue-700 border-blue-300', CANCELLED: 'text-red-700 border-red-200',
      COMPLETED: 'text-green-700 border-green-200', FAILED: 'text-red-700 border-red-200'
    };
    return map[status] || 'text-zinc-800 border-zinc-200';
  }

  const columns = [
    {
      id: 'name', label: 'Name', sortable: true,
      render: (bundle: Bundle) => ({
        component: NameWithIdLink,
        props: { record: bundle, baseUrl, idField: 'id', nameField: 'name' }
      })
    },
    { id: 'version', label: 'Version', sortable: true, render: (b: Bundle) => b.version || '-' },
    { id: 'status', label: 'Status', sortable: true, render: (b: Bundle) => {
      const text = getBundleStatusLabel(b.status);
      const cls = getStatusTextBorderClasses(b.status);
      return `<span class=\"inline-block whitespace-nowrap text-xs font-medium rounded-full px-2 py-0.5 border ${cls}\">${text}</span>`;
    }},
    { id: 'scheduledAt', label: 'Scheduled', sortable: true, render: (b: Bundle) => !b.scheduledAt ? '-' : ({ component: RelativeDate, props: { date: b.scheduledAt } }) },
    { id: 'createdAt', label: 'Created', sortable: true, render: (b: Bundle) => ({ component: RelativeDate, props: { date: b.createdAt } }) },
    { id: 'actions', label: '', sortable: false, render: (b: Bundle) => {
      const actions = [
        { label: 'Edit', icon: Pencil, onClick: () => goto(`${baseUrl}/${b.id}/edit`) },
        { label: 'Delete', icon: Trash, onClick: () => confirmDelete(b), variant: 'destructive' }
      ];
      if (b.status === 'DRAFT') {
        actions.splice(1, 0, { label: 'Deploy', icon: Play, onClick: () => goto(`${baseUrl}/${b.id}/deploy`), variant: 'default' });
      }
      return { component: RecordActions, props: { items: actions } };
    } }
  ];

  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Failed', value: 'FAILED' }
  ];
</script>

<div class="space-y-4">
  <RecordDeleteDialog
    state={{ selectedRecord: state.selectedRecord, confirmationOpen: state.confirmationOpen, title: 'Delete Bundle', message: state.selectedRecord ? `Are you sure you want to delete bundle ${state.selectedRecord.name || state.selectedRecord.id}? This action cannot be undone.` : '', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }}
    useFormSubmission={true}
    action="?/delete"
    onConfirm={() => {}}
    on:close={() => { state.confirmationOpen = false; state.selectedRecord = null; }}
  />

  {#if loading}
    <LoadingSkeleton />
  {:else}
    <div class="flex flex-wrap gap-2 mb-4">
      <div class="w-1/3">
        <DebouncedTextFilter placeholder="Search bundles..." paramName="search" value={$page.url.searchParams.get('search') || ''} />
      </div>
      <PopoverFilter label="Status" options={statusOptions.filter(o => o.value !== '')} selectedValues={$page.url.searchParams.get('status') ? [$page.url.searchParams.get('status') || ''] : []} onChange={(values) => {
        const url = new URL(window.location.href);
        if (values.length && values[0]) url.searchParams.set('status', values[0]);
        else url.searchParams.delete('status');
        url.searchParams.set('page', '1');
        goto(url.toString(), { replaceState: true, noScroll: true });
      }} />
    </div>

    <DataTable props={{ records, pagination, sort }} {columns} />
  {/if}
</div>


