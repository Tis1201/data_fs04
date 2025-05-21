<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Plus, MoreHorizontal, UserPlus, Mail, Shield } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu";
    
    // Define page metadata
    const pageTitle = "User Management";
    const pageDescription = "Manage users and permissions";
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Users", ""]
    ] as [string, string][];
    
    // Mock data for the placeholder
    const users = [
        { id: 1, name: "John Doe", email: "john.doe@example.com", role: "Admin", status: "active", lastActive: "2 hours ago" },
        { id: 2, name: "Jane Smith", email: "jane.smith@example.com", role: "User", status: "active", lastActive: "1 day ago" },
        { id: 3, name: "Robert Johnson", email: "robert.j@example.com", role: "User", status: "inactive", lastActive: "2 weeks ago" },
        { id: 4, name: "Emily Davis", email: "emily.d@example.com", role: "Manager", status: "active", lastActive: "3 hours ago" },
        { id: 5, name: "Michael Wilson", email: "michael.w@example.com", role: "User", status: "pending", lastActive: "Never" },
    ];
    
    // Get status badge class
    function getStatusClass(status) {
        switch(status) {
            case 'active': return 'bg-green-500';
            case 'inactive': return 'bg-gray-400';
            case 'pending': return 'bg-amber-500';
            default: return 'bg-gray-400';
        }
    }
    
    // Get role badge variant
    function getRoleVariant(role) {
        switch(role) {
            case 'Admin': return 'destructive';
            case 'Manager': return 'default';
            case 'User': return 'secondary';
            default: return 'outline';
        }
    }
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add User",
            icon: UserPlus,
            onClick: () => goto('/user/settings/users/new')
        }
    ]}
>
    <UserCard 
        title="Team Members"
        description="Manage your team members and their access permissions"
        icon={Shield}
    >
        <div class="space-y-4">
            <!-- Users table -->
            <div class="rounded-md border overflow-hidden">
                {#if users.length > 0}
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-muted/50">
                                    <th class="text-left p-3 font-medium">Name</th>
                                    <th class="text-left p-3 font-medium">Email</th>
                                    <th class="text-left p-3 font-medium">Role</th>
                                    <th class="text-left p-3 font-medium">Status</th>
                                    <th class="text-left p-3 font-medium">Last Active</th>
                                    <th class="text-right p-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                {#each users as user}
                                    <tr class="hover:bg-muted/50">
                                        <td class="p-3 whitespace-nowrap font-medium">{user.name}</td>
                                        <td class="p-3 whitespace-nowrap">{user.email}</td>
                                        <td class="p-3 whitespace-nowrap">
                                            <Badge variant={getRoleVariant(user.role)}>{user.role}</Badge>
                                        </td>
                                        <td class="p-3 whitespace-nowrap">
                                            <div class="flex items-center">
                                                <span class={`h-2 w-2 rounded-full mr-2 ${getStatusClass(user.status)}`}></span>
                                                <span>{user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span>
                                            </div>
                                        </td>
                                        <td class="p-3 whitespace-nowrap text-muted-foreground">{user.lastActive}</td>
                                        <td class="p-3 whitespace-nowrap text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" class="h-8 w-8">
                                                        <MoreHorizontal class="h-4 w-4" />
                                                        <span class="sr-only">Open menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem on:click={() => goto(`/user/settings/users/${user.id}`)}>
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem on:click={() => alert(`Send invitation to ${user.email}`)}>
                                                        Send Invitation
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem on:click={() => alert(`Reset password for ${user.name}`)}>
                                                        Reset Password
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {:else}
                    <div class="text-center p-8 text-muted-foreground">
                        <p>No users found</p>
                        <p class="text-sm mt-1">Add team members to get started</p>
                    </div>
                {/if}
            </div>
            
            <!-- Pagination placeholder -->
            <div class="flex justify-between items-center">
                <div class="text-sm text-muted-foreground">
                    Showing {users.length} users
                </div>
                <div class="flex space-x-2">
                    <Button variant="outline" size="sm" disabled>Previous</Button>
                    <Button variant="outline" size="sm">Next</Button>
                </div>
            </div>
            
            <!-- Help text -->
            <p class="text-sm text-muted-foreground">
                Need help with user permissions? <a href="/user/help/permissions" class="text-primary hover:underline">View documentation</a>
            </p>
        </div>
    </UserCard>
</UserPageLayout>
