<script lang="ts">
    import { goto } from "$app/navigation";
    import { ArrowLeft, Save, FileText, File, Upload } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import CardHeader from "$lib/components/ui/card/card-header.svelte";
    import CardTitle from "$lib/components/ui/card/card-title.svelte";
    import CardDescription from "$lib/components/ui/card/card-description.svelte";
    import CardContent from "$lib/components/ui/card/card-content.svelte";
    // import ActionButton from "$lib/components/admin/layout/ActionButton.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedFileUpload from "$lib/components/ui_components_sveltekit/form/EnhancedFileUpload.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Add IoT Resource";

    // Define breadcrumbs for this page - admin context
    const pageCrumbs = [
        ["Dashboard", "/admin"],
        ["IoT", "/admin/iot"],
        ["Resources", "/admin/iot/resources"],
        "Add Resource"
    ];
    
    // Import the reusable form handler and superform tools
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { fileProxy } from 'sveltekit-superforms/client';
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/iot/resources',
        validateOnInput: true,
        onSuccess: () => {
            // Reset file field after successful submission
            fileField.set(null);
        }
    });
    
    // File upload handling with Superform
    let uploadError = '';
    
    // Create a file proxy for the form's file field
    const fileField = fileProxy(form, 'file');
    
    // Track uploaded files for display
    let uploadedFiles: File[] = [];
    
    import { browser } from '$app/environment';
    
    // Sync fileField with uploadedFiles
    $: {
        if (browser && $fileField && typeof File !== 'undefined' && $fileField instanceof File) {
            if (!uploadedFiles?.length || uploadedFiles[0] !== $fileField) {
                uploadedFiles = [$fileField];
            }
        } else if (uploadedFiles?.length > 0 && $fileField === null) {
            uploadedFiles = [];
        }
    }
    
    // Handle file upload
    function handleFileUpload(event: CustomEvent<File[]>) {
        const [file] = event.detail;
        if (file) {
            $form.name = file.name;
            $form.size = file.size;
            $form.type = file.type;
            fileField.set(file);
        }
    }
    
    // Handle file removal
    function handleFileRemove() {
        fileField.set(null);
        uploadedFiles = [];
        
        // Clear related form fields
        if ($form.type === 'image' || $form.type === 'video' || $form.type === 'document' || $form.type === 'file') {
            $form.path = '';
        }
    }
    
    let formElement: HTMLFormElement;
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        href: "/admin/iot/resources",
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: "Save",
        icon: Save,
        type: "submit",
        class: "h-9", // Fixed height for consistency
        disabled: $submitting
      }
    ]}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
            <FormContainer
                method="POST"
                action="?/create"
                enctype="multipart/form-data"
                {enhance}
                novalidate
                errorMessage={$errorMessage}
                bind:this={formElement}
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
                                        bind:value={uploadedFiles}
                                        on:change={handleFileUpload}
                                        on:clear={handleFileRemove}
                                        accept="*/*"
                                        maxSize={100 * 1024 * 1024}
                                        multiple={false}
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
                    description="Add a new IoT resource"
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
                                <FormField id="description" label="Description" error={$errors.description}>
                                    <Textarea
                                        id="description"
                                        name="description"
                                        bind:value={$form.description}
                                        placeholder="Enter resource description"
                                        rows="3"
                                        aria-invalid={$errors.description ? 'true' : undefined}
                                        {...$constraints.description}
                                    />
                                </FormField>
                                
                                <FormField id="target" label="Target" error={$errors.target}>
                                    <EnhancedSelect
                                        id="target"
                                        name="target"
                                        bind:value={$form.target}
                                        placeholder="Select target"
                                        aria-invalid={$errors.target ? 'true' : undefined}
                                        {...$constraints.target}
                                        options={[
                                            { value: 'user', label: 'User' },
                                            { value: 'device', label: 'Device' },
                                            { value: 'account', label: 'Account' }
                                        ]}
                                    />
                                    <p class="text-xs text-muted-foreground mt-1">
                                        Select the target type for this resource
                                    </p>
                                </FormField>
                            </FormRow>
                            
                            <FormRow columns={2}>
                                <FormField id="version" label="Version" error={$errors.version}>
                                    <Input
                                        id="version"
                                        name="version"
                                        bind:value={$form.version}
                                        placeholder="1.0.0"
                                        aria-invalid={$errors.version ? 'true' : undefined}
                                        {...$constraints.version}
                                    />
                                    <p class="text-xs text-muted-foreground mt-1">
                                        Version number for binary resources
                                    </p>
                                </FormField>
                                
                                <FormField id="format" label="Format" error={$errors.format}>
                                    <EnhancedSelect
                                        id="format"
                                        name="format"
                                        bind:value={$form.format}
                                        placeholder="Select format"
                                        aria-invalid={$errors.format ? 'true' : undefined}
                                        {...$constraints.format}
                                        options={[
                                            { value: 'apk', label: 'APK (Android Package)' },
                                            { value: 'bin', label: 'BIN (Binary)' },
                                            { value: 'exe', label: 'EXE (Windows Executable)' },
                                            { value: 'sh', label: 'SH (Shell Script)' },
                                            { value: 'dmg', label: 'DMG (macOS Disk Image)' },
                                            { value: 'pkg', label: 'PKG (Package)' },
                                            { value: 'deb', label: 'DEB (Debian Package)' },
                                            { value: 'rpm', label: 'RPM (Red Hat Package)' },
                                            { value: 'zip', label: 'ZIP (Archive)' }
                                        ]}
                                        allowCustom
                                    />
                                    <p class="text-xs text-muted-foreground mt-1">
                                        Select the format for binary resources
                                    </p>
                                </FormField>
                            </FormRow>
                            
                            <FormRow columns={2}>
                                <FormField id="packageName" label="Package Name" error={$errors.packageName}>
                                    <Input
                                        id="packageName"
                                        name="packageName"
                                        bind:value={$form.packageName}
                                        placeholder="com.example.app"
                                        aria-invalid={$errors.packageName ? 'true' : undefined}
                                        {...$constraints.packageName}
                                    />
                                    <p class="text-xs text-muted-foreground mt-1">
                                        Package name for binary resources
                                    </p>
                                </FormField>
                                
                                <FormField id="accountId" label="Account" error={$errors.accountId}>
                                    <EnhancedSelect
                                        id="accountId"
                                        name="accountId"
                                        bind:value={$form.accountId}
                                        placeholder="Select account"
                                        aria-invalid={$errors.accountId ? 'true' : undefined}
                                        options={data.accountOptions}
                                    />
                                    <p class="text-xs text-muted-foreground mt-1">
                                        Select the account to assign this resource to
                                    </p>
                                </FormField>
                            </FormRow>
                            
                            <FormRow columns={1}>
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
