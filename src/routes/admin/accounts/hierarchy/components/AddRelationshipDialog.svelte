<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
    import { Label } from "$lib/components/ui/label";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import { Building2, Crown, Handshake, Eye, Calendar } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";
    import SearchableSelect from "$lib/components/ui_components_sveltekit/form/SearchableSelect.svelte";

    type Account = {
        id: string;
        name: string;
        slug?: string;
    };

    export let open = false;
    export let accounts: Account[] = [];
    export let loading = false;

    const dispatch = createEventDispatcher<{
        submit: {
            parentAccountId: string;
            childAccountId: string;
            relationshipType: string;
            validFrom?: string;
            validTo?: string;
        };
        close: void;
    }>();

    let parentAccountId = '';
    let childAccountId = '';
    let relationshipType = '';
    let validFrom = '';
    let validTo = '';

    const relationshipTypes = [
        {
            value: 'OWNERSHIP',
            label: 'Ownership',
            icon: Crown,
            description: 'Parent administrators have full rights on child account',
            color: 'bg-blue-100 text-blue-800 border-blue-200'
        },
        {
            value: 'DELEGATION',
            label: 'Delegation',
            icon: Handshake,
            description: 'Limited administrative rights (no billing/users)',
            color: 'bg-orange-100 text-orange-800 border-orange-200'
        },
        {
            value: 'VISIBILITY_ONLY',
            label: 'Visibility Only',
            icon: Eye,
            description: 'View-only access to child account resources',
            color: 'bg-gray-100 text-gray-800 border-gray-200'
        }
    ];

    $: selectedRelationshipType = relationshipTypes.find(rt => rt.value === relationshipType);
    $: parentAccount = accounts.find(a => a.id === parentAccountId);
    $: childAccount = accounts.find(a => a.id === childAccountId);
    $: canSubmit = parentAccountId && childAccountId && relationshipType && parentAccountId !== childAccountId;

    function handleSubmit() {
        if (!canSubmit) return;
        
        dispatch('submit', {
            parentAccountId,
            childAccountId,
            relationshipType,
            validFrom: validFrom || undefined,
            validTo: validTo || undefined
        });
    }

    function handleClose() {
        // Reset form
        parentAccountId = '';
        childAccountId = '';
        relationshipType = '';
        validFrom = '';
        validTo = '';
        dispatch('close');
    }

    // Filter out selected accounts from the other dropdown and format for SearchableSelect
    $: availableParentAccounts = accounts
        .filter(a => a.id !== childAccountId)
        .map(account => ({
            value: account.id,
            label: account.name,
            description: account.slug ? `(${account.slug})` : undefined,
            html: `<div class="flex items-center gap-2">
                <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                <span>${account.name}</span>
                ${account.slug ? `<span class="text-xs text-gray-500">(${account.slug})</span>` : ''}
            </div>`
        }));
    
    $: availableChildAccounts = accounts
        .filter(a => a.id !== parentAccountId)
        .map(account => ({
            value: account.id,
            label: account.name,
            description: account.slug ? `(${account.slug})` : undefined,
            html: `<div class="flex items-center gap-2">
                <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                <span>${account.name}</span>
                ${account.slug ? `<span class="text-xs text-gray-500">(${account.slug})</span>` : ''}
            </div>`
        }));
</script>

<Dialog bind:open on:close={handleClose}>
    <DialogContent class="sm:max-w-[600px]">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <Building2 class="h-5 w-5" />
                Add Account Relationship
            </DialogTitle>
            <DialogDescription>
                Create a new parent-child relationship between accounts. This will grant permissions based on the relationship type.
            </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
            <!-- Account Selection -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label for="parent-account">Parent Account</Label>
                    <SearchableSelect
                        bind:value={parentAccountId}
                        name="parent-account"
                        placeholder="Select parent account"
                        searchPlaceholder="Search parent accounts..."
                        options={availableParentAccounts}
                        debounceMs={200}
                        minSearchLength={1}
                        noResultsText="No parent accounts found"
                        disabled={loading}
                    />
                </div>

                <div class="space-y-2">
                    <Label for="child-account">Child Account</Label>
                    <SearchableSelect
                        bind:value={childAccountId}
                        name="child-account"
                        placeholder="Select child account"
                        searchPlaceholder="Search child accounts..."
                        options={availableChildAccounts}
                        debounceMs={200}
                        minSearchLength={1}
                        noResultsText="No child accounts found"
                        disabled={loading}
                    />
                </div>
            </div>

            <!-- Relationship Preview -->
            {#if parentAccount && childAccount}
                <div class="p-4 bg-gray-50 rounded-lg">
                    <div class="flex items-center justify-center gap-4">
                        <div class="text-center">
                            <Building2 class="h-6 w-6 mx-auto mb-1 text-gray-600" />
                            <div class="font-medium text-sm">{parentAccount.name}</div>
                            <div class="text-xs text-gray-500">Parent</div>
                        </div>
                        <div class="text-gray-400 text-xl">→</div>
                        <div class="text-center">
                            <Building2 class="h-6 w-6 mx-auto mb-1 text-gray-600" />
                            <div class="font-medium text-sm">{childAccount.name}</div>
                            <div class="text-xs text-gray-500">Child</div>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Relationship Type -->
            <div class="space-y-3">
                <Label>Relationship Type</Label>
                <div class="grid gap-3">
                    {#each relationshipTypes as type}
                        {@const Icon = type.icon}
                        <button
                            type="button"
                            class="p-3 border rounded-lg text-left transition-colors hover:bg-gray-50 {relationshipType === type.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}"
                            on:click={() => relationshipType = type.value}
                        >
                            <div class="flex items-start gap-3">
                                <Icon class="h-5 w-5 mt-0.5 text-gray-600" />
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="font-medium">{type.label}</span>
                                        <Badge variant="outline" class="text-xs {type.color}">
                                            {type.value.replace('_', ' ')}
                                        </Badge>
                                    </div>
                                    <p class="text-sm text-gray-600">{type.description}</p>
                                </div>
                                {#if relationshipType === type.value}
                                    <div class="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                                        <div class="h-2 w-2 rounded-full bg-white"></div>
                                    </div>
                                {/if}
                            </div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Validity Period (Optional) -->
            <div class="space-y-3">
                <Label class="flex items-center gap-2">
                    <Calendar class="h-4 w-4" />
                    Validity Period (Optional)
                </Label>
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <Label for="valid-from" class="text-sm text-gray-600">Valid From</Label>
                        <Input
                            id="valid-from"
                            type="date"
                            bind:value={validFrom}
                            placeholder="Start date"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label for="valid-to" class="text-sm text-gray-600">Valid To</Label>
                        <Input
                            id="valid-to"
                            type="date"
                            bind:value={validTo}
                            placeholder="End date"
                        />
                    </div>
                </div>
                <p class="text-xs text-gray-500">
                    Leave empty for permanent relationship. End date must be after start date.
                </p>
            </div>

            <!-- Selected Relationship Summary -->
            {#if selectedRelationshipType && parentAccount && childAccount}
                <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 class="font-medium text-blue-900 mb-2">Relationship Summary</h4>
                    <p class="text-sm text-blue-800">
                        <strong>{parentAccount.name}</strong> will have <strong>{selectedRelationshipType.label.toLowerCase()}</strong> 
                        permissions on <strong>{childAccount.name}</strong>.
                    </p>
                    <p class="text-xs text-blue-700 mt-1">
                        {selectedRelationshipType.description}
                    </p>
                </div>
            {/if}
        </div>

        <DialogFooter>
            <Button variant="outline" on:click={handleClose} disabled={loading}>
                Cancel
            </Button>
            <Button on:click={handleSubmit} disabled={!canSubmit || loading}>
                {loading ? 'Creating...' : 'Create Relationship'}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
