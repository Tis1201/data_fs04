<script lang="ts">
    import { createEventDispatcher } from 'svelte';
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
    import { parseZipFile, parseApkFile, generatePackageName, extractDisplayName, extractVersion } from '$lib/utils/clientZipParser';

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

    $: accountOptions = accounts.map((a) => ({ id: a.id, label: a.name }));

    // Only sync when modal opens: edit = fill from initialData; add = reset once when opening
    $: if (open) {
        if (!wasOpen) {
            errorMessage = null;
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

        const fileName = file.name.toLowerCase();
        const isSupported = fileName.endsWith('.zip') || fileName.endsWith('.apk') || fileName.endsWith('.cpk') || fileName.endsWith('.deb');
        isApk = fileName.endsWith('.apk');

        if (isSupported) {
            zipParsing = true;
            try {
                if (isApk) {
                    const apkResult = await parseApkFile(file);
                    if (apkResult.success && apkResult.data) {
                        if (apkResult.data.packageName) packageName = apkResult.data.packageName;
                        if (apkResult.data.versionName) version = apkResult.data.versionName;
                        if (apkResult.data.versionCode != null) versionCode = apkResult.data.versionCode;
                        if (apkResult.data.signature) signature = apkResult.data.signature;
                        if (apkResult.data.appName) name = apkResult.data.appName;
                        isApkOrCpk = true;
                        zipParseSuccess = '✓ Successfully parsed APK file';
                    } else {
                        zipParseError = apkResult.error || 'Failed to parse APK file';
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
                        const fileType = fileName.endsWith('.cpk') ? 'CPK' : fileName.endsWith('.deb') ? 'DEB' : 'ZIP';
                        zipParseSuccess = `✓ Successfully parsed ${fileType} file`;
                    } else {
                        zipParseError = result.error || 'Failed to parse file';
                    }
                }
            } catch (err) {
                zipParseError = 'Failed to parse file';
            } finally {
                zipParsing = false;
            }
        }
    }

    function handleFileRemove() {
        selectedFile = null;
        uploadedFiles = [];
        versionCode = null;
        signature = '';
        zipParseSuccess = '';
        zipParseError = '';
        isApkOrCpk = false;
        isApk = false;
    }

    function toErrorMessage(v: unknown): string {
        if (typeof v === 'string') return v;
        if (!v || typeof v !== 'object') return 'Unable to add resource. Please try again!';
        const o = v as Record<string, unknown>;
        const err = o.error as Record<string, unknown> | undefined;
        if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
        if (err && typeof err.details === 'string' && err.details.trim()) return err.details;
        if (typeof o.message === 'string' && o.message.trim()) return o.message;
        if (typeof o.details === 'string' && o.details.trim()) return o.details;
        if (Array.isArray(o.errors) && o.errors[0] && typeof (o.errors[0] as Record<string, unknown>).message === 'string') {
            return (o.errors[0] as { message: string }).message;
        }
        const dataStr = typeof o.data === 'string' ? o.data : '';
        if (dataStr.includes('Invalid file format') || dataStr.includes('Only .zip')) {
            const detailsMatch = dataStr.match(/Only [^"]+files are allowed/);
            return detailsMatch ? detailsMatch[0].trim() : 'Invalid file format. Only .zip, .cpk, .deb and .apk files are allowed.';
        }
        return 'Unable to add resource. Please try again!';
    }

    async function handleSubmit() {
        errorMessage = null;
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
                if (selectedFile) {
                    fd.set('file', selectedFile);
                    fd.set('size', String(selectedFile.size));
                }
                const res = await fetch('/user/resources/new?/create', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                const result = await res.json().catch(() => ({}));
                const isSuccess =
                    result.success === true ||
                    result.type === 'success' ||
                    result.data?.resourceId ||
                    (typeof result.data === 'string' &&
                        (result.data.includes('Resource created successfully') || result.data.includes('"resourceId"')));
                if (isSuccess) {
                    dispatch('success');
                } else {
                    const msg = toErrorMessage(result) || 'Unable to add resource. Please try again!';
                    errorMessage = msg;
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
                const result = await res.json().catch(() => ({}));
                if (result.type === 'success' || result.data) {
                    dispatch('success');
                } else {
                    errorMessage = toErrorMessage(result) || 'Unable to update resource. Please try again!';
                    dispatch('error', errorMessage);
                }
            }
        } catch (e) {
            errorMessage = toErrorMessage(e) || 'Unable to add resource. Please try again!';
            dispatch('error', errorMessage);
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
        {#if errorMessage && errorMessage !== RESOURCE_NAME_REQUIRED && errorMessage !== FILE_REQUIRED && errorMessage !== ACCOUNT_REQUIRED && !serverFileError}
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
                        uploadedFiles = [];
                        selectedFile = null;
                        errorMessage = null;
                    }}
                />
                {#if zipParsing}
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
                disabled={true}
            />
        </div>
        <div class="resource-row">
            <div class="resource-field">
                <InputField
                    type="text"
                    label="Version"
                    placeholder="Enter"
                    bind:value={version}
                    disabled={true}
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
                disabled={submitting}
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
