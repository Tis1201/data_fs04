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
    const title = "Add Resource";
    const pageCrumbs = [
        ["Home", "/"],
        ["Resources", "/user/resources"],
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
        successRedirect: '/user/resources',
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
        console.log('[File Upload] handleFileUpload called with files:', event.detail.files);
        
        const files = event.detail.files;
        if (files.length === 0) {
            console.log('[File Upload] No files provided');
            return;
        }

        const file = files[0];
        console.log('[File Upload] Processing file:', {
            name: file.name,
            size: file.size,
            type: file.type,
            isZip: file.name.toLowerCase().endsWith('.zip')
        });
        
        $fileField = file;
        syncToNativeInput(file);
        
        // Clear previous messages
        uploadSuccess = '';
        uploadError = '';
        zipParseSuccess = '';
        zipParseError = '';

        if (!$form.name || $form.name === '') {
            $form.name = file.name.split('.')[0];
            console.log('[File Upload] Set default name:', $form.name);
        }

        $form.size = file.size;
        $form.path = `Auto-generated from: ${file.name}`;

        nameError = '';
        
        // Set uploadedFiles for the upload component
        uploadedFiles = files;
        
        // Parse ZIP/APK/CPK file if it's a supported file
        if (file.name.toLowerCase().endsWith('.zip') || 
            file.name.toLowerCase().endsWith('.apk') || 
            file.name.toLowerCase().endsWith('.cpk')) {
            zipParsing = true;
            zipParseError = '';
            zipParseSuccess = '';
            formLocked = true; // Lock the form during file parsing
            
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
                    
                    const fileType = file.name.endsWith('.apk') ? 'APK' : file.name.endsWith('.cpk') ? 'CPK' : 'ZIP';
                    zipParseSuccess = `✓ Successfully parsed app.json from ${fileType} file`;
                } else {
                    const fileType = file.name.endsWith('.apk') ? 'APK' : file.name.endsWith('.cpk') ? 'CPK' : 'ZIP';
                    zipParseError = result.error || `Failed to parse ${fileType} file`;
                    uploadError = `File parsing failed: ${zipParseError}`;
                }
            } catch (error) {
                const fileType = file.name.endsWith('.apk') ? 'APK' : file.name.endsWith('.cpk') ? 'CPK' : 'ZIP';
                zipParseError = `Failed to parse ${fileType} file`;
                uploadError = `File parsing failed: ${zipParseError}`;
            } finally {
                zipParsing = false;
                formLocked = false; // Unlock the form after ZIP parsing
            }
        }
    }

    async function handleUploadComplete(event: CustomEvent<{ file: File; url: string }>) {
        console.log('[NewResource] Upload complete event received:', event.detail);
        const { file, url } = event.detail;
        
        try {
            console.log('[NewResource] Creating resource record...');
            
            // Create resource record using cloud endpoint
            const createResponse = await fetch('/api/user/resources/create-cloud', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: $form.name || file.name.split('.')[0],
                    description: $form.description || '',
                    type: $form.type || '',
                    target: $form.target || 'user',
                    version: $form.version || '',
                    format: $form.format || '',
                    packageName: $form.packageName || '',
                    path: url,
                    size: file.size,
                    accountId: $form.accountId || ''
                })
            });

            if (!createResponse.ok) {
                const error = await createResponse.json();
                throw new Error(error.message || 'Failed to create resource record');
            }

            const result = await createResponse.json();
            console.log('[NewResource] Cloud resource created successfully:', result);
            
            uploadSuccess = `Resource "${result.data?.resourceId || 'created'}" created successfully!`;
            uploadError = '';
            
            // Redirect to resources list after successful creation
            setTimeout(() => {
                window.location.href = '/user/resources';
            }, 1500);
            
        } catch (error) {
            console.error('[NewResource] Error creating resource record:', error);
            uploadError = 'Failed to create resource record: ' + (error instanceof Error ? error.message : String(error));
        }
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
        console.log('[NewResource] submitForm called');
        console.log('[NewResource] Form data:', { name: $form.name, path: $form.path, file: $form.file });
        
        nameError = $form.name ? '' : 'Resource name is required.';
        
        // Check if file exists
        if (!$form.file) {
            uploadError = 'File is required.';
        } else {
            uploadError = '';
        }

        if (nameError || uploadError) {
            console.log('[NewResource] Form validation failed:', { nameError, uploadError });
            return;
        }

        if (!$form.file) {
            console.error("No file selected");
            return;
        }

        try {
            // Check if this is a cloud storage mode (LOCAL_CLOUD or GCLOUD)
            console.log('[NewResource] Storage config:', data.storageConfig);
            const isCloudMode = data.storageConfig?.mode === 'LOCAL_CLOUD' || data.storageConfig?.mode === 'GCLOUD';
            console.log('[NewResource] Is cloud mode:', isCloudMode);
            
            if (isCloudMode) {
                console.log('[NewResource] Cloud mode detected, using CloudFileUpload...');
                
                // Use SmartFileUpload component's upload method
                if (fileUploadRef && typeof fileUploadRef.uploadFiles === 'function') {
                    console.log('[NewResource] Calling SmartFileUpload.uploadFiles()...');
                    await fileUploadRef.uploadFiles();
                    
                    // The uploadComplete event will be handled by handleUploadComplete
                    // which will create the resource record
                } else {
                    throw new Error('SmartFileUpload component not available');
                }
                
            } else {
                console.log('[NewResource] Local mode detected, using form submission...');
                
                // For local uploads, use the regular form submission
                if (!containerRef) {
                    console.error("Form container missing");
                    return;
                }

                const realForm = containerRef.querySelector('form') as HTMLFormElement | null;
                if (!realForm) {
                    console.error("Underlying form element not found");
                    return;
                }

                // Sync to native input for local file uploads
                if ($fileField && nativeFileInput && (!nativeFileInput.files || nativeFileInput.files.length === 0)) {
                    syncToNativeInput($fileField);
                }

                if (typeof realForm.reportValidity === 'function' && !realForm.reportValidity()) {
                    return;
                }

                // Submit the form for local file uploads
                if (typeof realForm.requestSubmit === 'function') {
                    realForm.requestSubmit();
                } else if (typeof realForm.submit === 'function') {
                    realForm.submit();
                } else {
                    console.error("No submit method available on form");
                }
            }
        } catch (error) {
            console.error('[NewResource] Error during submission:', error);
            uploadError = 'Failed to create resource: ' + (error instanceof Error ? error.message : String(error));
            uploadSuccess = '';
        }
    }

    $: actionButtons = [
        {
            label: "Back",
            icon: ArrowLeft,
            href: "/user/resources",
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
    {actionButtons},
    loading={$submitting}
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
                                    on:change={(e) => {
                                        console.log('[File Upload] change event triggered:', e.detail);
                                        handleFileUpload(e);
                                    }}
                                    on:drop={(e) => {
                                        console.log('[File Upload] drop event triggered:', e.detail);
                                        handleFileUpload(e);
                                    }}
                                    on:paste={(e) => {
                                        console.log('[File Upload] paste event triggered:', e.detail);
                                        handleFileUpload(e);
                                    }}
                                    on:remove={handleFileRemove}
                                    on:error={handleUploadError}
                                    on:uploadComplete={handleUploadComplete}
                                    on:uploadProgress={handleUploadProgress}
                                    preview={true}
                                    multiple={false}
                                    isAdmin={false}
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
                    class={formLocked ? 'opacity-50 pointer-events-none' : ''}
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
