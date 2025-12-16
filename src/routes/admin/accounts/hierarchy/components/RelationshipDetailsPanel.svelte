<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardHeader, CardTitle, CardContent } from "$lib/components/ui/card";
    import { Separator } from "$lib/components/ui/separator";
    import { Building2, Calendar, Crown, Handshake, Eye, Edit, Trash, Pause, Play } from "lucide-svelte";
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
        createdAt?: Date;
        updatedAt?: Date;
    };

    export let assignment: Assignment | null = null;
    export let loading: boolean = false;

    const dispatch = createEventDispatcher<{
        edit: { assignment: Assignment };
        delete: { assignment: Assignment };
        suspend: { assignment: Assignment };
        activate: { assignment: Assignment };
    }>();

    function getRelationshipIcon(type: string) {
        switch (type) {
            case 'OWNERSHIP': return Crown;
            case 'DELEGATION': return Handshake;
            case 'VISIBILITY_ONLY': return Eye;
            default: return Building2;
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

    function getRelationshipDescription(type: string) {
        switch (type) {
            case 'OWNERSHIP':
                return 'Parent account administrators have full administrative rights on the child account, including billing and user management.';
            case 'DELEGATION':
                return 'Parent account administrators have limited rights on the child account. They can manage devices and integrations but not billing or users.';
            case 'VISIBILITY_ONLY':
                return 'Parent account members can view the child account and its resources but cannot make any changes.';
            default:
                return 'Unknown relationship type.';
        }
    }

    function formatDate(date: string | Date | null | undefined) {
        if (!date) return '∞';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString();
    }
</script>

{#if assignment}
    <Card class="h-fit">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                {@const RelationshipIcon = getRelationshipIcon(assignment.relationshipType)}
                <RelationshipIcon class="h-5 w-5" />
                Relationship Details
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
            <!-- Relationship Overview -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700">Type</span>
                    <Badge 
                        variant="outline" 
                        class={getRelationshipColor(assignment.relationshipType)}
                    >
                        {assignment.relationshipType.replace('_', ' ')}
                    </Badge>
                </div>
                
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700">Status</span>
                    <Badge 
                        variant="outline" 
                        class={getStatusColor(assignment.status)}
                    >
                        {assignment.status}
                    </Badge>
                </div>
            </div>

            <Separator />

            <!-- Account Information -->
            <div class="space-y-4">
                <h4 class="font-medium text-gray-900">Accounts</h4>
                
                <div class="space-y-3">
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Building2 class="h-4 w-4 text-gray-600" />
                        <div>
                            <div class="font-medium text-sm">Parent Account</div>
                            <div class="text-sm text-gray-600">{assignment.parentAccount.name}</div>
                        </div>
                    </div>
                    
                    <div class="flex justify-center">
                        <div class="text-gray-400">↓</div>
                    </div>
                    
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Building2 class="h-4 w-4 text-gray-600" />
                        <div>
                            <div class="font-medium text-sm">Child Account</div>
                            <div class="text-sm text-gray-600">{assignment.childAccount.name}</div>
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            <!-- Validity Period -->
            <div class="space-y-3">
                <h4 class="font-medium text-gray-900 flex items-center gap-2">
                    <Calendar class="h-4 w-4" />
                    Validity Period
                </h4>
                
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">From:</span>
                        <div class="font-medium">{formatDate(assignment.validFrom)}</div>
                    </div>
                    <div>
                        <span class="text-gray-600">To:</span>
                        <div class="font-medium">{formatDate(assignment.validTo)}</div>
                    </div>
                </div>
            </div>

            <Separator />

            <!-- Description -->
            <div class="space-y-3">
                <h4 class="font-medium text-gray-900">Permissions</h4>
                <p class="text-sm text-gray-600 leading-relaxed">
                    {getRelationshipDescription(assignment.relationshipType)}
                </p>
            </div>

            <Separator />

            <!-- Actions -->
            <div class="space-y-3">
                <h4 class="font-medium text-gray-900">Actions</h4>
                
                <div class="flex flex-col gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        class="justify-start"
                        disabled={loading}
                        on:click={() => dispatch('edit', { assignment })}
                    >
                        <Edit class="h-4 w-4 mr-2" />
                        Edit Relationship
                    </Button>
                    
                    {#if assignment.status === 'ACTIVE'}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            class="justify-start text-orange-600 hover:text-orange-700"
                            disabled={loading}
                            on:click={() => dispatch('suspend', { assignment })}
                        >
                            <Pause class="h-4 w-4 mr-2" />
                            {loading ? 'Suspending...' : 'Suspend Relationship'}
                        </Button>
                    {:else}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            class="justify-start text-green-600 hover:text-green-700"
                            disabled={loading}
                            on:click={() => dispatch('activate', { assignment })}
                        >
                            <Play class="h-4 w-4 mr-2" />
                            {loading ? 'Activating...' : 'Activate Relationship'}
                        </Button>
                    {/if}
                    
                    <Button 
                        variant="outline" 
                        size="sm" 
                        class="justify-start text-red-600 hover:text-red-700"
                        disabled={loading}
                        on:click={() => dispatch('delete', { assignment })}
                    >
                        <Trash class="h-4 w-4 mr-2" />
                        {loading ? 'Deleting...' : 'Delete Relationship'}
                    </Button>
                </div>
            </div>

            <!-- Metadata -->
            {#if assignment.createdAt}
                <Separator />
                <div class="text-xs text-gray-500 space-y-1">
                    <div>Created: {formatDate(assignment.createdAt)}</div>
                    {#if assignment.updatedAt}
                        <div>Updated: {formatDate(assignment.updatedAt)}</div>
                    {/if}
                </div>
            {/if}
        </CardContent>
    </Card>
{:else}
    <Card class="h-fit">
        <CardContent class="flex flex-col items-center justify-center py-12 text-center">
            <Building2 class="h-12 w-12 text-gray-400 mb-4" />
            <h3 class="font-medium text-gray-900 mb-2">No Relationship Selected</h3>
            <p class="text-sm text-gray-500">
                Select a relationship from the hierarchy tree to view its details and manage it.
            </p>
        </CardContent>
    </Card>
{/if}
