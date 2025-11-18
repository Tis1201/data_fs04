<script lang="ts">
    import {
        Calendar,
        Database,
        File,
        FileText,
        Trash,
        User
    } from 'lucide-svelte';
    import { Input } from '$lib/components/ui/input';
    import { Badge } from '$lib/components/ui/badge';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    import FormContainer from '$lib/components/ui_components_sveltekit/form/FormContainer.svelte';
    import FormRow from '$lib/components/ui_components_sveltekit/form/FormRow.svelte';
    import FormField from '$lib/components/ui_components_sveltekit/form/FormField.svelte';
    import EnhancedSelect from '$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte';
    import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';

    // Props
    export let resource: any;
    export let formStore: any;
    export let errors: any;
    export let enhance: any;
    export let submitting: any;
    export let constraints: any;
    export let errorMessage: any;
    export let createdByUser: any = null;
    export let updatedByUser: any = null;
    export let accountOptions: any[] = [];
    export let showAccountField: boolean = false;
    export let deleteState: any;
    export let onDeleteConfirm: () => void;
    export let deleteAction: string = '?/delete';

    function getResourceTypeDisplay(type: string) {
        const typeMap: Record<string, string> = {
            file: 'File',
            image: 'Image',
            video: 'Video',
            document: 'Document',
            binary: 'Binary'
        };
        return typeMap[type] || type;
    }

    function getResourceTargetDisplay(target: string) {
        const targetMap: Record<string, string> = {
            user: 'User',
            device: 'Device',
            account: 'Account'
        };
        return targetMap[target] || target;
    }

    function getFormatBadgeVariant(format: string | null): "success" | "destructive" | "secondary" | "outline" | "default" {
        if (!format) return 'outline';
        const formatVariants: Record<string, "success" | "destructive" | "secondary" | "outline" | "default"> = {
            apk: 'default',
            bin: 'secondary',
            exe: 'destructive'
        };
        return formatVariants[format] || 'outline';
    }

    function formatBytes(bytes: number) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(date: Date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    function openDeleteDialog() {
        deleteState.selectedRecord = resource;
        deleteState.confirmationOpen = true;
    }

    // Get the correct user email for display
    $: createdByEmail = createdByUser?.email || resource.creator?.email || resource.createdBy || 'Unknown';
    $: updatedByEmail = updatedByUser?.email || resource.updater?.email || resource.updatedBy || 'Unknown';
</script>

<div class="w-full space-y-6">
    <!-- Resource Information -->
    <AdminCard title="Resource Information" description="View resource metadata" icon={File} compact={true}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="space-y-2">
                <p class="text-sm font-medium text-muted-foreground">Type</p>
                <Badge variant="outline">{getResourceTypeDisplay(resource.type)}</Badge>
            </div>
            <div class="space-y-2">
                <p class="text-sm font-medium text-muted-foreground">Release Type</p>
                <Badge variant="secondary">{resource.releaseType || 'Production'}</Badge>
            </div>
            <div class="space-y-2">
                <p class="text-sm font-medium text-muted-foreground">Size</p>
                <p class="text-sm">{formatBytes(resource.size)}</p>
            </div>
            <div class="space-y-2">
                <p class="text-sm font-medium text-muted-foreground">Version</p>
                <p class="text-sm">{resource.version || '1.0.0'}</p>
            </div>
        </div>

        {#if resource.format}
            <div class="mb-6">
                <p class="text-sm font-medium text-muted-foreground mb-2">Format</p>
                <Badge variant={getFormatBadgeVariant(resource.format)}>{resource.format.toUpperCase()}</Badge>
            </div>
        {/if}

        {#if resource.packageName}
            <div class="mb-6">
                <p class="text-sm font-medium text-muted-foreground mb-2">Package Name</p>
                <p class="text-sm font-mono bg-muted px-2 py-1 rounded">{resource.packageName}</p>
            </div>
        {/if}

        {#if resource.description}
            <div class="mb-6">
                <p class="text-sm font-medium text-muted-foreground mb-2">Description</p>
                <p class="text-sm">{resource.description}</p>
            </div>
        {/if}
    </AdminCard>

    <!-- Edit Form -->
    <FormContainer method="POST" action="?/update" {enhance} novalidate errorMessage={$errorMessage}>
        <AdminCard title="Edit Resource" description="Update resource information" icon={FileText} compact={true}>
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField id="name" label="Resource Name" required={true} error={$errors.name}>
                        <Input
                                id="name"
                                name="name"
                                type="text"
                                bind:value={$formStore.name}
                                placeholder="Enter resource name"
                                aria-invalid={$errors.name ? 'true' : undefined}
                                {...$constraints.name}
                        />
                    </FormField>

                    <FormField id="releaseType" label="Release Type" required={true} error={$errors.releaseType}>
                        <EnhancedSelect
                                id="releaseType"
                                name="releaseType"
                                bind:value={$formStore.releaseType}
                                placeholder="Select release type"
                                aria-invalid={$errors.releaseType ? 'true' : undefined}
                                {...$constraints.releaseType}
                                options={[
                    { value: 'Alpha', label: 'Alpha' },
                    { value: 'Beta', label: 'Beta' },
                    { value: 'Production', label: 'Production' }
                  ]}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField id="version" label="Version" error={$errors.version}>
                        <Input
                                id="version"
                                name="version"
                                bind:value={$formStore.version}
                                placeholder="1.0.0"
                                readonly
                                disabled
                                class="bg-muted cursor-not-allowed"
                                aria-invalid={$errors.version ? 'true' : undefined}
                                {...$constraints.version}
                        />
                        <input type="hidden" name="version" value={$formStore.version} />
                    </FormField>

                    <FormField id="packageName" label="Package Name" error={$errors.packageName}>
                        <Input
                                id="packageName"
                                name="packageName"
                                bind:value={$formStore.packageName}
                                placeholder="com.example.app"
                                readonly
                                disabled
                                class="bg-muted cursor-not-allowed"
                                aria-invalid={$errors.packageName ? 'true' : undefined}
                                {...$constraints.packageName}
                        />
                        <input type="hidden" name="packageName" value={$formStore.packageName} />
                    </FormField>
                </FormRow>

                <!-- Hidden preserved fields: type, format, and accountId -->
                <input type="hidden" name="type" value={resource.type} />
                <input type="hidden" name="format" value={resource.format} />
                <input type="hidden" name="accountId" value={$formStore.accountId || resource.accountId || ''} />

                <FormRow columns={2}>
                    <FormField id="size" label="Size (bytes)" error={$errors.size}>
                        <div class="flex flex-col">
                            <div class="break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">
                                {formatBytes($formStore.size)}
                            </div>
                            <input type="hidden" name="size" value={$formStore.size} />
                        </div>
                    </FormField>

                    <FormField id="path" label="Path or URL" error={$errors.path}>
                        <div class="flex flex-col">
                            <div class="break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">
                                { $formStore.path }
                            </div>
                            <input type="hidden" name="path" value={$formStore.path} />
                        </div>
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
    </FormContainer>

    <!-- Resource Details -->
    <AdminCard title="Resource Details" description="Additional information about this resource" icon={Database} compact={true}>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <div class="flex items-center space-x-2">
                    <User class="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p class="text-sm font-medium">Created By</p>
                        <p class="text-sm text-muted-foreground">
                            {createdByEmail}
                        </p>
                    </div>
                </div>

                <div class="flex items-center space-x-2">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p class="text-sm font-medium">Created At</p>
                        <p class="text-sm text-muted-foreground">{formatDate(resource.createdAt)}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <div class="flex items-center space-x-2">
                    <User class="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p class="text-sm font-medium">Updated By</p>
                        <p class="text-sm text-muted-foreground">
                            {updatedByEmail}
                        </p>
                    </div>
                </div>

                <div class="flex items-center space-x-2">
                    <Calendar class="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p class="text-sm font-medium">Updated At</p>
                        <p class="text-sm text-muted-foreground">{formatDate(resource.updatedAt)}</p>
                    </div>
                </div>
            </div>
        </div>
    </AdminCard>

    <!-- Danger Zone / Delete -->
    <AdminCard title="Danger Zone" description="Permanent actions for this resource" icon={Trash} compact={true}>
        <div class="space-y-4">
            <div>
                <h4 class="text-sm font-medium text-destructive">Delete Resource</h4>
                <p class="text-sm text-muted-foreground mt-1">
                    Once you delete a resource, there is no going back. Please be certain.
                </p>
            </div>

            <div>
                <button
                        type="button"
                        class="inline-flex items-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white"
                        disabled={$submitting}
                        on:click={openDeleteDialog}
                >
                    <Trash class="h-4 w-4 mr-2" />
                    Delete Resource
                </button>
            </div>
        </div>
    </AdminCard>

    <!-- RecordDeleteDialog -->
    <RecordDeleteDialog
            state={deleteState}
            action={deleteAction}
            actionName="deleteResource"
            onConfirm={onDeleteConfirm}
    />
</div>

