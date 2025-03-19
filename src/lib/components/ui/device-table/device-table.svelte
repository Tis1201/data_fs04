<script lang="ts">
    import { onMount } from 'svelte';
    import DataTable from "$lib/components/custom/table/DataTable.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { ExternalLink } from "lucide-svelte";
    import { formatDate } from "$lib/utils";

    export let data: any[] = [];
    export let meta: any = {
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: 'updatedAt',
            order: 'desc' as const
        }
    };

    let mounted = false;
    onMount(() => {
        mounted = true;
    });

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            sortKey: "name",
            render: (record: any) => `
                <a href="/admin/companies/devices/${record.id}" class="block hover:underline">
                    <div class="flex flex-col">
                        <span class="font-medium text-primary">${record.name}</span>
                        <span class="text-xs text-muted-foreground font-mono">${record.macAddr}</span>
                    </div>
                </a>
            `
        },
        {
            id: "account",
            label: "Account",
            sortable: false,
            render: (record: any) => record.account ? `
                <a href="/admin/companies/accounts/${record.account.id}" class="text-primary hover:underline">
                    ${record.account.name}
                </a>
                <div class="text-xs text-muted-foreground font-mono mt-0.5">
                    ${record.ownerId}
                </div>
            ` : '<span class="text-muted-foreground">-</span>'
        },
        {
            id: "os",
            label: "OS",
            sortable: true,
            sortKey: "os",
            render: (record: any) => record.os || '-'
        },
        {
            id: "connection",
            label: "Connection",
            sortable: true,
            sortKey: "connection",
            render: (record: any) => `
                ${record.connection === 'connected' 
                    ? '<div class="inline-flex"><span class="bg-success/20 text-success rounded px-2 py-0.5 text-xs font-medium">Connected</span></div>'
                    : '<div class="inline-flex"><span class="bg-destructive/20 text-destructive rounded px-2 py-0.5 text-xs font-medium">Disconnected</span></div>'
                }
            `
        },
        {
            id: "lastConnected",
            label: "Last Connected",
            sortable: true,
            sortKey: "lastConnected",
            render: (record: any) => formatDate(record.lastConnected)
        },
        {
            id: "lastDisconnected",
            label: "Last Disconnected",
            sortable: true,
            sortKey: "lastDisconnected",
            render: (record: any) => formatDate(record.lastDisconnected)
        }
    ];

    function handleSort(event: CustomEvent<{ field: string; order: "asc" | "desc" }>) {
        meta.sort = event.detail;
    }
</script>

{#if mounted}
    <div class="relative">
        <DataTable
            {data}
            {columns}
            pagination={meta.pagination}
            sort={meta.sort}
            on:sort={handleSort}
        />
    </div>
{/if}
