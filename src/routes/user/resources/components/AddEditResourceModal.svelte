<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { deserialize } from '$app/forms';
    import {
        Modal,
        Button,
        InputField,
        Dropdown,
        FileUpload,
        Tooltip
    } from '$lib/design-system/components';
    import type { UploadedFile } from '$lib/design-system/components/FileUpload.svelte';
    import { Info, Download } from 'lucide-svelte';
    import {
        parseZipFile,
        parseApkFile,
        parseApkFileClient,
        parseApkByPath,
        parseDebFile,
        parseDebByPath,
        generatePackageName,
        extractDisplayName,
        extractVersion
    } from '$lib/utils/clientZipParser';

    /** Client-safe: infer resource type/format from filename (no server env) */
    function inferTypeAndFormatFromFileName(fileName: string): { type: string; format: string } {
        const format = fileName?.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
        const type =
            format === 'apk' || format === 'deb' ? 'application' :
            format === 'zip' ? 'archive' :
            format === 'cpk' ? 'package' : 'file';
        return { type, format };
    }

    export let open: boolean = false;
    export let mode: 'add' | 'edit' = 'add';
    export let resourceId: string | null = null;
    /** Pre-filled data for edit mode (target is kept for submit only, not shown in form) */
    export let initialData: {
        name?: string;
        packageName?: string;
        target?: string;
        version?: string;
        accountId?: string;
        path?: string;
        type?: string;
        format?: string;
        size?: number;
        releaseType?: string;
        versionCode?: number | null;
        signature?: string | null;
    } | null = null;
    /** Accounts for Account dropdown: { id, name }[] */
    export let accounts: { id: string; name: string }[] = [];
    /** When set (LOCAL_CLOUD/GCLOUD), APK/DEB use upload-to-GCS then parse by path */
    export let storageConfig: { mode: string; bucket?: string } | null = null;

    const dispatch = createEventDispatcher<{
        close: void;
        success: void;
        error: string;
    }>();

    const RELEASE_TYPE_OPTIONS = [
        { id: 'Alpha', label: 'Alpha' },
        { id: 'Beta', label: 'Beta' },
        { id: 'Production', label: 'Production' }
    ];

    const RESOURCE_PATH_TOOLTIP = 'Path is automatically generated from uploaded file';
    const FILE_HELPER = 'Maximum file size 50 MB, and allowed file types: .zip, .cpk, .deb, .apk.';
    const FILE_ACCEPT = '.zip,.cpk,.deb,.apk';

    let submitting = false;
    let errorMessage: string | null = null;
    /** True when error comes from server (fetch) – shown via toast only, not inline */
    let errorFromServer = false;
    let wasOpen = false;

    let name = '';
    let packageName = '';
    let version = '1.0.0';
    let accountId = '';
    let resourcePath = '';
    let releaseType = 'Production';
    let versionCode: number | null = null;
    let signature = '';

    let selectedFile: File | null = null;
    let uploadedFiles: UploadedFile[] = [];
    let zipParsing = false;
    let zipParseSuccess = '';
    let zipParseError = '';
    let isApkOrCpk = false;
    let isApk = false;
    /** When in cloud mode and file was uploaded for parsing, submit uses this path instead of file */
    let uploadedCloudPath: string | null = null;
    /** Upload progress 0–100 when uploading to GCloud; null when not uploading */
    let uploadProgress: number | null = null;

    $: accountOptions = accounts.map((a) => ({ id: a.id, label: a.name }));

    /** Upload file to presigned URL with progress (XHR so we get real %). */
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

    // Only sync when modal opens: edit = fill from initialData; add = reset once when opening
    $: if (open) {
        if (!wasOpen) {
            errorMessage = null;
            errorFromServer = false;
            zipParseSuccess = '';
            zipParseError = '';
            isApkOrCpk = false;
            isApk = false;
            if (mode === 'edit' && initialData) {
                name = initialData.name ?? '';
                packageName = initialData.packageName ?? '';
                version = initialData.version ?? '1.0.0';
                accountId = initialData.accountId ?? '';
                resourcePath = initialData.path ?? '';
                releaseType = initialData.releaseType ?? 'Production';
                versionCode = initialData.versionCode ?? null;
                signature = initialData.signature ?? '';
            } else if (mode === 'add') {
                name = '';
                packageName = '';
                version = '1.0.0';
                accountId = accounts[0]?.id ?? '';
                resourcePath = '';
                releaseType = 'Production';
                versionCode = null;
                signature = '';
                selectedFile = null;
                uploadedFiles = [];
                uploadedCloudPath = null;
            }
        }
        wasOpen = true;
    } else {
        wasOpen = false;
    }

    const RESOURCE_NAME_REQUIRED = 'Resource name is required';
    const FILE_REQUIRED = 'Resource upload file is required';
    const ACCOUNT_REQUIRED = 'Please select Account';
    $: resourceNameError = errorMessage === RESOURCE_NAME_REQUIRED ? errorMessage : '';
    $: fileUploadError = errorMessage === FILE_REQUIRED;
    $: accountError = errorMessage === ACCOUNT_REQUIRED;
    // Clear resource name error when user fills name (or it’s auto-filled from file) so UI stays in sync
    $: if (name?.trim() && errorMessage === RESOURCE_NAME_REQUIRED) errorMessage = null;
    // Clear file required error when user uploads a file so validation reflects current state
    $: if (mode === 'add' && (selectedFile != null || uploadedFiles.length > 0) && errorMessage === FILE_REQUIRED) errorMessage = null;
    $: serverFileError = errorMessage != null && errorMessage !== RESOURCE_NAME_REQUIRED && errorMessage !== FILE_REQUIRED && errorMessage !== ACCOUNT_REQUIRED && isFileRelatedError(errorMessage);
    function isFileRelatedError(msg: string): boolean {
        const lower = msg.toLowerCase();
        return lower.includes('file') || lower.includes('upload') || lower.includes('allowed') || lower.includes('type') || lower.includes('format') || lower.includes('extension');
    }

    function fileBaseName(fileName: string): string {
        return fileName.includes('.') ? fileName.split('.').slice(0, -1).join('.') : fileName;
    }
    function toPackageSlug(name: string): string {
        return name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_-]/g, '');
    }
    async function handleFileDrop(e: CustomEvent<FileList>) {
        const list = e.detail;
        if (!list?.length) return;
        const file = list[0];
        selectedFile = file;
        uploadedFiles = [
            {
                id: crypto.randomUUID(),
                name: file.name,
                size: file.size,
                progress: 100,
                state: 'success'
            }
        ];
        const base = fileBaseName(file.name);
        name = name?.trim() || base;
        const slug = toPackageSlug(base);
        if (!packageName?.trim() && slug) packageName = `${slug}_v1`;
        version = '1.0.0';
        versionCode = null;
        signature = '';
        zipParseSuccess = '';
        zipParseError = '';
        isApkOrCpk = false;
        isApk = false;
        uploadedCloudPath = null;

        const fileName = file.name.toLowerCase();
        const isSupported = fileName.endsWith('.zip') || fileName.endsWith('.apk') || fileName.endsWith('.cpk') || fileName.endsWith('.deb');
        isApk = fileName.endsWith('.apk');
        const isDeb = fileName.endsWith('.deb');
        const isCloudMode = storageConfig?.mode === 'LOCAL_CLOUD' || storageConfig?.mode === 'GCLOUD';

        if (isSupported) {
            zipParsing = true;
            try {
                if (isApk) {
                    let apkResult = await parseApkFileClient(file);
                    if (!apkResult.success && isCloudMode) {
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
                        uploadProgress = 0;
                        uploadedFiles = [{ id: uploadedFiles[0]?.id ?? crypto.randomUUID(), name: file.name, size: file.size, progress: 0, state: 'ongoing' }];
                        await uploadToPresignedUrlWithProgress(
                            url,
                            file,
                            contentType || file.type || 'application/octet-stream',
                            (p) => {
                                uploadProgress = p;
                                if (uploadedFiles[0]) uploadedFiles = [{ ...uploadedFiles[0], progress: p }];
                            }
                        );
                        uploadProgress = null;
                        uploadedFiles = [{ id: uploadedFiles[0]?.id ?? crypto.randomUUID(), name: file.name, size: file.size, progress: 100, state: 'success' }];
                        uploadedCloudPath = `https://storage.googleapis.com/${bucket}/${objectPath}`;
                        resourcePath = uploadedCloudPath;
                        apkResult = await parseApkByPath(objectPath, bucket);
                    } else if (!apkResult.success) {
                        apkResult = await parseApkFile(file);
                    }
                    if (apkResult.success && apkResult.data) {
                        if (apkResult.data.packageName) packageName = apkResult.data.packageName;
                        if (apkResult.data.versionName) version = apkResult.data.versionName;
                        if (apkResult.data.versionCode != null) versionCode = apkResult.data.versionCode;
                        if (apkResult.data.signature) signature = apkResult.data.signature;
                        if (apkResult.data.appName) name = apkResult.data.appName;
                        isApkOrCpk = true;
                        zipParseSuccess = uploadedCloudPath ? '✓ Successfully parsed APK file ' : '✓ Successfully parsed APK file';
                    } else {
                        zipParseError = apkResult.error || 'Failed to parse APK file';
                    }
                } else if (isCloudMode && isDeb) {
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
                    uploadProgress = 0;
                    uploadedFiles = [{ id: uploadedFiles[0]?.id ?? crypto.randomUUID(), name: file.name, size: file.size, progress: 0, state: 'ongoing' }];
                    await uploadToPresignedUrlWithProgress(
                        url,
                        file,
                        contentType || file.type || 'application/octet-stream',
                        (p) => {
                            uploadProgress = p;
                            if (uploadedFiles[0]) uploadedFiles = [{ ...uploadedFiles[0], progress: p }];
                        }
                    );
                    uploadProgress = null;
                    uploadedFiles = [{ id: uploadedFiles[0]?.id ?? crypto.randomUUID(), name: file.name, size: file.size, progress: 100, state: 'success' }];
                    uploadedCloudPath = `https://storage.googleapis.com/${bucket}/${objectPath}`;
                    resourcePath = uploadedCloudPath;
                    const debResult = await parseDebByPath(objectPath, bucket);
                    if (debResult.success && debResult.data) {
                        packageName = debResult.data.packageName;
                        version = debResult.data.version;
                        name = debResult.data.packageName || debResult.data.description || name;
                        isApkOrCpk = true;
                        zipParseSuccess = '✓ Successfully parsed DEB file ';
                    } else {
                        zipParseError = debResult.error || 'Failed to parse DEB file';
                    }
                } else {
                    if (isDeb) {
                        const debResult = await parseDebFile(file);
                        if (debResult.success && debResult.data) {
                            packageName = debResult.data.packageName;
                            version = debResult.data.version;
                            name = debResult.data.packageName || debResult.data.description || name;
                            isApkOrCpk = true;
                            zipParseSuccess = '✓ Successfully parsed DEB file';
                        } else {
                            zipParseError = debResult.error || 'Failed to parse DEB file';
                        }
                    } else {
                        const result = await parseZipFile(file);
                        if (result.success && result.appData) {
                            const pkg = generatePackageName(result.appData);
                            if (pkg) packageName = pkg;
                            const ver = extractVersion(result.appData);
                            if (ver) version = ver;
                            const displayName = extractDisplayName(result.appData);
                            if (displayName) name = displayName;
                            isApkOrCpk = true;
                            const fileType = fileName.endsWith('.cpk') ? 'CPK' : 'ZIP';
                            zipParseSuccess = `✓ Successfully parsed ${fileType} file`;
                        } else {
                            zipParseError = result.error || 'Failed to parse file';
                        }
                    }
                }
            } catch (err) {
                zipParseError = err instanceof Error ? err.message : 'Failed to parse file';
            } finally {
                zipParsing = false;
                uploadProgress = null;
            }
        }
    }

    function handleFileRemove() {
        selectedFile = null;
        uploadedFiles = [];
        uploadedCloudPath = null;
        resourcePath = '';
        versionCode = null;
        signature = '';
        zipParseSuccess = '';
        zipParseError = '';
        isApkOrCpk = false;
        isApk = false;
        uploadProgress = null;
    }

    /** Recursively find first string that looks like an error message (e.g. contains "already exists") */
    function findErrorMessageInObject(obj: unknown): string | null {
        if (typeof obj === 'string') {
            if (obj.includes('already exists')) {
                const m = obj.match(/"([^"]*already exists[^"]*)"/);
                return m ? m[1] : (obj.length < 500 ? obj : null);
            }
            if (obj.length > 10 && obj.length < 300) return obj;
            return null;
        }
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = findErrorMessageInObject(item);
                if (found) return found;
            }
            return null;
        }
        const o = obj as Record<string, unknown>;
        const order = ['message', 'error', 'details', 'data', 'form'];
        for (const key of order) {
            const val = o[key];
            if (typeof val === 'string' && (val.includes('already exists') || val.includes('Invalid') || val.length > 20)) return val;
            if (val && typeof val === 'object') {
                const nested = key === 'error' && (val as Record<string, unknown>).message
                    ? (val as { message: string }).message
                    : findErrorMessageInObject(val);
                if (nested) return nested;
            }
        }
        for (const v of Object.values(o)) {
            const found = findErrorMessageInObject(v);
            if (found) return found;
        }
        return null;
    }

    function toErrorMessage(v: unknown): string {
        if (typeof v === 'string') return v;
        // SvelteKit form action: success has result.form, failure has result.data (object or devalue string)
        if (v && typeof v === 'object') {
            const o = v as Record<string, unknown>;
            let form = (o.data as Record<string, unknown>)?.form ?? o.form;
            if (!form && typeof o.data === 'string') {
                try {
                    const parsed = deserialize(o.data) as Record<string, unknown>;
                    form = parsed?.form;
                } catch {
                    /* ignore */
                }
            }
            const formObj = form as Record<string, unknown> | undefined;
            const msg = formObj?.message as Record<string, unknown> | undefined;
            const err = msg?.error as Record<string, unknown> | undefined;
            if (typeof err?.message === 'string' && err.message.trim()) return err.message;
        }
        const found = findErrorMessageInObject(v);
        if (found) return found;
        if (!v || typeof v !== 'object') return 'Unable to add resource. Please try again!';
        const o = v as Record<string, unknown>;
        const err = o.error as Record<string, unknown> | undefined;
        if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
        if (err && typeof err.details === 'string' && err.details.trim()) return err.details;
        if (typeof o.message === 'string' && o.message.trim()) return o.message;
        if (Array.isArray(o.errors) && o.errors[0] && typeof (o.errors[0] as Record<string, unknown>).message === 'string') {
            return (o.errors[0] as { message: string }).message;
        }
        const dataStr = typeof o.data === 'string' ? o.data : '';
        if (dataStr.includes('Invalid file format') || dataStr.includes('Only .zip')) {
            const detailsMatch = dataStr.match(/Only [^"]+files are allowed/);
            return detailsMatch ? detailsMatch[0].trim() : 'Invalid file format. Only .zip, .cpk, .deb and .apk files are allowed.';
        }
        // Fallback: data may be devalue string; extract message containing "already exists"
        if (dataStr.includes('already exists')) {
            const match = dataStr.match(/"([^"]*already exists[^"]*)"/);
            if (match) return match[1];
        }
        return 'Unable to add resource. Please try again!';
    }

    async function handleSubmit() {
        if (mode === 'add' && zipParseError) return;
        errorMessage = null;
        errorFromServer = false;
        if (!name?.trim()) {
            errorMessage = RESOURCE_NAME_REQUIRED;
            return;
        }
        if (mode === 'add' && !selectedFile) {
            errorMessage = FILE_REQUIRED;
            return;
        }
        if (!accountId?.trim()) {
            errorMessage = ACCOUNT_REQUIRED;
            return;
        }
        submitting = true;
        try {
            const fd = new FormData();
            fd.set('name', name.trim());
            fd.set('packageName', packageName.trim());
            fd.set('target', mode === 'edit' ? (initialData?.target ?? 'user') : 'user');
            fd.set('version', version.trim() || '1.0.0');
            fd.set('accountId', accountId);
            fd.set('releaseType', releaseType);
            if (versionCode != null) fd.set('versionCode', String(versionCode));
            if (signature) fd.set('signature', signature);

            if (mode === 'add') {
                if (uploadedCloudPath && selectedFile) {
                    fd.set('path', uploadedCloudPath);
                    fd.set('size', String(selectedFile.size));
                    const { type: inferredType, format: inferredFormat } = inferTypeAndFormatFromFileName(selectedFile.name);
                    fd.set('type', inferredType);
                    fd.set('format', inferredFormat);
                } else if (selectedFile) {
                    fd.set('file', selectedFile);
                    fd.set('size', String(selectedFile.size));
                }
                const res = await fetch('/user/resources/new?/create', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                const raw = await res.text();
                let result: Record<string, unknown> = {};
                try {
                    result = (typeof raw === 'string' && raw.trim() ? deserialize(raw) : {}) as Record<string, unknown>;
                } catch {
                    result = {};
                }
                const form = (result?.data as Record<string, unknown>)?.form ?? result?.form;
                const formMsg = form && typeof form === 'object' ? (form as Record<string, unknown>).message as Record<string, unknown> | undefined : undefined;
                const msgData = formMsg?.data as Record<string, unknown> | undefined;
                const isSuccess =
                    result.type === 'success' ||
                    (form && typeof form === 'object' && (form as Record<string, unknown>).valid === true) ||
                    (formMsg?.success === true && (msgData?.resourceId ?? msgData?.accountId));
                if (isSuccess) {
                    dispatch('success');
                } else {
                    let msg = toErrorMessage(result);
                    if (!msg || msg === 'Unable to add resource. Please try again!') {
                        const fromRaw = raw?.includes?.('already exists')
                            ? (raw.match(/"([^"]*already exists[^"]*)"/)?.[1] ?? msg)
                            : null;
                        if (fromRaw) msg = fromRaw;
                    }
                    msg = msg || 'Unable to add resource. Please try again!';
                    errorFromServer = true;
                    errorMessage = null;
                    if (uploadedFiles.length > 0 && isFileRelatedError(msg)) {
                        uploadedFiles = uploadedFiles.map((f) => ({ ...f, state: 'failed' as const, errorMessage: msg }));
                    }
                    dispatch('error', msg);
                }
            } else {
                if (!resourceId) {
                    errorMessage = 'Resource ID is missing';
                    submitting = false;
                    return;
                }
                fd.set('description', '');
                fd.set('type', initialData?.type ?? 'application');
                fd.set('format', initialData?.format ?? 'zip');
                fd.set('path', initialData?.path ?? '');
                fd.set('size', String(initialData?.size ?? 0));
                fd.set('releaseType', releaseType);
                if (versionCode != null) fd.set('versionCode', String(versionCode));
                if (signature) fd.set('signature', signature);
                const res = await fetch(`/user/resources/${resourceId}?/update`, {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                const raw = await res.text();
                const result = typeof raw === 'string' && raw.trim() ? (deserialize(raw) as Record<string, unknown>) : {};
                const form = (result?.data as Record<string, unknown>)?.form ?? result?.form;
                const formValid = form && typeof form === 'object' && (form as Record<string, unknown>).valid === true;
                const formMsg = form && typeof form === 'object' ? (form as Record<string, unknown>).message as Record<string, unknown> | undefined : undefined;
                if (result.type === 'success' || formValid || formMsg?.success === true) {
                    dispatch('success');
                } else {
                    const updateMsg = toErrorMessage(result) || 'Unable to update resource. Please try again!';
                    errorFromServer = true;
                    errorMessage = null;
                    dispatch('error', updateMsg);
                }
            }
        } catch (e) {
            const msg = toErrorMessage(e) || 'Unable to add resource. Please try again!';
            errorFromServer = true;
            errorMessage = null;
            dispatch('error', msg);
        } finally {
            submitting = false;
        }
    }

    function handleClose() {
        dispatch('close');
    }
</script>

<Modal
    open={open}
    title={mode === 'add' ? 'Add resource' : 'Edit resource'}
    size="lg"
    showFooter={false}
    on:close={handleClose}
>
    <form on:submit|preventDefault={handleSubmit} class="resource-modal-form">
        {#if errorMessage && !errorFromServer && errorMessage !== RESOURCE_NAME_REQUIRED && errorMessage !== FILE_REQUIRED && errorMessage !== ACCOUNT_REQUIRED && !serverFileError}
            <p class="resource-form-error">{errorMessage}</p>
        {/if}

        {#if mode === 'add'}
            <div class="resource-field">
                <FileUpload
                    label={uploadedFiles.length > 0 ? '' : 'Resource upload file'}
                    required={true}
                    state={(fileUploadError || serverFileError) ? 'error' : 'default'}
                    errorMessage={fileUploadError ? FILE_REQUIRED : (serverFileError ? (errorMessage ?? '') : '')}
                    helperText={uploadedFiles.length > 0 ? '' : (!(fileUploadError || serverFileError) ? FILE_HELPER : '')}
                    accept={FILE_ACCEPT}
                    multiple={false}
                    maxFiles={1}
                    maxFileSize={50}
                    acceptedTypes="zip, cpk, deb, apk"
                    bind:files={uploadedFiles}
                    showDropZone={uploadedFiles.length === 0}
                    on:drop={handleFileDrop}
                    on:remove={() => {
                        handleFileRemove();
                        errorMessage = null;
                    }}
                />
                {#if uploadProgress != null}
                    <p class="resource-parse-status resource-parse-pending">Uploading to server... {uploadProgress}%</p>
                {:else if zipParsing}
                    <p class="resource-parse-status resource-parse-pending">Parsing file…</p>
                {/if}
                {#if zipParseSuccess}
                    <p class="resource-parse-status resource-parse-success">{zipParseSuccess}</p>
                {/if}
                {#if zipParseError}
                    <p class="resource-parse-status resource-parse-error">{zipParseError}</p>
                {/if}
            </div>
        {:else}
            {#if initialData?.path}
                {@const editFileName = (initialData.path && initialData.path.split('/').filter(Boolean).pop()) || initialData.path || 'resource'}
                <div class="resource-field resource-file-display">
                    <a
                        href="/api/resources/{resourceId}"
                        download={editFileName}
                        class="resource-file-link-with-icon"
                    >
                        <span class="resource-file-link-text">{editFileName}</span>
                        <Download size={20} class="resource-file-download-icon" aria-hidden="true" />
                    </a>
                </div>
            {/if}
        {/if}

        <div class="resource-field">
            <InputField
                type="text"
                label="Resource Name"
                placeholder="Enter"
                bind:value={name}
                required={true}
                state={resourceNameError ? 'error' : 'default'}
                helperText={resourceNameError}
                disabled={false}
            />
        </div>
        <div class="resource-field">
            <InputField
                type="text"
                label="Package Name"
                placeholder="Enter"
                bind:value={packageName}
                disabled={false}
            />
        </div>
        <div class="resource-row">
            <div class="resource-field">
                <InputField
                    type="text"
                    label="Version"
                    placeholder="Enter"
                    bind:value={version}
                    disabled={false}
                />
            </div>
            <div class="resource-field">
                <Dropdown
                    label="Account"
                    placeholder="Select"
                    options={accountOptions}
                    bind:value={accountId}
                    required={true}
                    error={accountError}
                    errorMessage={accountError ? ACCOUNT_REQUIRED : ''}
                    disabled={mode === 'edit'}
                />
            </div>
            <div class="resource-field">
                <Dropdown
                    label="Release Type"
                    placeholder="Select"
                    options={RELEASE_TYPE_OPTIONS}
                    bind:value={releaseType}
                />
            </div>
        </div>
        <div class="resource-row">
            {#if isApk && (versionCode != null || signature)}
                <div class="resource-field">
                    <InputField
                        type="number"
                        label="Version Code"
                        placeholder="Auto-extracted from APK"
                        bind:value={versionCode}
                        disabled={true}
                    />
                </div>
            {/if}
        </div>
        {#if isApk && signature}
            <div class="resource-field">
                <InputField
                    type="text"
                    label="Signature"
                    placeholder="Auto-extracted from APK"
                    value={signature}
                    disabled={true}
                />
            </div>
        {/if}
        <div class="resource-field resource-path-wrap">
            <div class="resource-path-label-row">
                <span class="resource-field-label">Resource Path</span>
                <Tooltip
                    text={RESOURCE_PATH_TOOLTIP}
                    position="top"
                    theme="dark"
                    arrow="bottom"
                    portal={true}
                >
                    <span class="resource-path-info" aria-label={RESOURCE_PATH_TOOLTIP}>
                        <Info size={14} />
                    </span>
                </Tooltip>
            </div>
            <InputField
                type="text"
                placeholder="—"
                bind:value={resourcePath}
                disabled={true}
            />
        </div>

        <div class="resource-modal-footer">
            <Button
                type="button"
                variant="outline"
                color="primary"
                size="lg"
                on:click={handleClose}
            >
                Cancel
            </Button>
            <Button
                type="submit"
                variant="filled"
                color="primary"
                size="lg"
                loading={submitting}
                disabled={submitting || zipParsing || (uploadProgress != null && uploadProgress < 100) || (mode === 'add' && !!zipParseError)}
            >
                {mode === 'add' ? 'Add' : 'Save'}
            </Button>
        </div>
    </form>
</Modal>

<style>
    .resource-modal-form {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        width: 100%;
        min-width: 0;
        font-family: var(--ds-font-family-primary);
    }
    .resource-form-error {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-error-600);
        margin: 0;
    }
    .resource-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        min-width: 0;
    }
    .resource-field-label {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-regular);
        color: var(--ds-color-neutral-true-600);
    }
    .resource-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: var(--ds-space-4);
    }
    .resource-path-wrap :global(input:disabled) {
        background: var(--ds-input-bg-disabled);
        cursor: not-allowed;
    }
    .resource-path-label-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
    }
    .resource-path-info {
        display: inline-flex;
        color: var(--ds-color-blue-light-600);
        cursor: help;
    }
    .resource-file-display {
        margin-bottom: 0;
    }
    /* Link color: #155EEF per Figma — use design system token */
    .resource-file-link-with-icon {
        display: inline-flex;
        align-items: center;
        gap: var(--ds-space-2);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-primary-600);
        text-decoration: none;
    }
    .resource-file-link-with-icon:hover {
        text-decoration: underline;
    }
    .resource-file-link-with-icon :global(.resource-file-download-icon) {
        flex-shrink: 0;
        color: inherit;
    }
    .resource-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--ds-space-3);
        margin-top: var(--ds-space-2);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-color-neutral-true-200);
    }
    .resource-parse-status {
        font-size: var(--ds-text-xs);
        margin: 0;
        margin-top: var(--ds-space-1);
    }
    .resource-parse-pending {
        color: var(--ds-color-blue-light-600);
    }
    .resource-parse-success {
        color: var(--ds-color-success-600);
    }
    .resource-parse-error {
        color: var(--ds-color-error-600);
    }
</style>
