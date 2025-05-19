<script lang="ts">
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Pencil, User } from "lucide-svelte";
    
    const pageCrumbs = [
        ["User", "/user"],
        "Profile"
    ];
    
    const title = "My Profile";
    
    // Sample user data - in a real implementation, this would come from the page data
    let userData = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1 (555) 123-4567",
        role: "Standard User"
    };
    
    let editMode = false;
    
    // Action button for the page layout
    const actionButtons = [
        {
            label: editMode ? 'Cancel Edit' : 'Edit Profile',
            icon: Pencil,
            onClick: () => editMode = !editMode,
            variant: "outline"
        }
    ];
</script>

<UserPageLayout 
    title={title} 
    crumbs={pageCrumbs}
    {actionButtons}
>
    <UserCard 
        title="User Information" 
        description="View and manage your profile information"
        icon={User}
    >
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                    <Label for="name">Full Name</Label>
                    {#if editMode}
                        <Input id="name" value={userData.name} />
                    {:else}
                        <p class="text-sm font-medium">{userData.name}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="email">Email Address</Label>
                    {#if editMode}
                        <Input id="email" value={userData.email} />
                    {:else}
                        <p class="text-sm font-medium">{userData.email}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="phone">Phone Number</Label>
                    {#if editMode}
                        <Input id="phone" value={userData.phone} />
                    {:else}
                        <p class="text-sm font-medium">{userData.phone}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="role">User Role</Label>
                    <p class="text-sm font-medium">{userData.role}</p>
                </div>
            </div>
            
            {#if editMode}
                <div class="flex justify-end gap-2">
                    <Button variant="outline" on:click={() => editMode = false}>Cancel</Button>
                    <Button>Save Changes</Button>
                </div>
            {/if}
        </div>
    </UserCard>
</UserPageLayout>
