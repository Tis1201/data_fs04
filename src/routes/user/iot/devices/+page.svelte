<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Plus } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    
    // Define page metadata
    const pageTitle = "My IoT Devices";
    const pageDescription = "View and manage your connected IoT devices";
    
    // Define breadcrumbs - using the correct format for crumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["IoT", "/user/iot"],
        ["Devices", ""]
    ] as [string, string][];
    
    // Mock data for the placeholder
    const devices = [
        { id: 1, name: "Living Room Sensor", type: "Temperature", status: "online", lastSeen: "2 minutes ago" },
        { id: 2, name: "Front Door Camera", type: "Camera", status: "offline", lastSeen: "1 hour ago" },
        { id: 3, name: "Smart Thermostat", type: "Thermostat", status: "online", lastSeen: "5 minutes ago" },
    ];
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Device",
            icon: Plus,
            onClick: () => goto('/user/iot/devices/new')
        }
    ]}
>
    <div class="flex flex-col space-y-4">        
        <!-- Devices list -->
        <div class="rounded-md border
            {devices.length === 0 ? 'flex items-center justify-center h-32' : ''}">
            {#if devices.length > 0}
                <div class="divide-y">
                    {#each devices as device}
                        <div class="p-4 hover:bg-muted/50 cursor-pointer">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h3 class="font-medium">{device.name}</h3>
                                    <p class="text-sm text-muted-foreground">{device.type}</p>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class={`h-2.5 w-2.5 rounded-full ${
                                        device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                                    }`}></span>
                                    <span class="text-sm text-muted-foreground">
                                        {device.status === 'online' ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="text-center text-muted-foreground">
                    <p>No devices found</p>
                    <p class="text-sm mt-1">Add your first device to get started</p>
                </div>
            {/if}
        </div>
        
        <!-- Help text -->
        <p class="text-sm text-muted-foreground">
            Having trouble connecting a device? <a href="/user/help/iot" class="text-primary hover:underline">Get help</a>
        </p>
    </div>
</UserPageLayout>
