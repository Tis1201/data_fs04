<script lang="ts">
    import ResourcesTable from "$lib/components/resources/ResourcesTable.svelte";
    import type {Resource} from "@prisma/client";

    // Props for DataTable component
    export let props = {
        records: [] as Resource[],
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
</script>

<ResourcesTable {props} baseUrl="/user/resources" />
