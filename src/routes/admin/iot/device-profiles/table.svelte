<script lang="ts">
    import DeviceProfilesTable from "$lib/components/shared/DeviceProfilesTable.svelte";

    // Props for DataTable component
    export let props = {
        records: [],
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

<DeviceProfilesTable {props} context="admin" />
