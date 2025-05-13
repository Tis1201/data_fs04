<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Edit, Eye, Users } from "lucide-svelte";
    import { goto } from "$app/navigation";

    export let groups = [];
    export let meta = {};
    export let loading = false;

    // Function to format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<CardHeader>
    <CardTitle>Groups</CardTitle>
</CardHeader>
<CardContent>
    {#if loading}
        <div class="space-y-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
        </div>
    {:else}
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {#if groups.length === 0}
                    <TableRow>
                        <TableCell colspan="5" class="text-center">No groups found</TableCell>
                    </TableRow>
                {:else}
                    {#each groups as group}
                        <TableRow>
                            <TableCell>{group.name}</TableCell>
                            <TableCell>{group.members}</TableCell>
                            <TableCell>{group.permissions}</TableCell>
                            <TableCell>{formatDate(group.createdAt)}</TableCell>
                            <TableCell class="text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/groups/${group.id}/members`)}>
                                        <Users class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/groups/${group.id}`)}>
                                        <Eye class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/groups/${group.id}/edit`)}>
                                        <Edit class="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    {/each}
                {/if}
            </TableBody>
        </Table>
    {/if}
</CardContent>
