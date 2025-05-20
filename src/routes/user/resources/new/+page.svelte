<script lang="ts">
    import { goto } from "$app/navigation";
    import { ArrowLeft, Save, FileText, File, Upload } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    
    // Import the correct layout components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedFileUpload from "$lib/components/ui_components_sveltekit/form/EnhancedFileUpload.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Add Resource";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Home", "/"],
        ["Resources", "/user/resources"],
        "Add Resource"
    ];
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/user/resources',
        validateOnInput: true,
        onSuccess: () => {
            // Toast is handled by the redirect
        }
    });
    
    // File upload handling
    let uploadedFiles: File[] = [];
    let uploadError = '';
    
    function handleFileUpload(event: CustomEvent<{files: File[]}>) {
        const files = event.detail.files;
        if (files.length > 0) {
            const file = files[0]; // Take only the first file
            uploadedFiles = [file];
            
            // Auto-fill form fields based on the file
            if (!$form.name || $form.name === '') {
                $form.name = file.name.split('.')[0]; // Use filename without extension
            }
            
            // Set file type based on MIME type
            const mimeType = file.type;
            if (mimeType.startsWith('image/')) {
                $form.type = 'image';
            } else if (mimeType.startsWith('video/')) {
                $form.type = 'video';
            } else if (mimeType.startsWith('text/') || 
                      mimeType.includes('pdf') || 
                      mimeType.includes('document') || 
                      mimeType.includes('spreadsheet') || 
                      mimeType.includes('presentation')) {
                $form.type = 'document';
            } else {
                $form.type = 'file';
            }
            
            // Set file size
            $form.size = file.size;
            
            // Store file in form for later use
            $form.file = file;
            
            // For now, we'll use the file name as the path
            // In a real implementation, you would upload the file to a server
            // and then use the returned URL as the path
            $form.path = file.name;
        }
    }
    
    function handleFileRemove() {
        uploadedFiles = [];
        $form.file = undefined;
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/user/resources'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9" // Fixed height for consistency
      }
    ]}
    loading={$submitting}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
    <FormContainer
        method="POST"
        action="?/create"
        {enhance}
        novalidate
        errorMessage={$errorMessage}
    >
        <AdminCard
            title="Upload Resource"
            description="Drag and drop a file or paste an image"
            icon={Upload}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField id="file" label="File Upload" error={uploadError}>
                        <EnhancedFileUpload
                            id="file"
                            name="file"
                            accept="image/*,video/*,application/*,text/*"
                            bind:value={uploadedFiles}
                            error={uploadError}
                            on:change={handleFileUpload}
                            on:drop={handleFileUpload}
                            on:paste={handleFileUpload}
                            on:remove={handleFileRemove}
                            on:error={(e) => uploadError = e.detail.message}
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            Upload a file by dragging and dropping, or paste an image directly from clipboard.
                        </p>
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <AdminCard
            title="Resource Information"
            description="Add a new resource to your account"
            icon={File}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField id="name" label="Resource Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="Enter resource name"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            {...$constraints.name}
                        />
                    </FormField>
                    
                    <FormField id="type" label="Resource Type" error={$errors.type}>
                        <EnhancedSelect
                            id="type"
                            name="type"
                            bind:value={$form.type}
                            placeholder="Select resource type"
                            aria-invalid={$errors.type ? 'true' : undefined}
                            {...$constraints.type}
                            options={data.resourceTypes}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField id="accountId" label="Account" error={$errors.accountId}>
                        <EnhancedSelect
                            id="accountId"
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            aria-invalid={$errors.accountId ? 'true' : undefined}
                            {...$constraints.accountId}
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
                        />
                    </FormField>

                    <FormField id="size" label="Size (bytes)" error={$errors.size}>
                        <Input
                            id="size"
                            name="size"
                            type="number"
                            bind:value={$form.size}
                            placeholder="Enter size in bytes"
                            min="0"
                            aria-invalid={$errors.size ? 'true' : undefined}
                            {...$constraints.size}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <AdminCard
            title="Resource Path"
            description="Specify the path or URL for this resource"
            icon={FileText}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField id="path" label="Path or URL" error={$errors.path}>
                        <Textarea
                            id="path"
                            name="path"
                            bind:value={$form.path}
                            placeholder="Enter resource path or URL"
                            rows="3"
                            aria-invalid={$errors.path ? 'true' : undefined}
                            {...$constraints.path}
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            Enter the file path or URL where this resource can be accessed.
                        </p>
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
    </FormContainer>
    </div>
</AdminPageLayout>
