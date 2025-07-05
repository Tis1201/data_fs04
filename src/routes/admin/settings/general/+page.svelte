<script lang="ts">
    import { page } from "$app/stores";
    import { onMount, onDestroy } from "svelte";
    import type { PageData } from "./$types";
    import { AdminPageLayout, AdminCard } from "$lib/components/admin";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { toast } from "svelte-sonner";
    import { enhance } from "$app/forms";
    import { Save, Settings, History, ArrowLeft } from "lucide-svelte";
    import SettingsForm from "./form.svelte";
    import SettingsTable from "./table.svelte";
    import { topMenuItems } from "$lib/stores/menuStore";
    import EnhancedMenubar from "$lib/components/ui_components_sveltekit/menubar/EnhancedMenubar.svelte";
    import { goto } from "$app/navigation";

    export let data: PageData;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["General Settings", ""]
    ];
    
    const title = "General Settings";

    let loading = false;
    let jsonError: string | null = null;
    let activeView = "settings";
    let isSubmitting = false;

    // Define menu items for the SimpleMenubar
    const menuItems = [
        {
            label: "Settings",
            icon: Settings,
            action: () => {
                activeView = "settings";
            }
        },
        {
            label: "History",
            icon: History,
            action: () => {
                activeView = "history";
            }
        }
    ];
    
    // Handle menu selection events
    function handleMenuSelect(event) {
        const item = event.detail;
        if (item.label === "Current Settings") {
            activeView = "settings";
        } else if (item.label === "Settings History") {
            activeView = "history";
        }
    }
    
    // Map view to menu label
    $: activeMenuLabel = activeView === "settings" ? "Settings" : "History";
    
    // Set menu items and active item for the top bar
    $: {
        topMenuItems.set({
            items: menuItems,
            activeItem: activeMenuLabel
        });
    }
    
    onMount(() => {
        // Set again in onMount to ensure it works after client-side navigation
        topMenuItems.set({
            items: menuItems,
            activeItem: activeMenuLabel
        });
        
        // Clean up when component is destroyed
        return () => {
            topMenuItems.set(null);
        };
    });
    
    // Also set on page change
    $: if ($page.url.pathname.includes('/admin/settings/general')) {
        topMenuItems.set({
            items: menuItems,
            activeItem: activeMenuLabel
        });
    }

    function handleRestore(event: CustomEvent<{ setting: any }>) {
        const setting = event.detail.setting;
        if (setting && setting.data) {
            data.form.data.data = setting.data;
            data.form.data.id = data.activeSettings?.id;
            activeView = "settings";
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

    // Handle form submission state
    function handleFormSubmit() {
        isSubmitting = true;
    }

    function handleFormResult(event) {
        isSubmitting = false;
        const { success, result, cancelled } = event.detail;
        
        if (cancelled) {
            // Form was cancelled due to validation errors
            console.log("Form submission cancelled");
        } else if (success) {
            console.log("Form submission successful");
        } else {
            console.log("Form submission failed", result);
        }
    }

    // Action buttons for the page header
    $: actionButtons = [
        {
            label: "Back to Settings",
            icon: ArrowLeft,
            onClick: () => goto('/admin/settings'),
            variant: "outline",
            disabled: isSubmitting
        },
        {
            label: isSubmitting ? "Saving..." : "Save Settings",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/update"]');
                if (form) {
                    handleFormSubmit();
                    form.requestSubmit();
                }
            },
            disabled: isSubmitting,
            loading: isSubmitting
        }
    ];

    onMount(() => {
        // Initialize with any needed setup
    });
</script>



<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={actionButtons}
    {loading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <AdminCard
        title="Settings Management"
        description="Manage application settings and view settings history"
        icon={Settings}
        compact={true}
    >
        <div class="p-2">
            {#if activeView === "settings"}
                {#if loading}
                    <div class="space-y-2">
                        <Skeleton class="h-8 w-1/3" />
                        <Skeleton class="h-4 w-2/3" />
                        <Skeleton class="h-64 w-full" />
                    </div>
                {:else}
                    <SettingsForm 
                        form={data.form} 
                        {jsonError} 
                        on:submit={handleFormSubmit}
                        on:result={handleFormResult}
                    />
                {/if}
            {:else if activeView === "history"}
                {#if loading}
                    <div class="space-y-2">
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
            {/if}
        </div>
    </AdminCard>
</AdminPageLayout>
