<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import { toast } from 'svelte-sonner';
    import { ArrowLeft, ShieldCheck, Plus, Trash, Check, X, Info, Building2, Shield, User, Zap, Circle, CheckCircle2, XCircle } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import { Badge } from '$lib/components/ui/badge';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
    import { Label } from '$lib/components/ui/label';
    import { Input } from '$lib/components/ui/input';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Textarea } from '$lib/components/ui/textarea';
    import { enhance } from '$app/forms';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
    import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';

    export let data;
    $: ({ 
        user, userAccounts, selectedAccountId, selectedAccount, 
        allModules, allActions, effectivePermissions, groupPermissions, noAccountsMessage,
        adminCategories, userCategories, adminSidebarItems, userSidebarItems 
    } = data);

    // Access level: 'USER' or 'ADMIN'
    let accessLevel: 'USER' | 'ADMIN' = 'USER';

    // Helper to get permission safely
    type PermEntry = { groupAllowed: boolean; override: { id: string; allowed: boolean; reason: string | null; expiresAt: Date | null } | null };
    function getPermission(key: string): PermEntry | undefined {
        if (effectivePermissions && typeof effectivePermissions === 'object' && key in effectivePermissions) {
            return (effectivePermissions as Record<string, PermEntry>)[key];
        }
        return undefined;
    }

    // Get sidebar items and categories based on access level
    $: sidebarItems = accessLevel === 'ADMIN' ? adminSidebarItems : userSidebarItems;
    $: categories = accessLevel === 'ADMIN' ? adminCategories : userCategories;

    // Count permissions
    $: permissionCounts = (() => {
        let fromGroup = 0;
        let fromOverride = 0;
        let total = 0;
        
        if (sidebarItems && categories) {
            Object.values(categories || {}).forEach((moduleKeys: any) => {
                [...moduleKeys].forEach((module: string) => {
                    const item = sidebarItems[module];
                    if (item) {
                        item.actions.forEach((action: string) => {
                            total++;
                            const perm = getPermission(`${module}_${action}`);
                            if (perm?.override?.allowed) fromOverride++;
                            else if (perm?.groupAllowed) fromGroup++;
                        });
                    }
                });
            });
        }
        return { fromGroup, fromOverride, total, effective: fromGroup + fromOverride };
    })();

    // Handle account change
    function handleAccountChange(accountId: string) {
        goto(`?accountId=${accountId}`, { keepFocus: true, noScroll: true });
    }

    function onAccountSelect(selected: { value: string; label?: string } | undefined) {
        if (selected?.value) {
            handleAccountChange(selected.value);
        }
    }

    $: title = `User Permissions: ${user?.email || ''}`;
    $: pageCrumbs = [
        ["Admin", "/admin"],
        ["Users", "/admin/users"],
        [user?.email || user?.name || 'User', `/admin/users/${user?.id}`],
        ["Permissions", ""]
    ] as [string, string][];

    let overrideDialogOpen = false;
    let selectedModule: string | null = null;
    let selectedAction: string | null = null;
    let editingOverride: any = null;
    
    // Form state
    let formAllowed = true;
    let formReason = '';
    let formExpiresAt = '';
    let isSubmitting = false;

    function openOverrideDialog(module: string, action: string, override?: any) {
        selectedModule = module;
        selectedAction = action;
        editingOverride = override || null;
        
        formAllowed = override?.allowed ?? true;
        formReason = override?.reason ?? '';
        formExpiresAt = override?.expiresAt ? new Date(override.expiresAt).toISOString().split('T')[0] : '';
        
        overrideDialogOpen = true;
    }

    function closeDialog() {
        overrideDialogOpen = false;
        selectedModule = null;
        selectedAction = null;
        editingOverride = null;
        formAllowed = true;
        formReason = '';
        formExpiresAt = '';
    }

    async function handleDeleteOverride(overrideId: string) {
        if (!confirm('Are you sure you want to delete this override?')) return;

        const formData = new FormData();
        formData.append('overrideId', overrideId);

        try {
            const response = await fetch('?/deleteOverride', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.type === 'success' || result.data?.success) {
                toast.success('Override deleted successfully');
                await invalidateAll();
            } else {
                toast.error('Failed to delete override', { description: result.data?.error || 'Unknown error' });
            }
        } catch (e) {
            toast.error('Network error', { description: 'Failed to connect to server.' });
        }
    }

    // Get module label
    function getModuleLabel(module: string): string {
        return sidebarItems?.[module]?.label || module.replace('ADMIN_', '').replace('USER_', '').replace(/_/g, ' ');
    }

    // Get module href
    function getModuleHref(module: string): string | undefined {
        return sidebarItems?.[module]?.href;
    }

    // Get category modules
    function getCategoryModules(categoryName: string): Array<{key: string, config: any}> {
        if (!categories || !sidebarItems) return [];
        const cats = categories as Record<string, readonly string[]>;
        const moduleKeys = cats[categoryName];
        if (!moduleKeys) return [];
        return [...moduleKeys]
            .map(key => ({ key, config: sidebarItems[key] }))
            .filter(({ config }) => config);
    }

    // Quick Template: Apply bulk overrides
    let isApplyingTemplate = false;
    
    async function applyTemplate(template: 'clear' | 'grant_view' | 'grant_all') {
        if (!selectedAccountId || !user?.id) {
            toast.error('No account selected');
            return;
        }
        
        const confirmMsg = template === 'clear' 
            ? 'This will remove all overrides for this user. Continue?'
            : template === 'grant_view'
            ? 'This will grant VIEW permission for all modules. Continue?'
            : 'This will grant ALL permissions for all modules. Continue?';
            
        if (!confirm(confirmMsg)) return;
        
        isApplyingTemplate = true;
        
        try {
            const formData = new FormData();
            formData.append('template', template);
            formData.append('accountId', selectedAccountId);
            formData.append('accessLevel', accessLevel);
            
            const response = await fetch('?/applyTemplate', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.type === 'success' || result.data?.success) {
                toast.success(
                    template === 'clear' ? 'All overrides cleared' :
                    template === 'grant_view' ? 'View permissions granted' :
                    'Full access granted'
                );
                await invalidateAll();
            } else {
                toast.error('Failed to apply template', { description: result.data?.error || 'Unknown error' });
            }
        } catch (e) {
            toast.error('Network error', { description: 'Failed to connect to server.' });
        } finally {
            isApplyingTemplate = false;
        }
    }

    $: actionButtons = [
        {
            label: "Back to User",
            icon: ArrowLeft,
            onClick: () => goto(`/admin/users/${user?.id}`),
            variant: "outline" as const,
            disabled: isSubmitting
        }
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    loading={isSubmitting}
    showCreateButton={false}
    compact={true}
>
    <AdminCard
        title="User Permission Overrides"
        description="Override group permissions for this specific user. Overrides take precedence over group-based permissions."
        icon={ShieldCheck}
        compact={true}
    >
        <!-- Account Selector -->
        {#if userAccounts && userAccounts.length > 0}
            <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-center gap-3 flex-wrap">
                    <Building2 class="h-5 w-5 text-blue-600" />
                    <span class="font-medium text-sm">View permissions for account:</span>
                    <Select 
                        selected={{ value: selectedAccountId, label: selectedAccount?.name || '' }}
                        onSelectedChange={onAccountSelect}
                    >
                        <SelectTrigger class="w-[280px]">
                            <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                            {#each userAccounts as account}
                                <SelectItem value={account.id}>{account.name}</SelectItem>
                            {/each}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        {:else if noAccountsMessage}
            <div class="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div class="flex items-start gap-2">
                    <Info class="h-5 w-5 text-amber-600 mt-0.5" />
                    <p class="text-sm text-amber-800 dark:text-amber-200">{noAccountsMessage}</p>
                </div>
            </div>
        {/if}

        <div class="space-y-6">
            <!-- Access Level Selection (like Group Permissions) -->
            <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-5">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-foreground">Access Level</h3>
                        <p class="text-sm text-muted-foreground mt-1">View and override permissions by access level</p>
                    </div>
                    <Badge variant="outline" class="text-sm px-3 py-1">
                        {permissionCounts.effective} of {permissionCounts.total} permissions
                    </Badge>
                </div>
                
                <RadioGroup bind:value={accessLevel} class="grid grid-cols-2 gap-4">
                    <div class="relative">
                        <RadioGroupItem value="ADMIN" id="role-admin" class="peer sr-only" />
                        <Label 
                            for="role-admin" 
                            class="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-white dark:bg-slate-900 p-4 hover:bg-purple-50 dark:hover:bg-purple-950/20 peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:bg-purple-50 dark:peer-data-[state=checked]:bg-purple-950/30 cursor-pointer transition-all"
                        >
                            <Shield class="h-8 w-8 mb-2 text-purple-600" />
                            <div class="space-y-1 text-center">
                                <span class="text-base font-semibold">Admin Access</span>
                                <p class="text-xs text-muted-foreground">Full system control & management</p>
                            </div>
                        </Label>
                    </div>
                    
                    <div class="relative">
                        <RadioGroupItem value="USER" id="role-user" class="peer sr-only" />
                        <Label 
                            for="role-user" 
                            class="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-white dark:bg-slate-900 p-4 hover:bg-blue-50 dark:hover:bg-blue-950/20 peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50 dark:peer-data-[state=checked]:bg-blue-950/30 cursor-pointer transition-all"
                        >
                            <User class="h-8 w-8 mb-2 text-blue-600" />
                            <div class="space-y-1 text-center">
                                <span class="text-base font-semibold">User Access</span>
                                <p class="text-xs text-muted-foreground">Limited to user features</p>
                            </div>
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            <!-- Quick Templates -->
            <div class="flex items-center gap-3 p-4 bg-muted/30 rounded-lg flex-wrap">
                <Zap class="h-5 w-5 text-amber-600" />
                <span class="text-sm font-medium">Quick Templates:</span>
                <div class="flex gap-2 flex-wrap">
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        on:click={() => applyTemplate('clear')}
                        disabled={isApplyingTemplate}
                    >
                        <Circle class="h-3 w-3 mr-1" />
                        Clear All Overrides
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        on:click={() => applyTemplate('grant_view')}
                        disabled={isApplyingTemplate}
                    >
                        <CheckCircle2 class="h-3 w-3 mr-1" />
                        Grant View Only
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        on:click={() => applyTemplate('grant_all')}
                        disabled={isApplyingTemplate}
                    >
                        <CheckCircle2 class="h-3 w-3 mr-1" />
                        Grant Full Access
                    </Button>
                </div>
                {#if isApplyingTemplate}
                    <span class="text-sm text-muted-foreground ml-2">Applying...</span>
                {/if}
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
                <Zap class="h-5 w-5 text-amber-600" />
                <span class="text-sm font-medium">Legend:</span>
                <div class="flex items-center gap-4 text-sm">
                    <div class="flex items-center gap-1.5">
                        <Check class="h-4 w-4 text-green-500" />
                        <span class="text-muted-foreground">From Group</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <X class="h-4 w-4 text-red-400" />
                        <span class="text-muted-foreground">No Permission</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <Badge variant="default" class="text-xs">Grant</Badge>
                        <span class="text-muted-foreground">Override Added</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <Badge variant="destructive" class="text-xs">Deny</Badge>
                        <span class="text-muted-foreground">Override Denied</span>
                    </div>
                </div>
            </div>

            <!-- Permissions Table/Matrix -->
            <div class="border rounded-lg overflow-hidden">
                <div class="bg-muted/50 px-4 py-3 border-b">
                    <h3 class="font-semibold text-base flex items-center gap-2">
                        {#if accessLevel === 'ADMIN'}
                            <Shield class="h-5 w-5 text-purple-600" />
                            Admin Permissions
                        {:else}
                            <User class="h-5 w-5 text-blue-600" />
                            User Permissions
                        {/if}
                    </h3>
                    <p class="text-sm text-muted-foreground mt-1">
                        View group permissions and add overrides for this user
                    </p>
                </div>

                <div class="divide-y">
                    {#if categories}
                        {#each Object.keys(categories) as categoryName}
                            {@const categoryModules = getCategoryModules(categoryName)}
                            
                            {#if categoryModules.length > 0}
                                <!-- Category Header -->
                                <div class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 px-4 py-2.5 border-l-4 {accessLevel === 'ADMIN' ? 'border-l-purple-500' : 'border-l-blue-500'}">
                                    <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                        {categoryName}
                                    </h4>
                                </div>
                                
                                <!-- Modules in Category -->
                                {#each categoryModules as { key: module, config }}
                                    <div class="px-4 py-3 hover:bg-muted/30 transition-colors">
                                        <div class="flex items-start justify-between gap-4">
                                            <!-- Module Name -->
                                            <div class="flex-1 min-w-0">
                                                <div class="font-medium text-sm">{config.label}</div>
                                                {#if config.href}
                                                    <div class="text-xs text-muted-foreground mt-0.5 truncate">{config.href}</div>
                                                {/if}
                                            </div>
                                            
                                            <!-- Permission Status & Override Controls -->
                                            <div class="flex items-center gap-4">
                                                {#each config.actions as action}
                                                    {@const key = `${module}_${action}`}
                                                    {@const perm = getPermission(key)}
                                                    <div class="flex flex-col items-center gap-1 min-w-[70px]">
                                                        <span class="text-xs font-medium text-muted-foreground">{action}</span>
                                                        
                                                        <!-- Group Status -->
                                                        <div class="flex items-center gap-1">
                                                            {#if perm?.groupAllowed}
                                                                <Check class="h-3.5 w-3.5 text-green-500" />
                                                            {:else}
                                                                <X class="h-3.5 w-3.5 text-red-400" />
                                                            {/if}
                                                        </div>
                                                        
                                                        <!-- Override Control -->
                                                        {#if perm?.override}
                                                            <div class="flex items-center gap-0.5">
                                                                <Badge 
                                                                    variant={perm.override.allowed ? 'default' : 'destructive'}
                                                                    class="text-[10px] px-1.5 py-0 h-5 cursor-pointer"
                                                                    on:click={() => openOverrideDialog(module, action, perm.override)}
                                                                >
                                                                    {perm.override.allowed ? 'Grant' : 'Deny'}
                                                                </Badge>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    class="h-5 w-5"
                                                                    on:click={() => handleDeleteOverride(perm.override?.id || '')}
                                                                >
                                                                    <Trash class="h-2.5 w-2.5 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        {:else}
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                class="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                                                                on:click={() => openOverrideDialog(module, action)}
                                                            >
                                                                <Plus class="h-2.5 w-2.5 mr-0.5" />
                                                                Override
                                                            </Button>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            {/if}
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- Info Footer -->
            <div class="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <div class="text-blue-600 dark:text-blue-400 mt-0.5">
                    <Info class="h-5 w-5" />
                </div>
                <div class="flex-1 text-blue-900 dark:text-blue-100">
                    <p class="font-medium mb-1">Permission Override Priority</p>
                    <ul class="text-xs space-y-1 text-blue-700 dark:text-blue-300">
                        <li>• <strong>User Override</strong> takes highest priority (Grant or Deny)</li>
                        <li>• <strong>Group Permission</strong> is inherited from groups the user belongs to</li>
                        <li>• Overrides can be temporary (with expiration date) or permanent</li>
                    </ul>
                </div>
            </div>
        </div>
    </AdminCard>
</AdminPageLayout>

<!-- Override Dialog -->
<Dialog bind:open={overrideDialogOpen}>
    <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
            <DialogTitle>{editingOverride ? 'Edit' : 'Add'} Permission Override</DialogTitle>
            <DialogDescription>
                {#if selectedModule && selectedAction}
                    Configure override for <strong>{getModuleLabel(selectedModule)}</strong> → <strong>{selectedAction}</strong>
                {/if}
            </DialogDescription>
        </DialogHeader>
        
        <form 
            method="POST" 
            action="?/upsertOverride"
            use:enhance={() => {
                isSubmitting = true;
                return async ({ result }) => {
                    isSubmitting = false;
                    if (result.type === 'success') {
                        toast.success('Permission override saved!');
                        closeDialog();
                        await invalidateAll();
                    } else if (result.type === 'failure') {
                        toast.error('Failed to save', { description: String(result.data?.error || 'Unknown error') });
                    }
                };
            }}
        >
            <input type="hidden" name="overrideId" value={editingOverride?.id || ''} />
            <input type="hidden" name="accountId" value={selectedAccountId || ''} />
            <input type="hidden" name="module" value={selectedModule || ''} />
            <input type="hidden" name="action" value={selectedAction || ''} />
            <input type="hidden" name="allowed" value={formAllowed.toString()} />

            <div class="grid gap-4 py-4">
                <div class="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                        id="allowed"
                        checked={formAllowed}
                        onCheckedChange={(checked) => (formAllowed = checked === true)}
                        disabled={isSubmitting}
                    />
                    <div>
                        <Label for="allowed" class="text-base font-medium">
                            {formAllowed ? 'Grant Permission' : 'Deny Permission'}
                        </Label>
                        <p class="text-sm text-muted-foreground">
                            {formAllowed 
                                ? 'User will have this permission regardless of group settings' 
                                : 'User will NOT have this permission even if group allows it'}
                        </p>
                    </div>
                </div>

                <div class="grid gap-2">
                    <Label for="reason">Reason (Optional)</Label>
                    <Textarea
                        id="reason"
                        name="reason"
                        bind:value={formReason}
                        placeholder="e.g., Temporary access for project X"
                        disabled={isSubmitting}
                    />
                </div>

                <div class="grid gap-2">
                    <Label for="expiresAt">Expires At (Optional)</Label>
                    <Input
                        id="expiresAt"
                        name="expiresAt"
                        type="date"
                        bind:value={formExpiresAt}
                        disabled={isSubmitting}
                    />
                    <p class="text-xs text-muted-foreground">
                        Leave empty for permanent override
                    </p>
                </div>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" on:click={closeDialog} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {#if isSubmitting}
                        Saving...
                    {:else}
                        Save Override
                    {/if}
                </Button>
            </DialogFooter>
        </form>
    </DialogContent>
</Dialog>
