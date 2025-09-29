<script lang="ts">
    import { ArrowLeft, Edit, Users, Settings, Trash } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import type { PageData } from "./$types";

    export let data: PageData;

    $: profile = data.profile;
    
    // Safety check - if profile is undefined, show loading or error
    if (!profile) {
        console.error('Profile data is undefined:', data);
    }

    // Function to handle delete
    async function handleDelete() {
        if (!confirm(`Are you sure you want to delete the profile "${profile.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/device-profiles/${profile.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                toast.success('Device profile deleted successfully');
                goto('/admin/iot/device-profiles');
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to delete device profile');
            }
        } catch (error) {
            console.error('Error deleting profile:', error);
            toast.error('Failed to delete device profile');
        }
    }

    // Function to handle edit
    function handleEdit() {
        goto(`/admin/iot/device-profiles/${profile.id}/edit`);
    }

    // Function to handle assign devices
    function handleAssignDevices() {
        goto(`/admin/iot/device-profiles/${profile.id}/edit?tab=devices`);
    }

    function capitalizeFirstLetter(str) {
      if (!str || typeof str !== 'string' || str.length === 0) {
        return str;
      }
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Breadcrumbs
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IOT", "/admin/iot"],
        ["Device Profiles", "/admin/iot/device-profiles"],
        [profile?.name || 'Loading...', profile?.id ? `/admin/iot/device-profiles/${profile.id}` : '']
    ];
</script>

{#if !profile}
    <div class="flex items-center justify-center min-h-screen">
        <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900 mb-4">Loading Profile...</h1>
            <p class="text-gray-600">Please wait while we load the device profile details.</p>
        </div>
    </div>
{:else}
<AdminPageLayout
    title={profile?.name || 'Loading...'}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Back to Profiles",
            icon: ArrowLeft,
            onClick: () => goto('/admin/iot/device-profiles'),
            variant: "outline"
        },
        {
            label: "Edit Profile",
            icon: Edit,
            onClick: handleEdit
        },
        {
            label: "Assign Devices",
            icon: Users,
            onClick: handleAssignDevices,
            variant: "secondary"
        },
        {
            label: "Delete",
            icon: Trash,
            onClick: handleDelete,
            variant: "destructive"
        }
    ]}
    showCreateButton={false}
>
    <div class="space-y-6">
        <!-- Profile Overview -->
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Settings class="h-5 w-5" />
                    Profile Overview
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Name</label>
                        <p class="text-lg font-medium">{profile.name}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Status</label>
                        <div class="mt-1">
                            <Badge variant={profile.isActive ? "default" : "secondary"}>
                                {profile.isActive ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Created By</label>
                        <p class="text-sm">{profile.createdBy}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Created At</label>
                        <p class="text-sm">{new Date(profile.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                
                {#if profile.description}
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Description</label>
                        <p class="text-sm mt-1">{profile.description}</p>
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Settings Configuration -->
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Settings class="h-5 w-5" />
                    Settings Configuration
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if profile.settings && profile.settings.length > 0}
                    <div class="border border-gray-300 rounded-lg overflow-hidden">
                        <table class="w-full border-collapse">
                            <tbody>
                            {#each profile.settings as setting, i}
                                <tr
                                class="{i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b border-gray-300 last:border-b-0"
                                >
                                <!-- label -->
                                <td
                                    class="w-1/3 text-sm font-medium text-gray-600 border-r border-gray-300 p-4 align-top"
                                >
                                    {setting.label}
                                </td>

                                <!-- value -->
                                <td class="text-sm text-gray-900 p-4 whitespace-normal">
                                    {setting.dataType === 'password' ? '••••••' : capitalizeFirstLetter(setting.value)}
                                </td>
                                </tr>
                            {/each}
                            </tbody>
                        </table>
                    </div>
                {:else}
                    <div class="text-center py-8 text-muted-foreground">
                        No settings configured for this profile.
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Assigned Devices -->
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Users class="h-5 w-5" />
                    Assigned Devices ({profile.assignments.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if profile.assignments && profile.assignments.length > 0}
                    <div class="space-y-2">
                        {#each profile.assignments as assignment}
                            <div class="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <div class="font-medium">{assignment.device.name}</div>
                                    <div class="text-sm text-muted-foreground">
                                        {assignment.device.deviceType} • {assignment.device.status}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Badge variant={
                                        assignment.status === 'ACTIVE' ? 'default' :
                                        assignment.status === 'PENDING' ? 'secondary' : 'destructive'
                                    }>
                                        {assignment.status}
                                    </Badge>
                                    <div class="w-2 h-2 bg-gray-400 rounded-full" title="Status: {assignment.device.status}"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="text-center py-8 text-muted-foreground">
                        No devices assigned to this profile yet.
                        <div class="mt-2">
                            <Button variant="outline" size="sm" on:click={handleAssignDevices}>
                                <Users class="mr-2 h-4 w-4" />
                                Assign Devices
                            </Button>
                        </div>
                    </div>
                {/if}
            </CardContent>
        </Card>
    </div>
</AdminPageLayout>
{/if}
