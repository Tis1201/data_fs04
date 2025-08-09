<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Save, Key, Calendar, RefreshCw, Building, Cpu } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    
    // Import layout components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import { Badge } from "$lib/components/ui/badge";
    
    // Import form components
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    
    export let data;
    const { license } = data;
    
    // Create form handler for renewal
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.renewalForm, {
        validateOnInput: true,
        onSuccess: (result) => {
            toast.success(result.data?.message || 'License renewed successfully');
            // Close the dialog after successful renewal
            isRenewDialogOpen = false;
        }
    });
    
    // Format date for display
    function formatDate(date) {
        return date ? new Date(date).toLocaleString() : 'Not available';
    }
    
    // Format date for datetime-local input
    function formatDateForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        // Format as YYYY-MM-DDThh:mm
        return d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0') + 'T' + 
            String(d.getHours()).padStart(2, '0') + ':' + 
            String(d.getMinutes()).padStart(2, '0');
    }
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Billing", "/admin/billing"],
        ["Licenses", "/admin/billing/licenses"],
        license.account.name || license.id.substring(0, 8)
    ];
    
    // Get license status badge color
    function getStatusBadgeVariant(status) {
        switch (status) {
            case 'ACTIVE':
                return 'success';
            case 'REVOKED':
                return 'destructive';
            case 'EXPIRED':
                return 'warning';
            case 'SUSPENDED':
                return 'outline';
            default:
                return 'secondary';
        }
    }
    
    // Renewal dialog state
    let isRenewDialogOpen = false;
    
    // Set default expiration date for renewal (current expiration + 1 year)
    $: {
        if (license) {
            const defaultExpiryDate = new Date(license.expiresAt);
            defaultExpiryDate.setFullYear(defaultExpiryDate.getFullYear() + 1);
            $form.newExpiresAt = defaultExpiryDate;
        }
    }
    
    const title = `License: ${license.account.name}`;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/admin/billing/licenses'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Renew",
        icon: RefreshCw,
        onClick: () => isRenewDialogOpen = true,
        class: "h-9"
      }
    ]}
    compact={true}
    contentSpacing="space-y-6"
>
    <div class="w-full space-y-6">
        <AdminCard
            title="License Details"
            description="View license information"
            icon={Key}
            compact={true}
        >
            <!-- License Information -->
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium">Status</h3>
                    <Badge variant={getStatusBadgeVariant(license.status)}>
                        {license.status}
                    </Badge>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="p-4 bg-muted/50 rounded-md">
                        <div class="text-sm font-medium text-muted-foreground mb-1">Account</div>
                        <div class="flex items-center">
                            <Building class="h-4 w-4 mr-2 text-muted-foreground" />
                            <a href="/admin/accounts/{license.accountId}" class="text-primary hover:underline">
                                {license.account.name}
                            </a>
                        </div>
                    </div>
                    
                    {#if license.device}
                        <div class="p-4 bg-muted/50 rounded-md">
                            <div class="text-sm font-medium text-muted-foreground mb-1">Device</div>
                            <div class="flex items-center">
                                <Cpu class="h-4 w-4 mr-2 text-muted-foreground" />
                                <a href="/admin/iot/devices/{license.deviceId}" class="text-primary hover:underline">
                                    {license.device.name || license.device.id.substring(0, 8) + '...'}
                                </a>
                            </div>
                        </div>
                    {/if}
                    
                    <div class="p-4 bg-muted/50 rounded-md">
                        <div class="text-sm font-medium text-muted-foreground mb-1">Issued At</div>
                        <div>{formatDate(license.issuedAt)}</div>
                    </div>
                    
                    <div class="p-4 bg-muted/50 rounded-md">
                        <div class="text-sm font-medium text-muted-foreground mb-1">Expires At</div>
                        <div>{formatDate(license.expiresAt)}</div>
                    </div>
                    
                    <div class="p-4 bg-muted/50 rounded-md">
                        <div class="text-sm font-medium text-muted-foreground mb-1">Key ID</div>
                        <div>{license.keyId}</div>
                    </div>
                    
                    <div class="p-4 bg-muted/50 rounded-md">
                        <div class="text-sm font-medium text-muted-foreground mb-1">Algorithm</div>
                        <div>{license.algorithm}</div>
                    </div>
                </div>
                
                {#if license.description}
                    <div class="p-4 bg-muted/50 rounded-md">
                        <div class="text-sm font-medium text-muted-foreground mb-1">Description</div>
                        <div>{license.description}</div>
                    </div>
                {/if}
                
                {#if license.entitlements && license.entitlements.length > 0}
                    <div class="mt-6">
                        <h3 class="text-lg font-medium mb-4">Entitlements</h3>
                        <div class="flex flex-wrap gap-2">
                            {#each license.entitlements as entitlement}
                                <Badge variant="secondary">
                                    {entitlement.name || entitlement.id.substring(0, 8)}
                                </Badge>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
            
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
                        { label: "Created", date: license.createdAt, icon: 'calendar' },
                        { label: "Last Updated", date: license.updatedAt, icon: 'clock' },
                        { label: "Created By", value: license.createdBy.substring(0, 8) + '...', icon: 'user' },
                        { label: "License ID", value: license.id.substring(0, 8) + '...', icon: 'tag' }
                    ]}
                />
            </svelte:fragment>
        </AdminCard>
        
        <!-- License Renewals Table -->
        <AdminCard
            title="Renewal History"
            description="View license renewal history"
            icon={Calendar}
            compact={true}
        >
            {#if license.renewals && license.renewals.length > 0}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Old Expiry</TableHead>
                            <TableHead>New Expiry</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Performed By</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {#each license.renewals as renewal}
                            <TableRow>
                                <TableCell>{formatDate(renewal.createdAt)}</TableCell>
                                <TableCell>{formatDate(renewal.oldExpiresAt)}</TableCell>
                                <TableCell>{formatDate(renewal.newExpiresAt)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {renewal.source}
                                    </Badge>
                                </TableCell>
                                <TableCell>{renewal.performedBy ? renewal.performedBy.substring(0, 8) + '...' : 'System'}</TableCell>
                            </TableRow>
                        {/each}
                    </TableBody>
                </Table>
            {:else}
                <div class="py-4 text-center text-muted-foreground">
                    No renewal history found
                </div>
            {/if}
        </AdminCard>
    </div>
</AdminPageLayout>

<!-- Renew License Dialog -->
<Dialog.Root bind:open={isRenewDialogOpen}>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Renew License</Dialog.Title>
            <Dialog.Description>
                Extend the license expiration date for {license.account.name}.
            </Dialog.Description>
        </Dialog.Header>
        
        <FormContainer
            method="POST"
            action="?/renew"
            {enhance}
            novalidate
            errorMessage={$errorMessage}
        >
            <div class="space-y-4 py-4">
                <FormField 
                    id="newExpiresAt" 
                    label="New Expiration Date"
                    error={$errors.newExpiresAt}
                    required={true}
                >
                    <Input 
                        id="newExpiresAt" 
                        name="newExpiresAt" 
                        type="datetime-local"
                        value={formatDateForInput($form.newExpiresAt)}
                        on:input={(e) => $form.newExpiresAt = new Date(e.currentTarget.value)}
                        disabled={$submitting}
                    />
                </FormField>
                
                <FormField 
                    id="metadata" 
                    label="Notes"
                    error={$errors.metadata}
                    description="Additional information about this renewal"
                >
                    <Textarea 
                        id="metadata" 
                        name="metadata" 
                        bind:value={$form.metadata}
                        placeholder="Enter notes"
                        disabled={$submitting}
                        rows={3}
                    />
                </FormField>
            </div>
            
            <Dialog.Footer>
                <Button type="button" variant="outline" on:click={() => isRenewDialogOpen = false}>
                    Cancel
                </Button>
                <Button type="submit" disabled={$submitting}>
                    {#if $submitting}
                        Renewing...
                    {:else}
                        Renew License
                    {/if}
                </Button>
            </Dialog.Footer>
        </FormContainer>
    </Dialog.Content>
</Dialog.Root>
