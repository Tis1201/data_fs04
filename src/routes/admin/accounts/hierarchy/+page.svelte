<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
    import { Plus } from "lucide-svelte";
    import type { PageData } from "./$types";
    import HierarchyTreeView from "./components/HierarchyTreeView.svelte";
    import RelationshipDetailsPanel from "./components/RelationshipDetailsPanel.svelte";
    import AddRelationshipDialog from "./components/AddRelationshipDialog.svelte";
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { toast } from 'svelte-sonner';

    export let data: PageData;

    let selectedAssignmentId: string | null = null;
    let selectedAssignment: any = null;
    let isSubmitting = false;
    let showAddDialog = false;

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Accounts", "/admin/accounts/accounts"],
        "Hierarchy"
    ];

    function handleAssignmentSelect(event: CustomEvent) {
        selectedAssignmentId = event.detail.assignmentId;
        selectedAssignment = event.detail.assignment;
    }

    function handleEdit(event: CustomEvent) {
        console.log('Edit assignment:', event.detail.assignment);
        // TODO: Open edit dialog
    }

    async function handleDelete(event: CustomEvent) {
        const assignment = event.detail.assignment;
        if (!confirm(`Are you sure you want to delete the relationship between "${assignment.parentAccount.name}" and "${assignment.childAccount.name}"?`)) {
            return;
        }

        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('assignmentId', assignment.id);
            
            const response = await fetch('?/deleteAssignment', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success('Relationship deleted successfully');
                selectedAssignmentId = null;
                selectedAssignment = null;
                await invalidateAll();
            } else {
                toast.error('Failed to delete relationship');
            }
        } catch (error) {
            toast.error('Failed to delete relationship');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleSuspend(event: CustomEvent) {
        const assignment = event.detail.assignment;
        
        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('assignmentId', assignment.id);
            
            const response = await fetch('?/suspendAssignment', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success('Relationship suspended successfully');
                await invalidateAll();
            } else {
                toast.error('Failed to suspend relationship');
            }
        } catch (error) {
            toast.error('Failed to suspend relationship');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleActivate(event: CustomEvent) {
        const assignment = event.detail.assignment;
        
        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('assignmentId', assignment.id);
            
            const response = await fetch('?/activateAssignment', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                toast.success('Relationship activated successfully');
                await invalidateAll();
            } else {
                toast.error('Failed to activate relationship');
            }
        } catch (error) {
            toast.error('Failed to activate relationship');
        } finally {
            isSubmitting = false;
        }
    }

    async function handleCreateRelationship(event: CustomEvent) {
        const { parentAccountId, childAccountId, relationshipType, validFrom, validTo } = event.detail;
        
        isSubmitting = true;
        try {
            const formData = new FormData();
            formData.append('parentAccountId', parentAccountId);
            formData.append('childAccountId', childAccountId);
            formData.append('relationshipType', relationshipType);
            if (validFrom) formData.append('validFrom', validFrom);
            if (validTo) formData.append('validTo', validTo);
            
            const response = await fetch('?/createAssignment', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                toast.success('Relationship created successfully');
                showAddDialog = false;
                await invalidateAll();
            } else {
                toast.error(result.message || 'Failed to create relationship');
            }
        } catch (error) {
            toast.error('Failed to create relationship');
        } finally {
            isSubmitting = false;
        }
    }
</script>

<AdminPageLayout
    title="Account Hierarchy"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Add Relationship",
            icon: Plus,
            onClick: () => showAddDialog = true
        }
    ]}
>
    <div class="grid gap-4 md:grid-cols-4">
        <Card>
            <CardHeader>
                <CardTitle>Parent Accounts</CardTitle>
                <CardDescription>Total with outgoing links</CardDescription>
            </CardHeader>
            <CardContent class="text-2xl font-semibold">
                {data.summary.parents}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Child Accounts</CardTitle>
                <CardDescription>Total linked as children</CardDescription>
            </CardHeader>
            <CardContent class="text-2xl font-semibold">
                {data.summary.children}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Active Links</CardTitle>
                <CardDescription>Ownership / Delegation / Visibility</CardDescription>
            </CardHeader>
            <CardContent class="text-2xl font-semibold">
                {data.summary.activeLinks}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Suspended Links</CardTitle>
                <CardDescription>Temporarily disabled</CardDescription>
            </CardHeader>
            <CardContent class="text-2xl font-semibold">
                {data.summary.suspendedLinks}
            </CardContent>
        </Card>
    </div>

    <!-- Main Content: Tree View + Details Panel -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Hierarchy Tree (Left Panel) -->
        <div class="lg:col-span-2">
            <Card class="h-fit">
                <CardHeader>
                    <CardTitle>Account Hierarchy</CardTitle>
                    <CardDescription>
                        Expandable tree showing parent → child relationships. Click on a relationship to view details.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <HierarchyTreeView 
                        assignments={data.assignments || []}
                        {selectedAssignmentId}
                        on:select={handleAssignmentSelect}
                    />
                </CardContent>
            </Card>
        </div>

        <!-- Relationship Details (Right Panel) -->
        <div class="lg:col-span-1">
            <RelationshipDetailsPanel 
                assignment={selectedAssignment}
                loading={isSubmitting}
                on:edit={handleEdit}
                on:delete={handleDelete}
                on:suspend={handleSuspend}
                on:activate={handleActivate}
            />
        </div>
    </div>
</AdminPageLayout>

<!-- Add Relationship Dialog -->
<AddRelationshipDialog 
    bind:open={showAddDialog}
    accounts={data.accounts || []}
    loading={isSubmitting}
    on:submit={handleCreateRelationship}
    on:close={() => showAddDialog = false}
/>
