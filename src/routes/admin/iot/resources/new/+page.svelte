<script lang="ts">
    import { ArrowLeft, Save, FileText, File, Upload } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import SmartFileUpload from "$lib/components/ui_components_sveltekit/form/SmartFileUpload.svelte";
    import type { PageData } from "./$types";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { fileProxy } from 'sveltekit-superforms/client';
    import { browser } from '$app/environment';
    import { parseZipFile, generatePackageName, extractDisplayName, extractVersion } from '$lib/utils/clientZipParser';

    export let data: PageData;
    const title = "Add IoT Resource";
    const pageCrumbs = [
        ["Dashboard", "/admin"],
        ["IoT", "/admin/iot"],
        ["Resources", "/admin/iot/resources"],
        "Add Resource"
    ];

    const {
        form,
        errors,
        enhance,
        submitting,
        constraints,
        errorMessage
    } = createFormHandler(data.form, {
        successRedirect: '/admin/iot/resources',
        validateOnInput: true,
        onSuccess: () => {
            fileField.set(null);
        }
    });

    const fileField = fileProxy(form, 'file');

    let uploadedFiles: File[] = [];
    let uploadError = '';
    let uploadSuccess = '';

    let nameError = '';
    
    // ZIP parsing state
    let zipParsing = false;
    let zipParseSuccess = '';
    let zipParseError = '';
    
    // Form locking state
    let formLocked = false;

    let nativeFileInput: HTMLInputElement | null = null;
    let containerRef: HTMLDivElement;
    let fileUploadRef: any;

    const targetOptions = [
        { value: 'user', label: 'User' },
        { value: 'device', label: 'Device' },
        { value: 'account', label: 'Account' }
    ];

    // Reactive clear of errors
    $: if ($form.name) nameError = '';

    function syncToNativeInput(file: File) {
        if (nativeFileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            nativeFileInput.files = dt.files;
        }
    }

    async function handleFileUpload(event: CustomEvent<{ files: File[] }>) {
        const files = event.detail.files;
        if (files.length === 0) return;

        const file = files[0];
        $fileField = file;
        syncToNativeInput(file);
        
        // Clear previous messages
        uploadSuccess = '';
        uploadError = '';
        zipParseSuccess = '';
        zipParseError = '';

        if (!$form.name || $form.name === '') {
            $form.name = file.name.split('.')[0];
        }

        $form.size = file.size;
        $form.path = `Auto-generated from: ${file.name}`;

        nameError = '';
        
        // Set uploadedFiles for the upload component
        uploadedFiles = files;
        
        // Parse ZIP file if it's a ZIP file
        if (file.name.toLowerCase().endsWith('.zip')) {
            zipParsing = true;
            zipParseError = '';
            zipParseSuccess = '';
            formLocked = true; // Lock the form during ZIP parsing
            
            try {
                const result = await parseZipFile(file);
                
                if (result.success && result.appData) {
                    // Auto-populate package name
                    const packageName = generatePackageName(result.appData);
                    if (packageName) {
                        $form.packageName = packageName;
                    }
                    
                    // Auto-populate version
                    const version = extractVersion(result.appData);
                    if (version && !$form.version) {
                        $form.version = version;
                    }
                    
                    // Auto-populate display name
                    const displayName = extractDisplayName(result.appData);
                    if (displayName && (!$form.name || $form.name === file.name.split('.')[0])) {
                        $form.name = displayName;
                    }
                    
                    zipParseSuccess = `✓ Successfully parsed app.json from ZIP file`;
                } else {
                    zipParseError = result.error || 'Failed to parse ZIP file';
                    uploadError = `ZIP parsing failed: ${zipParseError}`;
                }
            } catch (error) {
                zipParseError = 'Failed to parse ZIP file';
                uploadError = `ZIP parsing failed: ${zipParseError}`;
            } finally {
                zipParsing = false;
                formLocked = false; // Unlock the form after ZIP parsing
            }
        }
    }

    function handleUploadComplete(event: CustomEvent<{ file: File; url: string }>) {
        const { file, url } = event.detail;
        uploadSuccess = `File "${file.name}" uploaded successfully!`;
        uploadError = '';
        $form.path = url; // Update the path with the actual uploaded URL
    }

    function handleUploadProgress(event: CustomEvent<{ file: File; progress: number }>) {
        const { file, progress } = event.detail;
        // You can add progress tracking here if needed
        console.log(`Upload progress for ${file.name}: ${progress}%`);
    }

    function handleUploadError(event: CustomEvent<{ message: string }>) {
        uploadError = event.detail.message;
        uploadSuccess = '';
    }


    function handleFileRemove() {
        $fileField = null;
        uploadSuccess = '';
        uploadError = '';
        zipParseSuccess = '';
        zipParseError = '';
        zipParsing = false;
        formLocked = false; // Unlock form when file is removed
        
        if (['image', 'video', 'document', 'file'].includes($form.type)) {
            $form.path = '';
        }
        $form.size = 0;
        uploadedFiles = [];
        if (nativeFileInput) {
            nativeFileInput.value = '';
        }
    }

    $: if (browser) {
        if ($fileField && typeof File !== 'undefined' && $fileField instanceof File) {
            if (!uploadedFiles.length || uploadedFiles[0] !== $fileField) {
                uploadedFiles = [$fileField];
            }
        } else if (uploadedFiles.length > 0 && $fileField === null) {
            uploadedFiles = [];
        }
    }

    async function submitForm() {
        nameError = $form.name ? '' : 'Resource name is required.';
        if (!$form.file) {
            uploadError = 'File is required.';
        } else {
            uploadError = '';
        }

        if (nameError || uploadError) return;

        if (!containerRef) {
            console.error("Form container missing");
            return;
        }

        const realForm = containerRef.querySelector('form') as HTMLFormElement | null;
        if (!realForm) {
            console.error("Underlying form element not found");
            return;
        }

        if ($fileField && nativeFileInput && (!nativeFileInput.files || nativeFileInput.files.length === 0)) {
            syncToNativeInput($fileField);
        }

        if (typeof realForm.reportValidity === 'function' && !realForm.reportValidity()) {
            return;
        }

        // Upload files first if there are any
        if (fileUploadRef && uploadedFiles.length > 0) {
            try {
                await fileUploadRef.uploadFiles();
            } catch (error) {
                console.error('File upload failed:', error);
                uploadError = 'File upload failed. Please try again.';
                return;
            }
        }

        if (typeof realForm.requestSubmit === 'function') {
            realForm.requestSubmit();
        } else if (typeof realForm.submit === 'function') {
            realForm.submit();
        } else {
            console.error("No submit method available on form");
        }
    }

    $: actionButtons = [
        {
            label: "Back",
            icon: ArrowLeft,
            href: "/admin/iot/resources",
            variant: "outline",
            class: "h-9"
        },
        {
            label: "Save",
            icon: Save,
            class: "h-9 btn-primary",
            disabled: $submitting || formLocked,
            onClick: submitForm
        }
    ];
</script>

<AdminPageLayout
        {title}
        crumbs={pageCrumbs}
        {actionButtons}
        compact={true}
        contentSpacing="space-y-4"
>
    {#if formLocked}
        <div class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div class="flex items-center gap-2">
                <div class="animate-spin">⏳</div>
                <p class="text-amber-800 font-medium">
                    Form is locked during ZIP validation - please wait...
                </p>
            </div>
        </div>
    {/if}
    <div class="w-full space-y-6" bind:this={containerRef}>
        <FormContainer
                method="POST"
                action="?/create"
                enctype="multipart/form-data"
                {enhance}
                novalidate
                errorMessage={$errorMessage}
        >
            <input type="file" name="file" class="sr-only" aria-hidden="true" bind:this={nativeFileInput} />

            <AdminCard
                    title="Upload Resource"
                    description="Drag and drop a file or paste an image"
                    icon={Upload}
                    compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={1}>
                        <FormField id="file" label="File Upload" required={true} error={uploadError || ''}>
                            <SmartFileUpload
                                    bind:this={fileUploadRef}
                                    id="file"
                                    name="file"
                                    accept=".zip,.cpk,.apk"
                                    bind:value={uploadedFiles}
                                    error={uploadError}
                                    disabled={formLocked}
                                    on:change={handleFileUpload}
                                    on:drop={handleFileUpload}
                                    on:paste={handleFileUpload}
                                    on:remove={handleFileRemove}
                                    on:error={handleUploadError}
                                    on:uploadComplete={handleUploadComplete}
                                    on:uploadProgress={handleUploadProgress}
                                    preview={true}
                                    multiple={false}
                                    isAdmin={true}
                                    autoUpload={false}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Only .zip, .cpk, and .apk files are allowed. Upload a file by dragging and dropping.
                            </p>
                            <!-- ZIP Parsing Status -->
                            {#if zipParsing}
                                <p class="text-xs text-blue-600 font-medium mt-1">
                                    🔄 Parsing ZIP file for app.json...
                                </p>
                            {/if}
                            
                            {#if formLocked}
                                <p class="text-xs text-amber-600 font-medium mt-1">
                                    ⏳ Form locked during ZIP validation - please wait...
                                </p>
                            {/if}
                            
                            {#if zipParseSuccess}
                                <p class="text-xs text-green-600 font-medium mt-1">
                                    {zipParseSuccess}
                                </p>
                            {/if}
                            
                            {#if zipParseError}
                                <p class="text-xs text-red-600 font-medium mt-1">
                                    ❌ {zipParseError}
                                </p>
                            {/if}
                            
                            {#if uploadSuccess}
                                <p class="text-xs text-green-600 font-medium mt-1">
                                    ✓ {uploadSuccess}
                                </p>
                            {/if}
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>

            <AdminCard
                    title="Resource Information"
                    description="Add a new IoT resource"
                    icon={File}
                    compact={true}
                    class={formLocked ? 'opacity-50 pointer-events-none' : ''}
            >
                <div class="space-y-6">
                    <FormRow columns={2}>
                        <FormField
                                id="name"
                                label="Resource Name"
                                required={true}
                                error={nameError || $errors.name}
                        >
                            <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    bind:value={$form.name}
                                    placeholder="Enter resource name"
                                    aria-invalid={(nameError || $errors.name) ? 'true' : undefined}
                                    disabled={formLocked}
                                    {...$constraints.name}
                            />
                        </FormField>

                        <!-- Target selection remains -->
                        <FormField id="target" label="Target" error={$errors.target}>
                            <EnhancedSelect
                                    id="target"
                                    name="target"
                                    bind:value={$form.target}
                                    placeholder="Select target"
                                    aria-invalid={$errors.target ? 'true' : undefined}
                                    disabled={formLocked}
                                    {...$constraints.target}
                                    options={targetOptions}
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
                                    disabled={formLocked}
                                    {...$constraints.version}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Version number for binary resources
                            </p>
                        </FormField>

                        <FormField id="packageName" label="Package Name" error={$errors.packageName}>
                            <Input
                                    id="packageName"
                                    name="packageName"
                                    bind:value={$form.packageName}
                                    placeholder="com.example.app"
                                    aria-invalid={$errors.packageName ? 'true' : undefined}
                                    disabled={formLocked}
                                    {...$constraints.packageName}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Package name for binary resources
                            </p>
                        </FormField>
                    </FormRow>

                    <FormRow columns={2}>
                        <FormField id="accountId" label="Account" error={$errors.accountId}>
                            <EnhancedSelect
                                    id="accountId"
                                    name="accountId"
                                    bind:value={$form.accountId}
                                    placeholder="Select account (optional - defaults to system account)"
                                    aria-invalid={$errors.accountId ? 'true' : undefined}
                                    disabled={formLocked}
                                    options={[
                  { value: '', label: 'System Account (Default)' },
                  ...data.accountOptions
                ]}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Select the account to assign this resource to. Leave empty to use the system account.
                            </p>
                        </FormField>
                    </FormRow>

                    <FormRow columns={1}>
                        <FormField id="size" label="Size (bytes)" required={true} error={$errors.size}>
                            <Input
                                    id="size"
                                    name="size"
                                    type="number"
                                    bind:value={$form.size}
                                    placeholder="Auto-calculated from file"
                                    min="0"
                                    readonly
                                    class="bg-muted cursor-not-allowed"
                                    aria-invalid={$errors.size ? 'true' : undefined}
                                    {...$constraints.size}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Size is automatically calculated from the uploaded file
                            </p>
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>

            <AdminCard
                    title="Resource Path"
                    description="Path is automatically generated from uploaded file"
                    icon={FileText}
                    compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={1}>
                        <FormField id="path" label="Path or URL" required={true} error={$errors.path}>
                            <Input
                                    id="path"
                                    name="path"
                                    bind:value={$form.path}
                                    placeholder="Auto-generated from file"
                                    readonly
                                    class="bg-muted cursor-not-allowed"
                                    aria-invalid={$errors.path ? 'true' : undefined}
                                    {...$constraints.path}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Path is automatically generated when file is uploaded
                            </p>
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>
        </FormContainer>
    </div>
</AdminPageLayout>
