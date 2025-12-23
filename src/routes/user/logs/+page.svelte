<script lang="ts">
    import UserPageHeader from "$lib/components/user/layout/UserPageHeader.svelte";
    import LogsTable from "$lib/components/logs/LogsTable.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
</script>

<UserPageHeader
    title="System Logs"
    subtitle="View and export system logs from ClickHouse."
/>

<div class="mt-6">
    <LogsTable props={data.props} />
</div>
