<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { deserialize } from '$app/forms';
    import {
        Modal,
        Button,
        InputField,
        TextareaField,
        Dropdown,
        FileUpload
    } from '$lib/design-system/components';
    import type { UploadedFile } from '$lib/design-system/components/FileUpload.svelte';
    import { Download } from 'lucide-svelte';

    export let open: boolean = false;
    export let mode: 'add' | 'edit' = 'add';
    export let preclaimId: string | null = null;
    export let initialData: {
        name?: string;
        description?: string;
        status?: string;
        expiresAt?: string;
        profileId?: string;
        accountId?: string;
    } | null = null;
    export let profileOptions: { id: string; label: string }[] = [];
    export let accountOptions: { id: string; label: string }[] = [];

    const dispatch = createEventDispatcher<{
        close: void;
        success: void;
        error: string;
    }>();

    // Match legacy app & server: preclaims/new accepts .csv (parsed), .xls/.xlsx (rejected with message)
    const FILE_HELPER = 'Maximum file size 50 MB, acceptable file types: csv, xls, xlsx.';
    const FILE_ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    let submitting = false;
    let errorMessage: string | null = null;
    let wasOpen = false;

    let name = '';
    let description = '';
    let status = 'ACTIVE';
    let expiresAt = '';
    let accountId = '';
    let profileId = '';
    let selectedFile: File | null = null;
    let uploadedFiles: UploadedFile[] = [];
    /** Message when FileUpload rejects a file (e.g. size > 50MB, wrong type) */
    let fileRejectMessage: string | null = null;

    const MAX_NAME_LENGTH = 500;
    const SET_NAME_REQUIRED = 'Set name is required';
    const SET_NAME_TOO_LONG = `Set name must be ${MAX_NAME_LENGTH} characters or less`;
    const FILE_REQUIRED = 'Device upload file is required';
    const PROFILE_REQUIRED = 'Please select Device Profile';

    $: setNameError = (errorMessage === SET_NAME_REQUIRED || errorMessage === SET_NAME_TOO_LONG) ? errorMessage : '';
    $: fileUploadError = errorMessage === FILE_REQUIRED;
    $: fileUploadShowError = fileUploadError || fileRejectMessage != null;
    $: profileError = errorMessage === PROFILE_REQUIRED;
    $: if (name?.trim() && name.length <= MAX_NAME_LENGTH && (errorMessage === SET_NAME_REQUIRED || errorMessage === SET_NAME_TOO_LONG)) errorMessage = null;
    $: if (mode === 'add' && (selectedFile != null || uploadedFiles.length > 0) && errorMessage === FILE_REQUIRED) errorMessage = null;
    $: if (profileId?.trim() && errorMessage === PROFILE_REQUIRED) errorMessage = null;

    /** Today's date in yyyy-MM-dd for min attribute (no past dates) */
    $: minDateStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    /** Edit mode: display filename for device list download — derived from set name + expiry (no DB column, matches old app) */
    $: deviceListDisplayName = (() => {
        if (mode !== 'edit') return '';
        const slug = (name || 'devicelist').replace(/\s+/g, '').toLowerCase().slice(0, 20) || 'devicelist';
        const d = expiresAt ? new Date(expiresAt) : new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${slug}-${day}/${month}/${year}.csv`;
    })();

    $: if (open) {
        if (!wasOpen) {
            errorMessage = null;
            fileRejectMessage = null;
            if (mode === 'edit' && initialData) {
                name = initialData.name ?? '';
                description = initialData.description ?? '';
                status = initialData.status ?? 'ACTIVE';
                const rawExpiry = initialData.expiresAt;
                expiresAt = rawExpiry == null ? '' : (typeof rawExpiry === 'string' ? rawExpiry.slice(0, 10) : new Date(rawExpiry as Date).toISOString().slice(0, 10));
                accountId = initialData.accountId ?? '';
                profileId = initialData.profileId ?? '';
                selectedFile = null;
                uploadedFiles = [];
            } else {
                name = '';
                description = '';
                status = 'ACTIVE';
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                expiresAt = d.toISOString().slice(0, 10);
                accountId = accountOptions[0]?.id ?? '';
                profileId = profileOptions[0]?.id ?? '';
                selectedFile = null;
                uploadedFiles = [];
            }
        }
        wasOpen = true;
    } else {
        wasOpen = false;
    }

    function handleFileDrop(e: CustomEvent<FileList>) {
        const list = e.detail;
        if (!list?.length) return;
        const file = list[0];
        fileRejectMessage = null;
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
        if (!name?.trim()) name = file.name.replace(/\.[^.]+$/, '') || 'Pre-Enrollment Set';
    }

    function handleFileDropRejected(e: CustomEvent<{ message: string; file: File }>) {
        fileRejectMessage = e.detail?.message ?? 'File was rejected. Please check file size (max 50 MB) and type (csv, xls, xlsx).';
    }

    function handleClose() {
        dispatch('close');
    }

    function downloadCsvTemplate() {
        const headers = ['macId', 'name', 'description', 'expiresAt'];
        const sample = ['AA:BB:CC:DD:EE:FF', 'My Device', 'Optional description', '2030-12-31'];
        const csv = [headers.join(','), sample.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'preclaim_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function toErrorMessage(v: unknown): string {
        if (typeof v === 'string') return v;
        if (!v || typeof v !== 'object') return 'Unable to save. Please try again!';
        const o = v as Record<string, unknown>;
        const err = o.error as Record<string, unknown> | undefined;
        if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
        if (typeof o.message === 'string' && o.message.trim()) return o.message;
        return 'Unable to save. Please try again!';
    }

    /** Get form from SvelteKit action response (fail returns result.data.form) */
    function getForm(result: any): any {
        return result?.data?.form ?? result?.form;
    }

    /** Extract user-facing error from form or result (server message / validation errors) */
    function getErrorFromResult(result: any): string {
        const form = getForm(result);
        if (form?.message) {
            const msg = form.message;
            if (typeof msg === 'string' && msg.trim()) return msg;
            const err = (msg as any)?.error;
            if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
            if (typeof (msg as any)?.text === 'string' && (msg as any).text.trim()) return (msg as any).text;
        }
        if (form?.errors) {
            const first = Object.values(form.errors).flat().find((e: any) => typeof e === 'string' && e.trim());
            if (first) return String(first);
        }
        if (result?.data) {
            let d = result.data;
            // result.data may be a devalue-serialized string; deserialize to get the object
            if (typeof d === 'string' && d.trim()) {
                try {
                    d = deserialize(d) as Record<string, unknown>;
                } catch {
                    d = {};
                }
            }
            if (d && typeof d === 'object') {
                // Prefer specific error (e.g. "CSV must include macId/mac") over generic message
                const errVal = (d as any).error;
                if (typeof errVal === 'string' && errVal.trim() && errVal !== 'Unknown error') return errVal;
                const msgVal = (d as any).message;
                if (typeof msgVal === 'string' && msgVal.trim()) return msgVal;
                if (errVal?.message && typeof errVal.message === 'string' && errVal.message.trim()) return errVal.message;
            }
        }
        return toErrorMessage(result);
    }

    async function handleSubmit() {
        errorMessage = null;
        if (!name?.trim()) {
            errorMessage = SET_NAME_REQUIRED;
            return;
        }
        if (name.length > MAX_NAME_LENGTH) {
            errorMessage = SET_NAME_TOO_LONG;
            return;
        }
        if (mode === 'add') {
            if (!selectedFile) {
                errorMessage = FILE_REQUIRED;
                return;
            }
            if (!profileId?.trim()) {
                errorMessage = PROFILE_REQUIRED;
                return;
            }
        } else {
            if (!profileId?.trim()) {
                errorMessage = PROFILE_REQUIRED;
                return;
            }
        }

        submitting = true;
        try {
            if (mode === 'add') {
                const fd = new FormData();
                fd.set('name', name.trim());
                fd.set('description', description.trim());
                fd.set('expiresAt', expiresAt || '');
                fd.set('profileId', profileId);
                fd.set('file', selectedFile!);
                const res = await fetch('/user/iot/preclaims/new?/upload', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                const raw = await res.text();
                const result = typeof raw === 'string' && raw.trim() ? (deserialize(raw) as any) : {};
                const form = getForm(result);
                const id =
                    form?.message?.meta?.data?.id ??
                    form?.message?.data?.id ??
                    (form?.message?.data != null && typeof form.message.data === 'object' && form.message.data?.id != null ? form.message.data.id : undefined);
                const success =
                    result?.type === 'success' ||
                    form?.valid === true ||
                    (form?.message?.success === true && id);
                if (success) {
                    dispatch('success');
                    return;
                }
                errorMessage = getErrorFromResult(result);
                dispatch('error', errorMessage);
            } else if (preclaimId) {
                const fd = new FormData();
                fd.set('id', preclaimId);
                fd.set('name', name.trim());
                fd.set('description', description.trim());
                fd.set('status', status);
                fd.set('expiresAt', expiresAt || '');
                fd.set('profileId', profileId);
                const res = await fetch(`/user/iot/preclaims/${preclaimId}/edit?/save`, {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                const raw = await res.text();
                const result = typeof raw === 'string' && raw.trim() ? (deserialize(raw) as any) : {};
                const editForm = getForm(result);
                const success =
                    result?.type === 'success' ||
                    editForm?.valid === true ||
                    editForm?.message?.success === true;
                if (success) {
                    dispatch('success');
                    return;
                }
                errorMessage = getErrorFromResult(result);
                dispatch('error', errorMessage);
            }
        } catch (e) {
            errorMessage = toErrorMessage(e);
            dispatch('error', errorMessage);
        } finally {
            submitting = false;
        }
    }

    async function handleSaveAsDraft() {
        if (mode !== 'add') return;
        errorMessage = null;
        if (!name?.trim()) {
            errorMessage = SET_NAME_REQUIRED;
            return;
        }
        if (name.length > MAX_NAME_LENGTH) {
            errorMessage = SET_NAME_TOO_LONG;
            return;
        }
        if (!selectedFile) {
            errorMessage = FILE_REQUIRED;
            return;
        }
        if (!profileId?.trim()) {
            errorMessage = PROFILE_REQUIRED;
            return;
        }
        submitting = true;
        try {
            const fd = new FormData();
            fd.set('name', name.trim());
            fd.set('description', description.trim());
            fd.set('expiresAt', expiresAt || '');
            fd.set('profileId', profileId || '');
            fd.set('saveAsDraft', 'true'); // Creates with status INACTIVE (Draft)
            if (selectedFile) fd.set('file', selectedFile);
            const res = await fetch('/user/iot/preclaims/new?/upload', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            });
            const raw = await res.text();
            const result = typeof raw === 'string' && raw.trim() ? (deserialize(raw) as any) : {};
            const form = getForm(result);
            const id = form?.message?.data?.id ?? form?.message?.meta?.data?.id;
            const success = result?.type === 'success' || form?.valid === true || (form?.message?.success === true && id);
            if (success) {
                dispatch('success');
                return;
            }
            errorMessage = getErrorFromResult(result);
            dispatch('error', errorMessage);
        } catch (e) {
            errorMessage = toErrorMessage(e);
            dispatch('error', errorMessage);
        } finally {
            submitting = false;
        }
    }
</script>

<Modal
    open={open}
    title={mode === 'add' ? 'Add Pre-Enrollment Set' : 'Edit Pre-Enrollment Set'}
    size="lg"
    showFooter={false}
    on:close={handleClose}
>
    <svelte:fragment slot="header-actions">
        {#if mode === 'add'}
            <Button
                type="button"
                variant="outline"
                color="primary"
                size="md"
                iconLeft={true}
                on:click={downloadCsvTemplate}
            >
                <Download size={20} slot="icon-left" />
                CSV Template
            </Button>
        {/if}
    </svelte:fragment>

    <div class="preclaim-modal-inner">
        <form on:submit|preventDefault={handleSubmit} class="preclaim-modal-form">
            <div class="preclaim-field">
                <InputField
                    type="text"
                    label="Set Name"
                    placeholder="Enter"
                    bind:value={name}
                    required={true}
                    maxlength={MAX_NAME_LENGTH}
                    state={setNameError ? 'error' : 'default'}
                    helperText={setNameError}
                />
                <p class="char-count" class:char-count-limit={name.length === MAX_NAME_LENGTH}>
                    {name.length}/{MAX_NAME_LENGTH} characters
                    {#if name.length === MAX_NAME_LENGTH}
                        — Maximum length reached
                    {/if}
                </p>
            </div>

            <div class="preclaim-row">
                <div class="preclaim-field">
                    <InputField
                        type="date"
                        label="Expiry Date"
                        placeholder="MM/DD/YYYY"
                        bind:value={expiresAt}
                        min={minDateStr}
                    />
                </div>
                <div class="preclaim-field">
                    <Dropdown
                        label="Account"
                        placeholder="Select"
                        options={accountOptions}
                        bind:value={accountId}
                    />
                </div>
            </div>

            <div class="preclaim-field">
                <TextareaField
                    label="Description"
                    placeholder="Enter"
                    bind:value={description}
                />
            </div>

            <div class="preclaim-field">
                <Dropdown
                    label="Device Profile"
                    placeholder="Select"
                    options={profileOptions}
                    bind:value={profileId}
                    required={true}
                    error={profileError}
                    errorMessage={profileError ? PROFILE_REQUIRED : ''}
                />
            </div>

            {#if mode === 'add'}
                <div class="preclaim-field">
                    <FileUpload
                        label={uploadedFiles.length > 0 ? '' : 'Device Upload File'}
                        required={true}
                        state={fileUploadShowError ? 'error' : 'default'}
                        errorMessage={fileRejectMessage ?? (fileUploadError ? FILE_REQUIRED : '')}
                        helperText={uploadedFiles.length > 0 ? '' : (!fileUploadShowError ? FILE_HELPER : '')}
                        accept={FILE_ACCEPT}
                        multiple={false}
                        maxFiles={1}
                        maxFileSize={50}
                        acceptedTypes="csv, xls, xlsx"
                        bind:files={uploadedFiles}
                        showDropZone={uploadedFiles.length === 0}
                        on:drop={handleFileDrop}
                        on:dropRejected={handleFileDropRejected}
                        on:remove={() => {
                            uploadedFiles = [];
                            selectedFile = null;
                            errorMessage = null;
                            fileRejectMessage = null;
                        }}
                    />
                </div>
            {:else}
                <div class="preclaim-field preclaim-file-info">
                    <a
                        href={preclaimId ? `/user/iot/preclaims/${preclaimId}/export` : '#'}
                        class="preclaim-file-download"
                    >
                        <span class="preclaim-file-download-name">{deviceListDisplayName}</span>
                        <span class="preclaim-file-download-icon"><Download size={18} /></span>
                    </a>
                </div>
            {/if}

            <div class="preclaim-modal-footer">
                <Button type="button" variant="outline" color="primary" size="lg" on:click={handleClose}>
                    Cancel
                </Button>
                {#if mode === 'add'}
                    <Button
                        type="button"
                        variant="outline"
                        color="primary"
                        size="lg"
                        on:click={handleSaveAsDraft}
                        disabled={submitting}
                    >
                        Save as Draft
                    </Button>
                    <Button
                        type="submit"
                        variant="filled"
                        color="primary"
                        size="lg"
                        disabled={submitting}
                        loading={submitting}
                    >
                        Add
                    </Button>
                {:else}
                    <Button
                        type="submit"
                        variant="filled"
                        color="primary"
                        size="lg"
                        disabled={submitting}
                        loading={submitting}
                    >
                        Save
                    </Button>
                {/if}
            </div>
        </form>
    </div>
</Modal>

<style>
    /* Wrap body content so modal-body flex doesn't flatten our form */
    .preclaim-modal-inner {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        min-width: 0;
        gap: var(--ds-space-4);
    }
    .preclaim-modal-form {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 100%;
        min-width: 0;
        gap: var(--ds-space-5);
    }
    .preclaim-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-4);
        width: 100%;
        min-width: 0;
    }
    .char-count {
        margin: 4px 0 0;
        font-size: var(--ds-text-xs);
        color: var(--ds-color-neutral-true-500);
    }
    .char-count.char-count-limit {
        color: var(--ds-color-amber-600, #d97706);
    }
    .preclaim-field {
        display: block;
        width: 100%;
        min-width: 0;
    }
    .preclaim-file-info {
        padding: var(--ds-space-2) 0;
        width: 100%;
    }
    .preclaim-file-download {
        display: inline-flex;
        align-items: center;
        gap: var(--ds-space-2);
        font-size: var(--ds-text-sm);
        color: var(--ds-color-primary-600);
        text-decoration: none;
    }
    .preclaim-file-download:hover {
        text-decoration: underline;
    }
    .preclaim-file-download-name {
        font-weight: 500;
    }
    .preclaim-file-download-icon {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--ds-color-primary-600);
    }
    .preclaim-modal-footer {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        gap: var(--ds-space-3);
        margin-top: var(--ds-space-2);
        padding-top: var(--ds-space-5);
        border-top: 1px solid var(--ds-color-neutral-true-200);
        width: 100%;
    }
</style>
