<script lang="ts">
    import { ChevronRight, ChevronDown } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";

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

    export let parentAccountId: string;
    export let assignments: Assignment[] = [];
    export let selectedAssignmentId: string | null = null;
    export let getRelationshipIcon: (type: string) => typeof import("svelte").SvelteComponent;
    export let getRelationshipColor: (type: string) => string;
    export let getStatusColor: (status: string) => string;
    export let selectAssignment: (assignment: Assignment) => void;
    export let expandedNodes: Set<string>;
    export let toggleExpanded: (accountId: string) => void;

    $: children = assignments.filter((a) => a.parentAccount.id === parentAccountId);

    function hasChildren(accountId: string) {
        return assignments.some((a) => a.parentAccount.id === accountId);
    }
</script>

{#if children.length}
    <div class="divide-y">
        {#each children as assignment}
            {@const RelationshipIcon = getRelationshipIcon(assignment.relationshipType)}
            <div class="pl-4 border-l border-gray-200">
                <div class="flex items-center gap-2">
                    {#if hasChildren(assignment.childAccount.id)}
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-6 w-6 p-0"
                            on:click={() => toggleExpanded(assignment.childAccount.id)}
                        >
                            {#if expandedNodes.has(assignment.childAccount.id)}
                                <ChevronDown class="h-4 w-4" />
                            {:else}
                                <ChevronRight class="h-4 w-4" />
                            {/if}
                        </Button>
                    {:else}
                        <div class="w-6"></div>
                    {/if}

                    <button
                        class="group flex-1 p-3 text-left hover:bg-blue-50 hover:border-l-2 hover:border-l-blue-300 transition-all duration-200 cursor-pointer {selectedAssignmentId === assignment.id ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm' : 'hover:shadow-sm border-l-2 border-l-transparent'}"
                        on:click={() => selectAssignment(assignment)}
                    >
                        <div class="flex items-center gap-3">
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
                </div>

                {#if expandedNodes.has(assignment.childAccount.id)}
                    <svelte:self
                        parentAccountId={assignment.childAccount.id}
                        {assignments}
                        {selectedAssignmentId}
                        {getRelationshipIcon}
                        {getRelationshipColor}
                        {getStatusColor}
                        {selectAssignment}
                        {expandedNodes}
                        {toggleExpanded}
                    />
                {/if}
            </div>
        {/each}
    </div>
{/if}
