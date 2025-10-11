<script lang="ts">
    import { goto } from '$app/navigation';
    import {
        ArrowLeft,
        Download,
        Save
    } from 'lucide-svelte';
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import ResourceDetailContent from '$lib/components/resources/ResourceDetailContent.svelte';
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import type { PageData } from './$types';
    import { toast } from 'svelte-sonner';

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
        validateOnInput: true,
        onSuccess: () => {
            toast.success('Resource updated successfully');
            setTimeout(() => {
                goto('/admin/iot/resources');
            }, 1000);
        }
    });

    // Delete dialog state
    let deleteState = {
        selectedRecord: resource,
        confirmationOpen: false
    };

    function handleDeleteConfirm() {
        goto('/admin/iot/resources');
    }

    function handleSave() {
        const formEl = document.querySelector('form[action="?/update"]') as HTMLFormElement;
        if (formEl) {
            formEl.requestSubmit();
        }
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
      variant: 'outline'
    },
    {
      label: 'Download',
      icon: Download,
      onClick: () => {
        window.open(`/api/resources/${resource.id}`, '_blank');
      },
      variant: 'outline'
    },
    {
      label: 'Save',
      icon: Save,
      disabled: $submitting,
      onClick: handleSave
    }
  ]}
        compact={true}
        contentSpacing="space-y-4"
>
    <ResourceDetailContent
        {resource}
        formStore={formStore}
        {errors}
        {enhance}
        {submitting}
        {constraints}
        {errorMessage}
        {createdByUser}
        {updatedByUser}
        {accountOptions}
        showAccountField={true}
        {deleteState}
        onDeleteConfirm={handleDeleteConfirm}
        deleteAction="?/delete"
    />
</AdminPageLayout>
