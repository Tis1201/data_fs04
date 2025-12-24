<script lang="ts">
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import { SensorDataTable } from "$lib/components/sensor-data";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import * as Tabs from "$lib/components/ui/tabs";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";

    // Active tab from URL or default
    $: activeTab = $page.url.searchParams.get("tab") || "sessions";

    function handleTabChange(value: string) {
        const url = new URL($page.url);
        url.searchParams.set("tab", value);
        // Reset pagination when switching tabs
        url.searchParams.delete("page");
        goto(url.toString(), { replaceState: true, noScroll: true });
    }
</script>

<UserPageLayout
    title="Radar Analytics"
    crumbs={[
        ["Analytics", "#"],
        ["Radar", ""],
    ]}
>
    <div class="space-y-4">
        <!-- Tabs for Session vs Path data -->
        <Tabs.Root
            value={activeTab}
            onValueChange={(v) => v && handleTabChange(v)}
        >
            <Tabs.List class="grid w-full max-w-md grid-cols-2">
                <Tabs.Trigger value="sessions">Sessions</Tabs.Trigger>
                <Tabs.Trigger value="paths">Path Data</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="sessions" class="mt-4">
                <SensorDataTable dataType="radar_session" />
            </Tabs.Content>

            <Tabs.Content value="paths" class="mt-4">
                <SensorDataTable dataType="radar_path" />
            </Tabs.Content>
        </Tabs.Root>
    </div>
</UserPageLayout>
