<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import type { PageData } from "./$types";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { History, Settings } from "lucide-svelte";
    import SettingsForm from "./form.svelte";
    import SettingsTable from "./table.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { toast } from "svelte-sonner";
    import { enhance } from "$app/forms";

    export let data: PageData;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        "Settings",
        "General Settings"
    ];

    let loading = false;
    let jsonError: string | null = null;
    let activeTab = "settings";

    function handleRestore(event: CustomEvent<{ setting: any }>) {
        const setting = event.detail.setting;
        if (setting && setting.data) {
            data.form.data.data = setting.data;
            data.form.data.id = data.activeSettings?.id;
            activeTab = "settings";
            toast.success("Previous settings loaded. Click Save to apply.");
        }
    }

    function handleView(event: CustomEvent<{ setting: any }>) {
        const setting = event.detail.setting;
        if (setting && setting.data) {
            try {
                // Format the JSON for better viewing
                const parsed = JSON.parse(setting.data);
                setting.formattedData = JSON.stringify(parsed, null, 2);
            } catch (e) {
                setting.formattedData = setting.data || "{}";
            }
            
            // Create a modal or display the data in a readable format
            // For now, we'll just show a toast
            toast.info("Viewing historical settings", {
                description: `Updated on ${new Date(setting.updatedAt).toLocaleString()} by ${setting.updatedBy}`,
                duration: 5000
            });
        }
    }

    onMount(() => {
        // Initialize with any needed setup
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="General Settings" />
    
    <PageContent>
        <Tabs value={activeTab} onValueChange={(value) => activeTab = value} class="w-full">
            <TabsList class="mb-4">
                <TabsTrigger value="settings">
                    <Settings class="h-4 w-4 mr-2" />
                    Current Settings
                </TabsTrigger>
                <TabsTrigger value="history">
                    <History class="h-4 w-4 mr-2" />
                    Settings History
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings" class="space-y-6">
                {#if loading}
                    <Card class="w-full">
                        <CardHeader>
                            <Skeleton class="h-8 w-1/3" />
                            <Skeleton class="h-4 w-2/3" />
                        </CardHeader>
                        <CardContent>
                            <div class="space-y-4">
                                <Skeleton class="h-4 w-full" />
                                <Skeleton class="h-32 w-full" />
                            </div>
                        </CardContent>
                    </Card>
                {:else}
                    <SettingsForm form={data.form} {jsonError} />
                {/if}
            </TabsContent>
            
            <TabsContent value="history" class="space-y-6">
                <Card class="w-full">
                    <CardHeader>
                        <CardTitle>Settings History</CardTitle>
                        <CardDescription>
                            View and restore previous application settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {#if loading}
                            <div class="space-y-4">
                                <Skeleton class="h-10 w-full" />
                                <Skeleton class="h-10 w-full" />
                                <Skeleton class="h-10 w-full" />
                            </div>
                        {:else}
                            <SettingsTable 
                                settings={[
                                    ...(data.activeSettings ? [data.activeSettings] : []),
                                    ...(data.settingsHistory || [])
                                ]} 
                                on:restore={handleRestore}
                                on:view={handleView}
                            />
                        {/if}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </PageContent>
</PageContainer>
