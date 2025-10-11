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
    const { resource, form } = data;

    const title = `Resource: ${resource.name || 'Unnamed'}`;

    const pageCrumbs = [
        ['Home', '/'],
        ['Resources', '/user/resources'],
        resource.name || 'Unnamed'
    ];

    const { form: formStore, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(form, {
        validateOnInput: true,
        onSuccess: () => {
            toast.success('Resource updated successfully');
            setTimeout(() => {
                goto('/user/resources');
            }, 1000);
        }
    });

    // Delete dialog state
    let deleteState = {
        selectedRecord: resource,
        confirmationOpen: false
    };

    function handleDeleteConfirm() {
        goto('/user/resources');
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
      href: '/user/resources',
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
        createdByUser={null}
        updatedByUser={null}
        accountOptions={[]}
        showAccountField={false}
        {deleteState}
        onDeleteConfirm={handleDeleteConfirm}
        deleteAction="?/deleteResource"
    />
</AdminPageLayout>
