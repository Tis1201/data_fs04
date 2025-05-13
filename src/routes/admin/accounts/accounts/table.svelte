<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Edit, Eye } from "lucide-svelte";
    import { goto } from "$app/navigation";

    export let accounts = [];
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

    // Function to get badge variant based on status
    function getStatusVariant(status) {
        switch (status.toLowerCase()) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'secondary';
            case 'pending':
                return 'warning';
            default:
                return 'default';
        }
    }
</script>

<CardHeader>
    <CardTitle>Accounts</CardTitle>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {#if accounts.length === 0}
                    <TableRow>
                        <TableCell colspan="5" class="text-center">No accounts found</TableCell>
                    </TableRow>
                {:else}
                    {#each accounts as account}
                        <TableRow>
                            <TableCell>{account.name}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(account.status)}>{account.status}</Badge>
                            </TableCell>
                            <TableCell>{formatDate(account.createdAt)}</TableCell>
                            <TableCell>{formatDate(account.updatedAt)}</TableCell>
                            <TableCell class="text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/accounts/${account.id}`)}>
                                        <Eye class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/accounts/${account.id}/edit`)}>
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
