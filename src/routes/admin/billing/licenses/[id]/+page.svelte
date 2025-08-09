<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Save, Key, Calendar, RefreshCw, Building, Cpu, Download } from 'lucide-svelte';
    import LicenseExpiryDate from "$lib/components/ui_components_sveltekit/date/LicenseExpiryDate.svelte";
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
    import * as Card from "$lib/components/ui/card";
    
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
        if (!date) return 'Not available';
        return new Date(date).toLocaleString();
    }
    
    // We're now using the ExpiresDate component instead of this function
    // Keeping the formatDate function for other date displays
    
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
    
    // Date preset options for renewal
    function setExpiryDate(option) {
        const now = new Date();
        let newDate;
        
        switch(option) {
            case 'tomorrow':
                newDate = new Date(now.setDate(now.getDate() + 1));
                break;
            case 'nextWeek':
                newDate = new Date(now.setDate(now.getDate() + 7));
                break;
            case 'nextMonth':
                newDate = new Date(now.setMonth(now.getMonth() + 1));
                break;
            case 'nextYear':
                newDate = new Date(now.setFullYear(now.getFullYear() + 1));
                break;
            case 'twoYears':
                newDate = new Date(now.setFullYear(now.getFullYear() + 2));
                break;
            default:
                newDate = new Date(now.setFullYear(now.getFullYear() + 1));
        }
        
        $form.newExpiresAt = newDate;
    }
    
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
        label: "Download",
        icon: Download,
        href: `?/download`,
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
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-4">
        <!-- Combined info card with status, account and device -->
        <Card.Root class="w-full">
            <Card.Content class="p-4">
                <div class="flex flex-wrap items-center gap-6">
                    <!-- Status -->
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">Status:</span>
                        <Badge variant={getStatusBadgeVariant(license.status)}>
                            {license.status}
                        </Badge>
                    </div>
                    
                    <!-- Account -->
                    <div class="flex items-center gap-2">
                        <Building class="h-4 w-4 text-muted-foreground" />
                        <span class="text-sm font-medium">Account:</span>
                        <a href="/admin/accounts/{license.accountId}" class="text-primary hover:underline">
                            {license.account.name}
                        </a>
                    </div>
                    
                    <!-- Device (if exists) -->
                    {#if license.device}
                        <div class="flex items-center gap-2">
                            <Cpu class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm font-medium">Device:</span>
                            <a href="/admin/iot/devices/{license.deviceId}" class="text-primary hover:underline">
                                {license.device.name || license.device.id.substring(0, 8) + '...'}
                            </a>
                        </div>
                    {/if}
                </div>
            </Card.Content>
        </Card.Root>
        
        <!-- License Details Card -->
        <AdminCard
            title="License Details"
            icon={Key}
            compact={true}
        >
            <!-- Key details in a clean grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                <div>
                    <div class="text-xs font-medium text-muted-foreground">Issued At</div>
                    <div class="text-sm mt-1">{formatDate(license.issuedAt)}</div>
                </div>
                
                <div>
                    <div class="text-xs font-medium text-muted-foreground">Expires At</div>
                    <div class="text-sm mt-1">
                        <LicenseExpiryDate date={license.expiresAt} showTooltip={true} />
                    </div>
                </div>
                
                <div>
                    <div class="text-xs font-medium text-muted-foreground">Key ID</div>
                    <div class="text-sm mt-1">{license.keyId}</div>
                </div>
                
                <div>
                    <div class="text-xs font-medium text-muted-foreground">Algorithm</div>
                    <div class="text-sm mt-1">{license.algorithm}</div>
                </div>
            </div>
            
            <!-- Description if available -->
            {#if license.description}
                <div class="mt-4 border-t pt-4">
                    <div class="text-xs font-medium text-muted-foreground mb-1">Description</div>
                    <div class="text-sm">{license.description}</div>
                </div>
            {/if}
            
            <!-- Entitlements if available -->
            {#if license.entitlements && license.entitlements.length > 0}
                <div class="mt-4 border-t pt-4">
                    <div class="text-xs font-medium text-muted-foreground mb-2">Entitlements</div>
                    <div class="flex flex-wrap gap-2">
                        {#each license.entitlements as entitlement}
                            <Badge variant="secondary">
                                {entitlement.name || entitlement.id.substring(0, 8)}
                            </Badge>
                        {/each}
                    </div>
                </div>
            {/if}
            
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
                                <TableCell>
                                    <LicenseExpiryDate date={renewal.oldExpiresAt} showTooltip={true} />
                                </TableCell>
                                <TableCell>
                                    <LicenseExpiryDate date={renewal.newExpiresAt} showTooltip={true} />
                                </TableCell>
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
            <div class="space-y-4 py-2">
                <!-- Quick date selection options -->
                <div>
                    <div class="text-sm font-medium mb-2">Quick Select</div>
                    <div class="flex flex-wrap gap-2">
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            on:click={() => setExpiryDate('tomorrow')}
                            disabled={$submitting}
                        >
                            Tomorrow
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            on:click={() => setExpiryDate('nextWeek')}
                            disabled={$submitting}
                        >
                            Next Week
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            on:click={() => setExpiryDate('nextMonth')}
                            disabled={$submitting}
                        >
                            Next Month
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            on:click={() => setExpiryDate('nextYear')}
                            disabled={$submitting}
                        >
                            Next Year
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            on:click={() => setExpiryDate('twoYears')}
                            disabled={$submitting}
                        >
                            2 Years
                        </Button>
                    </div>
                </div>
                
                <FormField 
                    id="newExpiresAt" 
                    label="Expiration Date"
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
                >
                    <Textarea 
                        id="metadata" 
                        name="metadata" 
                        bind:value={$form.metadata}
                        placeholder="Enter notes about this renewal"
                        disabled={$submitting}
                        rows={2}
                        class="resize-none"
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
