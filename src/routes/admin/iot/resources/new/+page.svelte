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
    import { parseZipFile, parseApkFile, generatePackageName, extractDisplayName, extractVersion } from '$lib/utils/clientZipParser';

    export let data: PageData;
    const title = "Add IoT Application & Resource";
    const pageCrumbs = [
        ["Dashboard", "/admin"],
        ["IoT", "/admin/iot"],
        ["Applications & Resources", "/admin/iot/resources"],
        "Add Application & Resource"
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
    
    // File parsing state
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

    function syncToNativeInput(file: File | null) {
        if (nativeFileInput && file) {
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

        // Reset form fields for new file upload
        $form.name = file.name.split('.')[0];
        $form.packageName = '';
        $form.version = '';
        $form.versionCode = null;
        $form.signature = null;
        $form.size = file.size;
        $form.path = `Auto-generated from: ${file.name}`;

        nameError = '';
        
        // Set uploadedFiles for the upload component
        uploadedFiles = files;
        
        // Parse file if it's a supported format
        const fileName = file.name.toLowerCase();
        const isSupportedFile = fileName.endsWith('.zip') || fileName.endsWith('.apk') || fileName.endsWith('.cpk');
        isApk = fileName.endsWith('.apk');
        const isCpk = fileName.endsWith('.cpk');
        const isZip = fileName.endsWith('.zip');

        // Reset auto-extraction flag
        isAutoExtracted = false;

        // Set flag for APK/CPK files (will be set to true if parsing succeeds)
        isApkOrCpk = false;
        
        if (isSupportedFile) {
            zipParsing = true;
            zipParseError = '';
            zipParseSuccess = '';
            formLocked = true; // Lock the form during file parsing
            
            try {
                console.log('[File Upload] Before parsing - Form values:', {
                    name: $form.name,
                    packageName: $form.packageName,
                    version: $form.version
                });
                
                // For APK files, parse separately to get versionCode and signature
                if (isApk) {
                    const apkResult = await parseApkFile(file);
                    console.log('[File Upload] APK parse result:', apkResult);

                    if (apkResult.success && apkResult.data) {
                        // Auto-populate package name
                        if (apkResult.data.packageName) {
                            $form.packageName = apkResult.data.packageName;
                        }

                        // Auto-populate version (versionName)
                        if (apkResult.data.versionName) {
                            $form.version = apkResult.data.versionName;
                        }

                        // Auto-populate versionCode (read-only)
                        if (apkResult.data.versionCode !== null && apkResult.data.versionCode !== undefined) {
                            $form.versionCode = apkResult.data.versionCode;
                        }

                        // Auto-populate signature (read-only)
                        if (apkResult.data.signature) {
                            $form.signature = apkResult.data.signature;
                        }

                        // Auto-populate display name (resource name)
                        if (apkResult.data.appName) {
                            $form.name = apkResult.data.appName;
                        }

                        console.log('[File Upload] After APK parsing - Form values:', {
                            name: $form.name,
                            packageName: $form.packageName,
                            version: $form.version,
                            versionCode: $form.versionCode,
                            signature: $form.signature
                        });

                        // Mark as auto-extracted and disable fields
                        isAutoExtracted = true;
                        isApkOrCpk = true;
                        zipParseSuccess = `✓ Successfully parsed APK file`;
                    } else {
                        zipParseError = apkResult.error || 'Failed to parse APK file';
                        uploadError = `APK parsing failed: ${zipParseError}`;
                        console.log('[File Upload] APK parse failed:', { zipParseError, uploadError });
                        isAutoExtracted = false;
                        isApkOrCpk = false;
                    }
                } else {
                    // For ZIP/CPK files, use the existing logic
                    const result = await parseZipFile(file);
                    console.log('[File Upload] Parse result:', result);

                    if (result.success && result.appData) {
                        console.log('[File Upload] appData:', result.appData);

                        // Auto-populate package name
                        const packageName = generatePackageName(result.appData);
                        console.log('[File Upload] Extracted packageName:', packageName);
                        if (packageName) {
                            $form.packageName = packageName;
                            console.log('[File Upload] Set $form.packageName to:', $form.packageName);
                        }

                        // Auto-populate version
                        const version = extractVersion(result.appData);
                        console.log('[File Upload] Extracted version:', version);
                        if (version) {
                            $form.version = version;
                            console.log('[File Upload] Set $form.version to:', $form.version);
                        }

                        // Auto-populate display name (resource name)
                        const displayName = extractDisplayName(result.appData);
                        console.log('[File Upload] Extracted displayName:', displayName);
                        if (displayName) {
                            $form.name = displayName;
                            console.log('[File Upload] Set $form.name to:', $form.name);
                        }

                        console.log('[File Upload] After parsing - Form values:', {
                            name: $form.name,
                            packageName: $form.packageName,
                            version: $form.version
                        });

                        // Mark as auto-extracted and disable fields for ZIP/CPK
                        isAutoExtracted = true;
                        isApkOrCpk = true; // Make fields read-only for successfully parsed ZIP/CPK files

                        const fileType = fileName.endsWith('.cpk') ? 'CPK' : 'ZIP';
                        zipParseSuccess = `✓ Successfully parsed ${fileType} file`;
                    } else {
                        zipParseError = result.error || 'Failed to parse file';
                        uploadError = `File parsing failed: ${zipParseError}`;
                        console.log('[File Upload] Parse failed:', { zipParseError, uploadError });
                        // If parsing failed, allow manual entry
                        isAutoExtracted = false;
                        isApkOrCpk = false;
                    }
                }
            } catch (error) {
                zipParseError = 'Failed to parse file';
                uploadError = `File parsing failed: ${zipParseError}`;
                console.error('[File Upload] Parse exception:', error);
                // If parsing failed, allow manual entry
                isAutoExtracted = false;
                isApkOrCpk = false;
            } finally {
                zipParsing = false;
                formLocked = false; // Unlock the form after file parsing
                console.log('[File Upload] Parsing complete - formLocked:', formLocked);
            }
        } else {
            // Not a supported file type, allow manual entry
            isAutoExtracted = false;
            isApkOrCpk = false;
        }
    }

    async function handleUploadComplete(event: CustomEvent<{ file: File; url: string }>) {
        console.log('[NewResource] Upload complete event received:', event.detail);
        const { file, url } = event.detail;
        
        try {
            console.log('[NewResource] Creating resource record...');
            
            const createResponse = await fetch('/api/v2/resources/create-cloud', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: $form.name || file.name.split('.')[0],
                    description: $form.description || '',
                    type: $form.type || '',
                    version: $form.version || '',
                    versionCode: $form.versionCode ?? null,
                    signature: $form.signature ?? null,
                    releaseType: $form.releaseType || 'Production',
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
                window.location.href = '/admin/iot/resources';
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
        isApkOrCpk = false; // Reset flag when file is removed
        isApk = false; // Reset APK flag when file is removed
        isAutoExtracted = false; // Reset auto-extraction flag

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
                    Form is locked during file validation - please wait...
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
                                    accept=".zip,.cpk,.apk,.deb"
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
                                Only .zip, .cpk, .apk, and .deb files are allowed. Upload a file by dragging and dropping.
                            </p>
                            <!-- ZIP Parsing Status -->
                            {#if zipParsing}
                                <p class="text-xs text-blue-600 font-medium mt-1">
                                    🔄 Parsing file for app.json...
                                </p>
                            {/if}
                            
                            {#if formLocked}
                                <p class="text-xs text-amber-600 font-medium mt-1">
                                    ⏳ Form locked during file validation - please wait...
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
                            {#if isApkOrCpk}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Resource name is automatically extracted from the APK/CPK file, but you can edit it
                                </p>
                            {:else}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Enter a name for this resource
                                </p>
                            {/if}
                        </FormField>

                        <FormField id="releaseType" label="Release Type" required={true} error={$errors.releaseType}>
                            <EnhancedSelect
                                    id="releaseType"
                                    name="releaseType"
                                    bind:value={$form.releaseType}
                                    placeholder="Select release type"
                                    aria-invalid={$errors.releaseType ? 'true' : undefined}
                                    disabled={formLocked}
                                    {...$constraints.releaseType}
                                    options={releaseTypeOptions}
                            />
                            <p class="text-xs text-muted-foreground mt-1">
                                Select the release type for this resource
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
                                    disabled={formLocked || isApkOrCpk}
                                    readonly={isApkOrCpk}
                                    class={isApkOrCpk ? 'bg-muted cursor-not-allowed' : ''}
                                    {...$constraints.version}
                            />
                            {#if isApkOrCpk}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Version is automatically extracted from the APK/CPK file (read-only)
                                </p>
                            {:else}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Version number for binary resources
                                </p>
                            {/if}
                        </FormField>

                        <FormField id="packageName" label="Package Name" error={$errors.packageName}>
                            <Input
                                    id="packageName"
                                    name="packageName"
                                    bind:value={$form.packageName}
                                    placeholder="com.example.app"
                                    aria-invalid={$errors.packageName ? 'true' : undefined}
                                    disabled={formLocked || isApkOrCpk}
                                    readonly={isApkOrCpk}
                                    class={isApkOrCpk ? 'bg-muted cursor-not-allowed' : ''}
                                    {...$constraints.packageName}
                            />
                            {#if isApkOrCpk}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Package name is automatically extracted from the APK/CPK file (read-only)
                                </p>
                            {:else}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Package name for binary resources
                                </p>
                            {/if}
                        </FormField>
                    </FormRow>

                    {#if isApk && ($form.versionCode !== null || $form.signature)}
                        <FormRow columns={2}>
                            <FormField id="versionCode" label="Version Code" error={$errors.versionCode}>
                                <Input
                                        id="versionCode"
                                        name="versionCode"
                                        type="number"
                                        bind:value={$form.versionCode}
                                        placeholder="Auto-extracted from APK"
                                        readonly
                                        disabled
                                        class="bg-muted cursor-not-allowed"
                                        aria-invalid={$errors.versionCode ? 'true' : undefined}
                                />
                                <p class="text-xs text-muted-foreground mt-1">
                                    Version code is automatically extracted from the APK file (read-only, cannot be edited)
                                </p>
                            </FormField>

                            <FormField id="signature" label="Signature" error={$errors.signature}>
                                <Input
                                        id="signature"
                                        name="signature"
                                        type="text"
                                        bind:value={$form.signature}
                                        placeholder="Auto-extracted from APK"
                                        readonly
                                        disabled
                                        class="bg-muted cursor-not-allowed font-mono text-xs"
                                        aria-invalid={$errors.signature ? 'true' : undefined}
                                />
                                <p class="text-xs text-muted-foreground mt-1">
                                    Signature is automatically extracted from the APK file (read-only, cannot be edited)
                                </p>
                            </FormField>
                        </FormRow>
                    {/if}

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
