<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Download, Save } from 'lucide-svelte';
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import ResourceDetailContent from '$lib/components/resources/ResourceDetailContent.svelte';
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { toast } from 'svelte-sonner';

    /**
     * Props for ResourceDetailPage component
     */
    export let resource: any;
    export let form: any;
    export let createdByUser: any = null;
    export let updatedByUser: any = null;
    export let accountOptions: any[] = [];
    export let resourceTypes: any[] = [];
    export let title: string;
    export let breadcrumbs: [string, string][];
    export let basePath: string; // "/admin" for admin routes
    export let showAccountField: boolean = true;
    export let deleteAction: string = '?/delete';

    // Make resource reactive to server invalidations
    $: resource = resource;
    $: form = form;

    const { form: formStore, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(form, {
        validateOnInput: true,
        onSuccess: () => {
            toast.success('Resource updated successfully');
            setTimeout(() => {
                goto(`${basePath}/iot/resources`);
            }, 1000);
        }
    });

    // Delete dialog state
    let deleteState = {
        selectedRecord: resource,
        confirmationOpen: false
    };

    function handleDeleteConfirm() {
        goto(`${basePath}/iot/resources`);
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
    crumbs={breadcrumbs}
    actionButtons={[
        {
            label: 'Back',
            icon: ArrowLeft,
            href: `${basePath}/iot/resources`,
            variant: 'outline'
        },
        {
            label: 'Download',
            icon: Download,
            onClick: () => {
                window.open(`/api/resources/${resource?.id}`, '_blank');
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
        {showAccountField}
        {deleteState}
        onDeleteConfirm={handleDeleteConfirm}
        {deleteAction}
    />
</AdminPageLayout>

