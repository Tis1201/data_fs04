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
    import { parseZipFile, parseApkFile, parseApkFileClient, parseApkByPath, parseDebFile, parseDebByPath, parseExeFromFilename, generatePackageName, extractDisplayName, extractVersion } from '$lib/utils/clientZipParser';
    
    export let data: PageData;
    const title = "Add Application & Resource";
    const pageCrumbs = [
        ["Home", "/"],
        ["Applications & Resources", "/user/resources"],
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
    
    // Track if file is APK/CPK/ZIP to disable fields when auto-extracted
    let isApkOrCpk = false;
    let isApk = false; // Track if file is specifically an APK (for showing versionCode/signature)
    let isAutoExtracted = false; // Track if fields were auto-extracted (for ZIP/CPK/APK)

    let nativeFileInput: HTMLInputElement | null = null;
    let containerRef: HTMLDivElement;
    let fileUploadRef: any;
    /** When in cloud mode, APK/DEB are uploaded on file select and parsed by path; this stores the GCS URL so submit skips upload. */
    let uploadedCloudPath: string | null = null;
    /** Upload progress 0–100 when uploading to GCloud; null when not uploading */
    let uploadProgress: number | null = null;

    const targetOptions = [
        { value: 'user', label: 'User' },
        { value: 'device', label: 'Device' },
        { value: 'account', label: 'Account' }
    ];
    
    // Reactive clear of errors
    $: if ($form.name) nameError = '';
    $: formDisabled = formLocked || zipParsing || (uploadProgress != null && uploadProgress < 100) || !!zipParseError;

    /** Upload file to presigned URL with progress (XHR for real %). */
    function uploadToPresignedUrlWithProgress(
        url: string,
        file: File,
        contentType: string,
        onProgress: (percent: number) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url);
            xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            });
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve();
                else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            });
            xhr.addEventListener('error', () => reject(new Error('Upload failed')));
            xhr.send(file);
        });
    }

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
        const isSupportedFile = fileName.endsWith('.zip') || fileName.endsWith('.apk') || fileName.endsWith('.cpk') || fileName.endsWith('.deb') || fileName.endsWith('.exe');
        isApk = fileName.endsWith('.apk');
        const isCpk = fileName.endsWith('.cpk');
        const isZip = fileName.endsWith('.zip');
        const isDeb = fileName.endsWith('.deb');
        const isExe = fileName.endsWith('.exe');

        // Reset auto-extraction flag
        isAutoExtracted = false;

        // Set flag for APK/CPK files (will be set to true if parsing succeeds)
        isApkOrCpk = false;

        const isCloudMode = data.storageConfig?.mode === 'LOCAL_CLOUD' || data.storageConfig?.mode === 'GCLOUD';

        if (isSupportedFile) {
            zipParsing = true;
            zipParseError = '';
            zipParseSuccess = '';
            formLocked = true; // Lock the form during file parsing
            uploadedCloudPath = null;

            try {
                console.log('[File Upload] Before parsing - Form values:', {
                    name: $form.name,
                    packageName: $form.packageName,
                    version: $form.version
                });

                let bucketVal = null;
                let objectPathVal = null;

                // In cloud mode: upload ALL supported file types to GCloud first (no file goes to server)
                if (isCloudMode) {
                    const presignedRes = await fetch('/api/v2/upload/presigned-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileName: file.name,
                            contentType: file.type || '',
                            expiresSeconds: 600,
                            prefix: 'temp/resources'
                        })
                    });
                    if (!presignedRes.ok) {
                        const err = await presignedRes.json();
                        throw new Error(err.details || err.error || 'Failed to get upload URL');
                    }
                    const { data: presignedData } = await presignedRes.json();
                    const { url, bucket, objectPath, contentType } = presignedData;
                    if (!url || !bucket || !objectPath) {
                        throw new Error('Invalid presigned URL response');
                    }
                    bucketVal = bucket;
                    objectPathVal = objectPath;
                    uploadProgress = 0;
                    await uploadToPresignedUrlWithProgress(
                        url,
                        file,
                        contentType || file.type || 'application/octet-stream',
                        (p) => { uploadProgress = p; }
                    );
                    uploadProgress = null;
                    uploadedCloudPath = `https://storage.googleapis.com/${bucket}/${objectPath}`;
                    $form.path = uploadedCloudPath;
                    $form.size = file.size;
                }

                // Type-specific parsing (metadata only; file already in GCloud when isCloudMode)
                if (isApk) {
                    let apkResult;
                    if (uploadedCloudPath && objectPathVal && bucketVal) {
                        apkResult = await parseApkByPath(objectPathVal, bucketVal);
                    } else {
                        apkResult = await parseApkFileClient(file);
                        if (!apkResult.success) {
                            apkResult = await parseApkFile(file);
                        }
                    }
                    if (apkResult.success && apkResult.data) {
                        if (apkResult.data.packageName) $form.packageName = apkResult.data.packageName;
                        if (apkResult.data.versionName) $form.version = apkResult.data.versionName;
                        if (apkResult.data.versionCode != null) $form.versionCode = apkResult.data.versionCode;
                        if (apkResult.data.signature) $form.signature = apkResult.data.signature;
                        if (apkResult.data.appName) $form.name = apkResult.data.appName;
                        isAutoExtracted = true;
                        isApkOrCpk = true;
                        zipParseSuccess = uploadedCloudPath ? '✓ Successfully parsed APK file ' : '✓ Successfully parsed APK file';
                    } else {
                        zipParseError = apkResult.error || 'Failed to parse APK file';
                        uploadError = `APK parsing failed: ${zipParseError}`;
                        isAutoExtracted = false;
                        isApkOrCpk = false;
                    }
                } else if (isDeb) {
                    let debResult;
                    if (uploadedCloudPath && objectPathVal && bucketVal) {
                        debResult = await parseDebByPath(objectPathVal, bucketVal);
                    } else {
                        debResult = await parseDebFile(file);
                    }
                    if (debResult.success && debResult.data) {
                        $form.packageName = debResult.data.packageName;
                        $form.version = debResult.data.version;
                        $form.name = debResult.data.packageName || debResult.data.description || $form.name;
                        isAutoExtracted = true;
                        isApkOrCpk = true;
                        zipParseSuccess = '✓ Successfully parsed DEB file ';
                    } else {
                        zipParseError = debResult.error || 'Failed to parse DEB file';
                        uploadError = `DEB parsing failed: ${zipParseError}`;
                        isAutoExtracted = false;
                        isApkOrCpk = false;
                    }
                } else if (isExe) {
                    const exeResult = parseExeFromFilename(file.name);
                    if (exeResult.success && exeResult.data) {
                        $form.packageName = exeResult.data.packageName;
                        if (exeResult.data.version) $form.version = exeResult.data.version;
                        $form.name = $form.name || exeResult.data.packageName;
                        isAutoExtracted = true;
                        isApkOrCpk = true;
                        zipParseSuccess = '✓ Successfully parsed EXE file';
                    } else {
                        zipParseError = exeResult.error || 'Failed to parse EXE file';
                        uploadError = `EXE parsing failed: ${zipParseError}`;
                        isAutoExtracted = false;
                        isApkOrCpk = false;
                    }
                } else {
                    // For ZIP/CPK (and DEB when not cloud), use the existing logic
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
                        isApkOrCpk = true;

                        const fileType = fileName.endsWith('.cpk') ? 'CPK' : 'ZIP';
                        zipParseSuccess = `✓ Successfully parsed ${fileType} file`;
                    } else {
                        zipParseError = result.error || 'Failed to parse file';
                        uploadError = `File parsing failed: ${zipParseError}`;
                        console.log('[File Upload] Parse failed:', { zipParseError, uploadError });
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
                formLocked = false;
                uploadProgress = null;
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
                    target: $form.target || 'user',
                    version: $form.version || '',
                    versionCode: $form.versionCode ?? null,
                    signature: $form.signature ?? null,
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
        isApkOrCpk = false; // Reset flag when file is removed
        isApk = false; // Reset APK flag when file is removed
        isAutoExtracted = false; // Reset auto-extraction flag
        uploadedCloudPath = null;
        uploadProgress = null;

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
        if (zipParseError) return;
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
                // File already uploaded on select (APK/DEB parse-by-path flow) — create resource directly
                if (uploadedCloudPath) {
                    console.log('[NewResource] Using already-uploaded cloud path, creating resource...');
                    const createResponse = await fetch('/api/v2/resources/create-cloud', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: $form.name || $form.file?.name?.split('.')[0] || 'Resource',
                            description: $form.description || '',
                            type: $form.type || '',
                            target: $form.target || 'user',
                            version: $form.version || '',
                            versionCode: $form.versionCode ?? null,
                            signature: $form.signature ?? null,
                            format: $form.format || '',
                            packageName: $form.packageName || '',
                            path: uploadedCloudPath,
                            size: $form.size || 0,
                            accountId: $form.accountId || ''
                        })
                    });
                    if (!createResponse.ok) {
                        const error = await createResponse.json();
                        throw new Error(error.message || 'Failed to create resource record');
                    }
                    const result = await createResponse.json();
                    uploadSuccess = `Resource "${result.data?.resourceId || 'created'}" created successfully!`;
                    uploadError = '';
                    setTimeout(() => { window.location.href = '/user/resources'; }, 1500);
                    return;
                }
                console.log('[NewResource] Cloud mode detected, using CloudFileUpload...');
                if (fileUploadRef && typeof fileUploadRef.uploadFiles === 'function') {
                    console.log('[NewResource] Calling SmartFileUpload.uploadFiles()...');
                    await fileUploadRef.uploadFiles();
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
            disabled: $submitting || formDisabled,
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
                                    accept=".zip,.cpk,.apk,.deb,.exe"
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
                                Only .zip, .cpk, .apk, .deb, and .exe files are allowed. Upload a file by dragging and dropping.
                            </p>
                            
                            <!-- Upload / parsing status -->
                            {#if uploadProgress != null}
                                <p class="text-xs text-blue-600 font-medium mt-1">
                                    Uploading to server {uploadProgress}%
                                </p>
                                <div class="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100">
                                    <div class="h-full bg-primary rounded-full transition-[width] duration-150" style="width: {uploadProgress}%;"></div>
                                </div>
                            {:else if zipParsing}
                                <p class="text-xs text-blue-600 font-medium mt-1">
                                    🔄 Parsing file…
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
                    class={formDisabled ? 'opacity-50 pointer-events-none' : ''}
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
                                    Resource name is automatically extracted from the APK/CPK/ZIP/DEB file, but you can edit it
                                </p>
                            {:else}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Enter a name for this resource
                                </p>
                            {/if}
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
                                    disabled={formLocked || isApkOrCpk}
                                    readonly={isApkOrCpk}
                                    class={isApkOrCpk ? 'bg-muted cursor-not-allowed' : ''}
                                    {...$constraints.version}
                            />
                            {#if isApkOrCpk}
                                <p class="text-xs text-muted-foreground mt-1">
                                    Version is automatically extracted from the APK/CPK/ZIP/DEB file (read-only)
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
                                    Package name is automatically extracted from the APK/CPK/ZIP/DEB file (read-only)
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
                    class={formDisabled ? 'opacity-50 pointer-events-none' : ''}
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
