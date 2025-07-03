<script lang="ts">
    import { onMount } from 'svelte';
    import DataTable from "$lib/components/custom/table/DataTable.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { ExternalLink } from "lucide-svelte";
    import { formatDate } from "$lib/utils/format";

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
                <a href="/admin/companies/sensors/${record._id}" class="block hover:underline">
                    <div class="flex flex-col">
                        <span class="font-medium text-primary">${record.name}</span>
                        <span class="text-xs text-muted-foreground font-mono">${record.type}</span>
                    </div>
                </a>
            `
        },
        {
            id: "controller",
            label: "Controller",
            sortable: false,
            render: (record: any) => record.controller ? `
                <a href="/admin/companies/sensor-controllers/${record.controllerId}" class="text-primary hover:underline">
                    ${record.controller.name}
                </a>
                <div class="text-xs text-muted-foreground font-mono mt-0.5">
                    ${record.controllerId}
                </div>
            ` : '-'
        },
        {
            id: "dataSources",
            label: "Data Sources",
            sortable: false,
            render: (record: any) => `
                <div class="text-sm">
                    ${record.dataSources?.length || 0} sources
                </div>
            `
        },
        {
            id: "lastUpdated",
            label: "Last Updated",
            sortable: true,
            sortKey: "updatedAt",
            render: (record: any) => `
                <div class="text-sm">
                    ${formatDate(record.updatedAt)}
                </div>
            `
        }
    ];
</script>

<DataTable 
    {columns} 
    {data} 
    pagination={meta.pagination} 
    sort={meta.sort} 
    on:sort
/>
