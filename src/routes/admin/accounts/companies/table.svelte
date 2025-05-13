<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Edit, Eye } from "lucide-svelte";
    import { goto } from "$app/navigation";

    export let companies = [];
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

    // Function to format number with commas
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
</script>

<CardHeader>
    <CardTitle>Companies</CardTitle>
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
                    <TableHead>Company Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {#if companies.length === 0}
                    <TableRow>
                        <TableCell colspan="5" class="text-center">No companies found</TableCell>
                    </TableRow>
                {:else}
                    {#each companies as company}
                        <TableRow>
                            <TableCell>{company.name}</TableCell>
                            <TableCell>{company.industry}</TableCell>
                            <TableCell>{formatNumber(company.employees)}</TableCell>
                            <TableCell>{formatDate(company.createdAt)}</TableCell>
                            <TableCell class="text-right">
                                <div class="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/companies/${company.id}`)}>
                                        <Eye class="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" on:click={() => goto(`/admin/accounts/companies/${company.id}/edit`)}>
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
