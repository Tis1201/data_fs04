<script lang="ts">
    import { goto } from '$app/navigation';
    import {
        ArrowLeft,
        Calendar,
        Database,
        Download,
        File,
        FileText,
        Save,
        Trash,
        User
    } from 'lucide-svelte';
    import { Input } from '$lib/components/ui/input';
    import { Badge } from '$lib/components/ui/badge';
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    import FormContainer from '$lib/components/ui_components_sveltekit/form/FormContainer.svelte';
    import FormRow from '$lib/components/ui_components_sveltekit/form/FormRow.svelte';
    import FormField from '$lib/components/ui_components_sveltekit/form/FormField.svelte';
    import EnhancedSelect from '$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte';
    import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import type { PageData } from './$types';

    export let data: PageData;
    const { resource, createdByUser, updatedByUser, form, accountOptions } = data;

    const title = `Resource: ${resource.name || 'Unnamed'}`;

    const pageCrumbs = [
        ['Dashboard', '/admin'],
        ['IoT', '/admin/iot'],
        ['Resources', '/admin/iot/resources'],
        resource.name || 'Unnamed'
    ];

    const { form: formStore, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(form, {
        successRedirect: '/admin/iot/resources',
        validateOnInput: true
    });

    // Delete dialog state
    let deleteState = {
        selectedRecord: resource,
        confirmationOpen: false
    };


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

    function getFormatBadgeVariant(format: string | null) {
        if (!format) return 'outline';
        const formatVariants: Record<string, string> = {
            apk: 'default',
            bin: 'secondary',
            exe: 'destructive',
            sh: 'warning'
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
</script>

<AdminPageLayout
        {title}
        crumbs={pageCrumbs}
        actionButtons={[
    {
      label: 'Back',
      icon: ArrowLeft,
      href: '/admin/iot/resources',
      variant: 'outline',
      class: 'h-9'
    },
    {
      label: 'Download',
      icon: Download,
      onClick: () => {
        window.open(`/api/resources/${resource.id}`, '_blank');
      },
      variant: 'outline',
      class: 'h-9'
    },
    {
      label: 'Save',
      icon: Save,
      class: 'h-9 btn-primary',
      disabled: $submitting,
      onClick: () => {
        const formEl = document.querySelector('form[action="?/update"]');
        if (formEl) formEl.requestSubmit();
      }
    }
  ]}
        compact={true}
        contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
        <!-- Resource Information -->
        <AdminCard title="Resource Information" description="View resource metadata" icon={File} compact={true}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="space-y-2">
                    <p class="text-sm font-medium text-muted-foreground">Type</p>
                    <Badge variant="outline">{getResourceTypeDisplay(resource.type)}</Badge>
                </div>
                <div class="space-y-2">
                    <p class="text-sm font-medium text-muted-foreground">Target</p>
                    <Badge variant="secondary">{getResourceTargetDisplay(resource.target)}</Badge>
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

                        <FormField id="target" label="Target" error={$errors.target}>
                            <div class="flex flex-col">
                                <EnhancedSelect
                                        id="target"
                                        name="target"
                                        bind:value={$formStore.target}
                                        placeholder="Select target"
                                        aria-invalid={$errors.target ? 'true' : undefined}
                                        {...$constraints.target}
                                        options={[
                    { value: 'user', label: 'User' },
                    { value: 'device', label: 'Device' },
                    { value: 'account', label: 'Account' }
                  ]}
                                />
                            </div>
                        </FormField>
                    </FormRow>

                    <FormRow columns={2}>
                        <FormField id="version" label="Version" error={$errors.version}>
                            <Input
                                    id="version"
                                    name="version"
                                    bind:value={$formStore.version}
                                    placeholder="1.0.0"
                                    aria-invalid={$errors.version ? 'true' : undefined}
                                    {...$constraints.version}
                            />
                        </FormField>

                        <FormField id="packageName" label="Package Name" error={$errors.packageName}>
                            <Input
                                    id="packageName"
                                    name="packageName"
                                    bind:value={$formStore.packageName}
                                    placeholder="com.example.app"
                                    aria-invalid={$errors.packageName ? 'true' : undefined}
                                    {...$constraints.packageName}
                            />
                        </FormField>
                    </FormRow>

                    <FormRow columns={1}>
                        <FormField id="accountId" label="Account" error={$errors.accountId}>
                            <EnhancedSelect
                                    id="accountId"
                                    name="accountId"
                                    bind:value={$formStore.accountId}
                                    placeholder={resource.account?.name || 'System Account'}
                                    aria-invalid={$errors.accountId ? 'true' : undefined}
                                    options={[
                  { value: '', label: 'System Account (Default)' },
                  ...accountOptions
                ]}
                            />
                        </FormField>
                    </FormRow>

                    <!-- Hidden preserved fields: type & format -->
                    <input type="hidden" name="type" value={resource.type} />
                    <input type="hidden" name="format" value={resource.format} />

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
                                {createdByUser?.email || resource.createdBy || 'Unknown'}
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
                                {updatedByUser?.email || resource.updatedBy || 'Unknown'}
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

        <!-- RecordDeleteDialog (kept as requested) -->
        <RecordDeleteDialog
                state={deleteState}
                action="?/delete"
                actionName="deleteResource"
                onConfirm={() => {goto('/admin/iot/resources')}}
        />
    </div>
</AdminPageLayout>
