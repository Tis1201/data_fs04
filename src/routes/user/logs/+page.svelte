<script lang="ts">
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import LogsTable from "$lib/components/logs/LogsTable.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
</script>

<UserPageLayout title="System Logs" crumbs={[["Logs", ""]]}>
    <LogsTable props={data.props} />
</UserPageLayout>
