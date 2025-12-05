<script lang="ts">
    import { ChevronRight, ChevronDown, Building2, Users, Eye, Crown, Handshake } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { createEventDispatcher } from "svelte";

    type Account = {
        id: string;
        name: string;
        slug?: string;
    };

    type Assignment = {
        id: string;
        relationshipType: string;
        status: string;
        parentAccount: Account;
        childAccount: Account;
        validFrom?: string | null;
        validTo?: string | null;
    };

    export let assignments: Assignment[] = [];
    export let selectedAssignmentId: string | null = null;

    const dispatch = createEventDispatcher<{
        select: { assignmentId: string; assignment: Assignment };
        expand: { accountId: string };
        collapse: { accountId: string };
    }>();

    // Build hierarchy tree structure
    $: hierarchyTree = buildHierarchyTree(assignments);
    
    let expandedNodes = new Set<string>();

    function buildHierarchyTree(assignments: Assignment[]) {
        const accountMap = new Map<string, Account & { children: Assignment[], isRoot: boolean }>();
        const childAccountIds = new Set<string>();

        // Initialize all accounts
        assignments.forEach(assignment => {
            const { parentAccount, childAccount } = assignment;
            
            if (!accountMap.has(parentAccount.id)) {
                accountMap.set(parentAccount.id, { ...parentAccount, children: [], isRoot: true });
            }
            if (!accountMap.has(childAccount.id)) {
                accountMap.set(childAccount.id, { ...childAccount, children: [], isRoot: true });
            }
            
            childAccountIds.add(childAccount.id);
        });

        // Mark child accounts as non-root
        childAccountIds.forEach(id => {
            const account = accountMap.get(id);
            if (account) account.isRoot = false;
        });

        // Build parent-child relationships
        assignments.forEach(assignment => {
            const parent = accountMap.get(assignment.parentAccount.id);
            if (parent) {
                parent.children.push(assignment);
            }
        });

        // Return only root accounts (those that are not children of others)
        return Array.from(accountMap.values()).filter(account => account.isRoot);
    }

    function toggleExpanded(accountId: string) {
        if (expandedNodes.has(accountId)) {
            expandedNodes.delete(accountId);
            dispatch('collapse', { accountId });
        } else {
            expandedNodes.add(accountId);
            dispatch('expand', { accountId });
        }
        expandedNodes = expandedNodes; // Trigger reactivity
    }

    function selectAssignment(assignment: Assignment) {
        dispatch('select', { assignmentId: assignment.id, assignment });
    }

    function getRelationshipIcon(type: string) {
        switch (type) {
            case 'OWNERSHIP': return Crown;
            case 'DELEGATION': return Handshake;
            case 'VISIBILITY_ONLY': return Eye;
            default: return Users;
        }
    }

    function getRelationshipColor(type: string) {
        switch (type) {
            case 'OWNERSHIP': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'DELEGATION': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'VISIBILITY_ONLY': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    }

    function getStatusColor(status: string) {
        switch (status) {
            case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
            case 'SUSPENDED': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    }
</script>

<div class="space-y-2">
    {#if hierarchyTree.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <Building2 class="h-12 w-12 text-gray-400 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">No Account Hierarchy</h3>
            <p class="text-sm text-gray-500 mb-4">Create relationships between accounts to see the hierarchy tree.</p>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
                <h4 class="font-medium text-blue-900 mb-2">Get Started</h4>
                <p class="text-sm text-blue-800 mb-3">
                    Click the "Add Relationship" button above to create your first parent-child account relationship.
                </p>
                <div class="text-xs text-blue-700 space-y-1">
                    <div><strong>Ownership:</strong> Full administrative rights</div>
                    <div><strong>Delegation:</strong> Limited admin (no billing/users)</div>
                    <div><strong>Visibility:</strong> View-only access</div>
                </div>
            </div>
        </div>
    {:else}
        {#each hierarchyTree as rootAccount}
            <div class="border rounded-lg bg-white">
                <!-- Root Account -->
                <div class="p-3 border-b bg-gray-50">
                    <div class="flex items-center gap-2">
                        {#if rootAccount.children.length > 0}
                            <Button
                                variant="ghost"
                                size="sm"
                                class="h-6 w-6 p-0"
                                on:click={() => toggleExpanded(rootAccount.id)}
                            >
                                {#if expandedNodes.has(rootAccount.id)}
                                    <ChevronDown class="h-4 w-4" />
                                {:else}
                                    <ChevronRight class="h-4 w-4" />
                                {/if}
                            </Button>
                        {:else}
                            <div class="w-6"></div>
                        {/if}
                        
                        <Building2 class="h-4 w-4 text-gray-600" />
                        <span class="font-medium text-gray-900">{rootAccount.name}</span>
                        <Badge variant="outline" class="text-xs">Root</Badge>
                        
                        {#if rootAccount.children.length > 0}
                            <Badge variant="secondary" class="text-xs ml-auto">
                                {rootAccount.children.length} child{rootAccount.children.length !== 1 ? 'ren' : ''}
                            </Badge>
                        {/if}
                    </div>
                </div>

                <!-- Children (when expanded) -->
                {#if expandedNodes.has(rootAccount.id) && rootAccount.children.length > 0}
                    <div class="divide-y">
                        {#each rootAccount.children as assignment}
                            {@const RelationshipIcon = getRelationshipIcon(assignment.relationshipType)}
                            <button
                                class="group w-full p-3 text-left hover:bg-gray-50 transition-all duration-200 {selectedAssignmentId === assignment.id ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm' : 'hover:shadow-sm'}"
                                on:click={() => selectAssignment(assignment)}
                            >
                                <div class="flex items-center gap-3">
                                    <div class="w-6 flex justify-center">
                                        <div class="w-px h-4 bg-gray-300"></div>
                                    </div>
                                    
                                    <div class="flex items-center gap-2 flex-1">
                                        <RelationshipIcon class="h-4 w-4 text-gray-500" />
                                        <span class="font-medium">{assignment.childAccount.name}</span>
                                        <span class="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to manage</span>
                                        
                                        <div class="flex items-center gap-2 ml-auto">
                                            <Badge 
                                                variant="outline" 
                                                class="text-xs {getRelationshipColor(assignment.relationshipType)}"
                                            >
                                                {assignment.relationshipType.replace('_', ' ')}
                                            </Badge>
                                            
                                            <Badge 
                                                variant="outline" 
                                                class="text-xs {getStatusColor(assignment.status)}"
                                            >
                                                {assignment.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                
                                {#if assignment.validFrom || assignment.validTo}
                                    <div class="mt-2 ml-9 text-xs text-gray-500">
                                        Valid: {assignment.validFrom || '∞'} → {assignment.validTo || '∞'}
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    {/if}
</div>
