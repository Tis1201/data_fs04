<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Modal, Button, InputField, TextareaField, Toggle, TabGroup, Dropdown } from '$lib/design-system/components';
    import { PIN_RULE_NAME_MAX, PIN_RULE_DESCRIPTION_MAX, FALLBACK_ACCEPT, FALLBACK_ALLOWED_MIMES, FALLBACK_ALLOWED_EXTENSIONS } from '$lib/constants/pinRule';
    import AppPickerModal from '$lib/components/shared/AppPickerModal.svelte';
    import CharacterCount from '$lib/components/ui_components_sveltekit/form/CharacterCount.svelte';
    import type { AppPickerItem } from '$lib/components/shared/AppPickerModal.svelte';
    import DeviceSelector from '$lib/components/bundles_ui/device_select/DeviceSelector.svelte';
    import { Plus, X, Download } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';

    export let open: boolean = false;
    export let rule: any = null;
    export let apiPrefix: string = '/api/v2';
    /** Optional: called after save success with the updated rule from the API; if it returns a Promise, modal waits before closing. */
    export let onSaved: ((updatedRule?: any) => void | Promise<void>) | undefined = undefined;

    const dispatch = createEventDispatcher<{
        close: void;
        saved: void;
    }>();

    // Top section + pinned apps + fallback. Sync from rule only when modal opens.
    let formData = {
        name: '',
        description: '',
        isActive: true
    };
    let selectedApps = new Set<string>();
    let fallbackScreenEnabled = false;
    let fallbackScreenUrl: string | null = null;
    let fallbackFileName: string | null = null;
    let fallbackFileSize: number | null = null;
    let prevOpen = false;
    $: isCreateMode = !rule;
    $: modalTitle = isCreateMode ? 'Add Rule' : 'Edit Rule';
    /** Draft: 3 buttons (Cancel, Save as Draft, Save & Publish). Active/Inactive: 2 buttons (Cancel, Save). */
    $: showDraftActions = isCreateMode || (rule?.isDraft === true);

    /** Derive display filename from object path (e.g. "pinrule/id/uuid.jpg" -> "uuid.jpg") */
    function getFallbackFileName(url: string | null | undefined): string | null {
        if (!url || typeof url !== 'string') return null;
        const segments = url.split('/').filter(Boolean);
        const last = segments.pop();
        return last || null;
    }

    $: {
        if (open && !prevOpen) {
            nameError = '';
            descriptionError = '';
            appsError = '';
            applyToError = '';
            if (rule) {
                // Edit mode: sync from rule
                formData = {
                    name: rule.name || '',
                    description: rule.description || '',
                    isActive: rule.isActive !== false
                };
                selectedApps = new Set(Array.isArray(rule.apps) ? rule.apps.filter(Boolean) : []);
                fallbackScreenEnabled = rule.fallbackScreenEnabled === true;
                fallbackScreenUrl = rule.fallbackScreenUrl ?? null;
                fallbackFileName = getFallbackFileName(rule.fallbackScreenUrl);
                fallbackFileSize = null;
                applyTo = rule.targetType === 'specific' ? 'devices' : 'all';
                selectedDevices = [];
                if (rule.targetType === 'specific' && Array.isArray(rule.targetValue) && rule.targetValue.length > 0) {
                    loadSelectedDevices(rule.targetValue);
                }
            } else {
                // Create mode: reset to defaults
                formData = { name: '', description: '', isActive: true };
                selectedApps = new Set();
                fallbackScreenEnabled = false;
                fallbackScreenUrl = null;
                fallbackFileName = null;
                fallbackFileSize = null;
                applyTo = 'all';
                selectedDevices = [];
            }
        }
        prevOpen = open;
    }

    // Apply To tab: 'all' | 'devices' -> targetType 'all' | 'specific'
    let applyTo: 'all' | 'devices' = 'all';
    type SelectedDevice = {
        id: string;
        name: string;
        macAddress?: string | null;
        status?: string;
        connected?: boolean;
        lastUsedAt?: string | null;
    };
    let selectedDevices: SelectedDevice[] = [];
    let applyToDevicesLoading = false;
    let devicePickerOpen = false;
    let deviceTags: { id: string; name: string }[] = [];
    let deviceTagsLoaded = false;
    let nameError = '';
    let descriptionError = '';
    let appsError = '';
    let applyToError = '';
    let selectedTagIdsForAdd: string[] = [];
    let addByTagLoading = false;

    async function loadSelectedDevices(deviceIds: string[]) {
        if (!deviceIds?.length) return;
        applyToDevicesLoading = true;
        try {
            const res = await fetch(`${apiPrefix}/devices/select?includeDeviceIds=${deviceIds.join(',')}`);
            const data = await res.json();
            const devices = data?.data?.devices ?? data?.devices ?? [];
            selectedDevices = devices.map((d: any) => ({
                id: d.id,
                name: d.name || d.id,
                macAddress: d.macAddress ?? null,
                status: d.status,
                connected: d.connected,
                lastUsedAt: d.lastUsedAt ?? null
            }));
        } catch {
            selectedDevices = [];
        } finally {
            applyToDevicesLoading = false;
        }
    }

    async function loadDeviceTags() {
        if (deviceTagsLoaded) return;
        try {
            const res = await fetch(`${apiPrefix}/device-tags`);
            if (!res.ok) {
                console.warn('[PinRuleEdit] Failed to load device tags:', res.status, res.statusText);
                deviceTags = [];
                deviceTagsLoaded = true;
                return;
            }
            const data = await res.json();
            const tags = data?.data?.tags ?? data?.tags ?? [];
            deviceTags = tags.map((t: any) => ({ id: t.id, name: t.name || t.id }));
            deviceTagsLoaded = true;
        } catch (err) {
            console.error('[PinRuleEdit] Error loading device tags:', err);
            deviceTags = [];
            deviceTagsLoaded = true;
        }
    }

    $: tagOptionsForDropdown = deviceTags.map((t) => ({ id: t.id, label: t.name }));

    async function addDevicesByTag() {
        if (!selectedTagIdsForAdd.length) return;
        addByTagLoading = true;
        try {
            const res = await fetch(`${apiPrefix}/devices/select?tagIds=${selectedTagIdsForAdd.join(',')}&per_page=500`);
            if (!res.ok) {
                console.warn('[PinRuleEdit] Failed to load devices by tag:', res.status);
                toast.error('Failed to load devices by tag');
                return;
            }
            const data = await res.json();
            const devices = (data?.data?.devices ?? data?.devices ?? []).map((d: any) => ({
                id: d.id,
                name: d.name || d.id,
                macAddress: d.macAddress ?? null,
                status: d.status,
                connected: d.connected,
                lastUsedAt: d.lastUsedAt ?? null
            }));
            const existingIds = new Set(selectedDevices.map((d) => d.id));
            const toAdd = devices.filter((d: { id: string }) => !existingIds.has(d.id));
            selectedDevices = [...selectedDevices, ...toAdd];
            selectedTagIdsForAdd = [];
            if (toAdd.length) {
                toast.success(`Added ${toAdd.length} device(s) from selected tag(s).`);
            } else {
                toast.info('No new devices found for the selected tag(s).');
            }
        } catch (err) {
            console.error('[PinRuleEdit] Error adding devices by tag:', err);
            toast.error('Failed to load devices by tag');
        } finally {
            addByTagLoading = false;
        }
    }

    function handleDevicesSelected(e: CustomEvent<{ id: string; name: string }[]>) {
        const added = e.detail;
        const existingIds = new Set(selectedDevices.map((d) => d.id));
        const toAdd = added.filter((d) => !existingIds.has(d.id));
        selectedDevices = [...selectedDevices, ...toAdd];
        devicePickerOpen = false;
    }

    function removeDevice(id: string) {
        selectedDevices = selectedDevices.filter((d) => d.id !== id);
    }

    const applyToOptions = [
        { id: 'all', label: 'All Devices' },
        { id: 'devices', label: 'Devices' }
    ];

    let appPickerOpen = false;
    function handleAddAppConfirm(e: CustomEvent<{ selected: string[]; apps: AppPickerItem[] }>) {
        const { selected } = e.detail;
        selected.forEach((pkg) => selectedApps.add(pkg));
        selectedApps = new Set(selectedApps);
        appPickerOpen = false;
    }
    function removeApp(pkg: string) {
        selectedApps.delete(pkg);
        selectedApps = new Set(selectedApps);
    }
    $: selectedAppsList = Array.from(selectedApps);

    const FALLBACK_MAX_BYTES = 50 * 1024 * 1024;

    function isFallbackFileTypeValid(file: File): boolean {
        const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
        const mimeValid = file.type && FALLBACK_ALLOWED_MIMES.includes(file.type as any);
        const extValid = FALLBACK_ALLOWED_EXTENSIONS.includes(ext);
        return !!(mimeValid || extValid);
    }
    let fallbackUploading = false;
    /** Upload progress 0–100 when uploading; null when not uploading */
    let fallbackUploadProgress: number | null = null;
    let fallbackInputEl: HTMLInputElement;

    function formatFallbackSize(bytes: number | null | undefined): string {
        if (bytes == null || bytes === 0) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

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

    async function handleFallbackDownload() {
        if (!fallbackScreenUrl) return;
        const downloadFileName = fallbackFileName || getFallbackFileName(fallbackScreenUrl) || 'fallback';
        try {
            const res = await fetch(
                `${apiPrefix}/upload/download-url?objectPath=${encodeURIComponent(fallbackScreenUrl)}&filename=${encodeURIComponent(downloadFileName)}`
            );
            const data = await res.json();
            if (data?.success && data?.data?.downloadUrl) {
                window.open(data.data.downloadUrl, '_blank', 'noopener,noreferrer');
            } else {
                toast.error('Could not get download link');
            }
        } catch {
            toast.error('Could not get download link');
        }
    }

    async function handleFallbackFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (!isFallbackFileTypeValid(file)) {
            toast.error('Only image and video files are allowed (JPEG, PNG, WebP, GIF, MP4, WebM).');
            input.value = '';
            return;
        }
        if (file.size > FALLBACK_MAX_BYTES) {
            toast.error(`File must be under ${formatFallbackSize(FALLBACK_MAX_BYTES)}`);
            input.value = '';
            return;
        }
        const prefix = rule?.id ? `pinrule/${rule.id}` : null;
        if (!prefix) {
            toast.error('Rule ID required for upload');
            return;
        }
        fallbackUploading = true;
        fallbackUploadProgress = 0;
        try {
            const presignedRes = await fetch(`${apiPrefix}/upload/presigned-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    contentType: file.type || undefined,
                    expiresSeconds: 600,
                    prefix,
                    replaceInFolder: true
                })
            });
            const presignedData = await presignedRes.json();
            if (!presignedData?.success || !presignedData?.data?.url) {
                const errMsg = presignedData?.error?.message || presignedData?.message;
                toast.error(errMsg || 'Failed to get upload URL');
                return;
            }
            const { url, objectPath, contentType } = presignedData.data;
            await uploadToPresignedUrlWithProgress(
                url,
                file,
                contentType || file.type || 'application/octet-stream',
                (p) => {
                    fallbackUploadProgress = p;
                }
            );
            fallbackScreenUrl = objectPath;
            fallbackFileName = file.name;
            fallbackFileSize = file.size;
            toast.success('File uploaded');
        } catch {
            toast.error('Upload failed');
        } finally {
            fallbackUploading = false;
            fallbackUploadProgress = null;
            input.value = '';
        }
    }

    /** Disable all modal actions while saving or uploading fallback */
    $: buttonsDisabled = saving || fallbackUploading || (fallbackUploadProgress != null && fallbackUploadProgress < 100);

    function removeFallbackFile() {
        fallbackScreenUrl = null;
        fallbackFileName = null;
        fallbackFileSize = null;
    }

    // Tabs
    const tabs = [
        { id: 'pinned_app', label: 'Pinned App' },
        { id: 'fallback_screen', label: 'Fallback Screen' },
        { id: 'apply_to', label: 'Apply To' }
    ];
    let activeTab = 'pinned_app';
    function handleTabChange(e: CustomEvent<string>) {
        activeTab = e.detail;
    }

    $: if (open && activeTab === 'apply_to') loadDeviceTags();
    /** Clear inline errors when user fixes the condition. */
    $: if (selectedApps.size > 0) appsError = '';
    $: if (applyTo === 'all' || selectedDevices.length > 0) applyToError = '';

    function handleModalClose() {
        open = false;
        dispatch('close');
    }

    function handleCancel() {
        handleModalClose();
    }

    function handleNameInput() {
        if (formData.name.length > PIN_RULE_NAME_MAX) {
            formData.name = formData.name.slice(0, PIN_RULE_NAME_MAX);
            nameError = '';
        } else {
            nameError = '';
        }
    }

    let saving = false;
    async function saveRule(asDraft: boolean) {
        if (!isCreateMode && !rule?.id) return;
        nameError = '';
        descriptionError = '';
        appsError = '';
        applyToError = '';
        if (!formData.name?.trim()) {
            nameError = 'Name is required';
            return;
        }
        const nameLen = formData.name.trim().length;
        if (nameLen > PIN_RULE_NAME_MAX) {
            nameError = `Name must be at most ${PIN_RULE_NAME_MAX} characters`;
            return;
        }
        const descVal = formData.description?.trim() || '';
        if (descVal.length > PIN_RULE_DESCRIPTION_MAX) {
            descriptionError = `Description must be at most ${PIN_RULE_DESCRIPTION_MAX} characters`;
            return;
        }
        if (selectedApps.size === 0) {
            appsError = 'At least one app is required';
            activeTab = 'pinned_app';
            return;
        }
        if (applyTo === 'devices' && selectedDevices.length === 0) {
            applyToError = 'Please select at least one device';
            activeTab = 'apply_to';
            return;
        }
        saving = true;
        try {
            const payload = {
                name: formData.name.trim(),
                description: formData.description?.trim() || null,
                apps: Array.from(selectedApps),
                targetType: applyTo === 'all' ? 'all' : 'specific',
                targetValue: applyTo === 'all' ? [] : selectedDevices.map((d) => d.id),
                isActive: asDraft ? false : formData.isActive,
                isDraft: asDraft,
                fallbackScreenEnabled,
                fallbackScreenUrl: fallbackScreenEnabled ? (fallbackScreenUrl || null) : null
            };

            const res = isCreateMode
                ? await fetch(`${apiPrefix}/pin-rules`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, ruleType: 'user_custom' })
                })
                : await fetch(`${apiPrefix}/pin-rules/${rule.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

            const data = await res.json();
            if (data?.success) {
                const successMsg = isCreateMode
                    ? (asDraft ? 'Rule created as draft successfully.' : 'Rule created & published successfully.')
                    : (asDraft ? 'Rule saved as draft successfully.' : 'Rule updated & published successfully.');
                toast.success(successMsg);
                const updatedRule = data?.data?.rule ?? data?.rule;
                if (onSaved) await Promise.resolve(onSaved(updatedRule));
                dispatch('saved');
                handleModalClose();
            } else {
                const msg = data?.error?.message || data?.message;
                const errorMsg = isCreateMode
                    ? (asDraft ? 'Unable to create draft. Please try again.' : 'Unable to create rule. Please try again.')
                    : (asDraft ? 'Unable to save as draft. Please try again.' : 'Unable to update rule. Please try again.');
                toast.error(msg || errorMsg);
                if (msg && msg.toLowerCase().includes('name already exists')) {
                    nameError = msg;
                }
            }
        } catch {
            const errorMsg = isCreateMode
                ? (asDraft ? 'Unable to create draft. Please try again.' : 'Unable to create rule. Please try again.')
                : (asDraft ? 'Unable to save as draft. Please try again.' : 'Unable to update rule. Please try again.');
            toast.error(errorMsg);
        } finally {
            saving = false;
        }
    }

    function handleSaveAsDraft() {
        saveRule(true);
    }

    function handleSaveAndPublish() {
        saveRule(false);
    }
</script>

<Modal
    bind:open
    title={modalTitle}
    size="full"
    showCloseButton={true}
    closeOnBackdrop={true}
    closeOnEscape={true}
    showFooter={true}
    on:close={handleModalClose}
>
    <div class="edit-rule-modal-body">
        <div class="edit-rule-fields">
            <div class="field">
                <label for="edit-rule-name" class="label">Name <span class="required">*</span></label>
                <InputField
                    id="edit-rule-name"
                    type="text"
                    bind:value={formData.name}
                    placeholder="Rule name"
                    maxlength={PIN_RULE_NAME_MAX}
                    state={nameError ? 'error' : 'default'}
                    helperText={nameError}
                    on:input={handleNameInput}
                />
                <CharacterCount current={formData.name.length} max={PIN_RULE_NAME_MAX} />
            </div>
            <div class="field toggle-field">
                <Toggle
                    bind:checked={formData.isActive}
                    label="Active"
                    labelPosition="right"
                />
            </div>
            <div class="field">
                <label for="edit-rule-desc" class="label">Description</label>
                <TextareaField
                    id="edit-rule-desc"
                    bind:value={formData.description}
                    placeholder="Description (optional)"
                    rows={3}
                    maxlength={PIN_RULE_DESCRIPTION_MAX}
                    state={descriptionError ? 'error' : 'default'}
                    helperText={descriptionError}
                    on:input={() => (descriptionError = '')}
                />
                <CharacterCount current={formData.description.length} max={PIN_RULE_DESCRIPTION_MAX} />
            </div>
        </div>

        <TabGroup
            tabs={tabs}
            bind:activeTab
            type="underline"
            size="md"
            on:change={handleTabChange}
        />

        {#if activeTab === 'pinned_app'}
            <div class="tab-panel pinned-app-tab">
                <div class="pinned-app-actions">
                    <Button variant="filled" color="primary" size="md" iconLeft={true} on:click={() => (appPickerOpen = true)}>
                        <Plus size={18} slot="icon-left" />
                        Add App
                    </Button>
                </div>
                <div class="pinned-app-selected">
                    <p class="pinned-app-selected-label">Selected ({selectedAppsList.length} item{selectedAppsList.length !== 1 ? 's' : ''})</p>
                    {#if appsError}
                        <p class="field-error-inline">{appsError}</p>
                    {/if}
                    {#if selectedAppsList.length === 0}
                        <p class="pinned-app-empty">No apps selected. Click &quot;Add App&quot; to select apps.</p>
                    {:else}
                        <ul class="pinned-app-list">
                            {#each selectedAppsList as pkg}
                                <li class="pinned-app-item">
                                    <span class="pinned-app-package">{pkg}</span>
                                    <Button
                                        variant="text"
                                        color="gray"
                                        size="sm"
                                        icon={X}
                                        iconPosition="only"
                                        iconSize={18}
                                        aria-label="Remove app"
                                        on:click={() => removeApp(pkg)}
                                    />
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>
        {:else if activeTab === 'fallback_screen'}
            <div class="tab-panel fallback-tab">
                <div class="fallback-description">
                    <p>Enable to show a custom image or video when the kiosk app crashes.</p>
                </div>
                <div class="fallback-toggle">
                    <Toggle
                        bind:checked={fallbackScreenEnabled}
                        label="Enable fallback screen"
                        labelPosition="right"
                    />
                </div>
                {#if fallbackScreenEnabled}
                    {#if isCreateMode}
                        <p class="fallback-hint">Save the rule first to upload a fallback screen.</p>
                    {:else}
                    <div class="fallback-upload">
                        {#if fallbackScreenUrl}
                            <div class="fallback-current">
                                <button
                                    type="button"
                                    class="fallback-current-name link"
                                    on:click={handleFallbackDownload}
                                    disabled={buttonsDisabled}
                                    title="Download"
                                >
                                    <Download class="fallback-download-icon" size={18} />
                                    <span>{fallbackFileName || 'Uploaded file'}</span>
                                </button>
                                {#if fallbackFileSize != null}
                                    <span class="fallback-current-size">{formatFallbackSize(fallbackFileSize)}</span>
                                {/if}
                                <Button
                                    variant="text"
                                    color="gray"
                                    size="sm"
                                    icon={X}
                                    iconPosition="only"
                                    iconSize={18}
                                    aria-label="Remove fallback file"
                                    disabled={buttonsDisabled}
                                    on:click={removeFallbackFile}
                                />
                            </div>
                            {#if fallbackUploadProgress != null && fallbackUploadProgress < 100}
                                <div class="fallback-progress">
                                    <span class="fallback-progress-label">Uploading… {fallbackUploadProgress}%</span>
                                    <div class="fallback-progress-bar" role="progressbar" aria-valuenow={fallbackUploadProgress} aria-valuemin="0" aria-valuemax="100">
                                        <div class="fallback-progress-fill" style="width: {fallbackUploadProgress}%;"></div>
                                    </div>
                                </div>
                            {/if}
                        {:else}
                            <div class="fallback-upload-zone">
                                <input
                                    type="file"
                                    accept={FALLBACK_ACCEPT}
                                    class="fallback-input"
                                    bind:this={fallbackInputEl}
                                    on:change={handleFallbackFileChange}
                                    disabled={buttonsDisabled}
                                />
                                <Button
                                    variant="outline"
                                    color="primary"
                                    size="md"
                                    disabled={buttonsDisabled}
                                    on:click={() => fallbackInputEl?.click()}
                                >
                                    {#if fallbackUploadProgress != null && fallbackUploadProgress < 100}
                                        Uploading… {fallbackUploadProgress}%
                                    {:else}
                                        Choose image or video
                                    {/if}
                                </Button>
                                {#if fallbackUploadProgress != null && fallbackUploadProgress < 100}
                                    <div class="fallback-progress mt-2">
                                        <div class="fallback-progress-bar" role="progressbar" aria-valuenow={fallbackUploadProgress} aria-valuemin="0" aria-valuemax="100">
                                            <div class="fallback-progress-fill" style="width: {fallbackUploadProgress}%;"></div>
                                        </div>
                                    </div>
                                {:else}
                                    <p class="fallback-hint">JPEG, PNG, WebP, GIF or MP4, WebM. Max 50 MB.</p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    {/if}
                {/if}
            </div>
        {:else if activeTab === 'apply_to'}
            <div class="tab-panel apply-to-tab">
                <div class="apply-to-description">
                    <p>Choose whether this rule applies to all devices in your account or only to selected devices.</p>
                </div>
                <div class="apply-to-field">
                    <Dropdown
                        label="Apply to"
                        placeholder="Select"
                        options={applyToOptions}
                        bind:value={applyTo}
                        required={true}
                        width="280px"
                    />
                </div>
                {#if applyToError}
                    <p class="field-error-inline">{applyToError}</p>
                {/if}
                {#if applyTo === 'devices'}
                    <div class="apply-to-add-actions">
                        <div class="apply-to-by-tag">
                            <span class="apply-to-label">Add by tag</span>
                            {#if deviceTags.length === 0 && deviceTagsLoaded}
                                <span class="apply-to-hint">No tags in your account. Create tags under Devices → Tags.</span>
                            {:else}
                                <div class="apply-to-tag-select-row">
                                    <Dropdown
                                        label="Select tags"
                                        placeholder="Search and select tags…"
                                        options={tagOptionsForDropdown}
                                        bind:value={selectedTagIdsForAdd}
                                        multiple={true}
                                        searchable={true}
                                        width="100%"
                                        maxHeight={280}
                                    />
                                    <div class="apply-to-add-btn-wrap">
                                        <Button
                                            variant="outline"
                                            color="primary"
                                            size="sm"
                                            disabled={selectedTagIdsForAdd.length === 0 || addByTagLoading}
                                            on:click={addDevicesByTag}
                                        >
                                            {addByTagLoading ? 'Adding…' : 'Add'}
                                        </Button>
                                    </div>
                                </div>
                            {/if}
                        </div>
                        <div class="apply-to-manual">
                            <Button
                                variant="outline"
                                color="primary"
                                size="md"
                                on:click={() => (devicePickerOpen = true)}
                            >
                                <Plus size={18} slot="icon-left" />
                                Add devices
                            </Button>
                        </div>
                    </div>
                    <p class="apply-to-selected-label">Selected ({selectedDevices.length} item{selectedDevices.length !== 1 ? 's' : ''})</p>
                    {#if applyToDevicesLoading}
                        <p class="apply-to-loading">Loading devices…</p>
                    {:else}
                        <div class="apply-to-selected-list">
                            {#each selectedDevices as device (device.id)}
                                <div class="apply-to-selected-row">
                                    <div class="apply-to-device-info">
                                        <span class="apply-to-device-name">{device.name || device.id}</span>
                                        <span class="apply-to-device-id">{device.macAddress || device.id}</span>
                                    </div>
                                    <Button
                                        variant="text"
                                        color="gray"
                                        size="sm"
                                        icon={X}
                                        iconPosition="only"
                                        iconSize={18}
                                        aria-label="Remove device"
                                        on:click={() => removeDevice(device.id)}
                                    />
                                </div>
                            {/each}
                            {#if selectedDevices.length === 0}
                                <span class="apply-to-empty">No devices selected. Add by tag or add devices manually.</span>
                            {/if}
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
    </div>

    <svelte:fragment slot="footer">
        <div class="modal-btn-wrapper">
            <Button variant="outline" size="lg" color="primary" disabled={buttonsDisabled} on:click={handleCancel}>
                Cancel
            </Button>
        </div>
        {#if showDraftActions}
            <div class="modal-btn-wrapper">
                <Button variant="filled" size="lg" color="primary" loading={saving} disabled={buttonsDisabled} on:click={handleSaveAsDraft}>
                    Save as Draft
                </Button>
            </div>
            <div class="modal-btn-wrapper">
                <Button variant="filled" size="lg" color="primary" loading={saving} disabled={buttonsDisabled} on:click={handleSaveAndPublish}>
                    Save & Publish
                </Button>
            </div>
        {:else}
            <div class="modal-btn-wrapper">
                <Button variant="filled" size="lg" color="primary" loading={saving} disabled={buttonsDisabled} on:click={handleSaveAndPublish}>
                    Save
                </Button>
            </div>
        {/if}
    </svelte:fragment>
</Modal>

<AppPickerModal
    open={appPickerOpen}
    title="Add App"
    size="md"
    confirmText="Assign"
    appsEndpoint={`${apiPrefix}/resources/apps`}
    selectionMode="packageName"
    showAlreadyBadge={false}
    on:close={() => (appPickerOpen = false)}
    on:confirm={handleAddAppConfirm}
/>

<DeviceSelector
    bind:open={devicePickerOpen}
    bundleId=""
    {apiPrefix}
    devicesEndpoint={`${apiPrefix}/devices/select`}
    excludeDeviceIds={selectedDevices.map((d) => d.id)}
    on:select={handleDevicesSelected}
    on:close={() => (devicePickerOpen = false)}
/>

<style>
    /* Modal content: natural height so modal-body scrolls on small screens */
    .edit-rule-modal-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-6);
        width: 100%;
    }
    .edit-rule-fields {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        flex-shrink: 0;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }
    .toggle-field {
        flex-direction: row;
        align-items: center;
    }
    .label {
        font-weight: 500;
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-700);
    }
    .required {
        color: var(--ds-color-error-500);
    }
    .field-error-inline {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-error-500);
        margin: 0;
    }

    /* Tab strip does not grow */
    .edit-rule-modal-body :global(.tab-group) {
        flex-shrink: 0;
    }
    .tab-panel {
        /* No fixed height so content flows and modal body scrolls on small screens */
        flex-shrink: 0;
    }
    .tab-panel.placeholder p {
        margin: 0;
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-600);
    }
    .pinned-app-tab {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    .pinned-app-actions {
        flex-shrink: 0;
    }
    .pinned-app-selected {
        flex-shrink: 0;
    }
    .pinned-app-selected-label {
        font-size: var(--ds-text-sm);
        font-weight: 500;
        color: var(--ds-color-neutral-true-700);
        margin: 0 0 var(--ds-space-2) 0;
    }
    .pinned-app-empty {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-600);
        margin: 0;
    }
    .pinned-app-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }
    .pinned-app-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) var(--ds-space-3);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-md);
    }
    .pinned-app-package {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-800);
        word-break: break-all;
    }
    .fallback-tab {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    .fallback-description p {
        margin: 0;
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-600);
    }
    .fallback-toggle {
        flex-shrink: 0;
    }
    .fallback-upload {
        flex: 1;
        min-height: 0;
    }
    .fallback-current {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-3);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-md);
    }
    .fallback-current-name {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-800);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .fallback-current-name.link {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-align: left;
        font: inherit;
        display: inline-flex;
        align-items: center;
        gap: var(--ds-space-2);
        color: var(--ds-color-primary-600);
    }
    .fallback-current-name.link:hover:not(:disabled) {
        color: var(--ds-color-primary-700);
        text-decoration: underline;
    }
    .fallback-download-icon {
        flex-shrink: 0;
    }
    .fallback-current-name.link:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }
    .fallback-progress {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        width: 100%;
    }
    .fallback-progress-label {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-600);
    }
    .fallback-progress-bar {
        height: 6px;
        width: 100%;
        background: var(--ds-color-gray-200);
        border-radius: 3px;
        overflow: hidden;
    }
    .fallback-progress-fill {
        height: 100%;
        background: var(--ds-color-primary-500);
        border-radius: 3px;
        transition: width 0.15s ease;
    }
    .fallback-upload-zone .mt-2 {
        margin-top: var(--ds-space-2);
    }
    .fallback-current-size {
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-600);
    }
    .fallback-upload-zone {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ds-space-2);
    }
    .fallback-input {
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
    }
    .fallback-hint {
        margin: 0;
        font-size: var(--ds-text-xs);
        color: var(--ds-color-gray-500);
    }
    .modal-btn-wrapper {
        min-width: 100px;
    }

    .apply-to-tab {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    .apply-to-description p {
        margin: 0;
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-600);
    }
    .apply-to-field {
        max-width: 280px;
    }
    .apply-to-add-actions {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }
    .apply-to-by-tag {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }
    .apply-to-label {
        font-size: var(--ds-text-sm);
        font-weight: 500;
        color: var(--ds-color-neutral-true-700);
    }
    .apply-to-hint {
        font-size: var(--ds-text-xs);
        color: var(--ds-color-gray-500);
    }
    .apply-to-tag-select-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--ds-space-3);
    }
    .apply-to-tag-select-row :global(.dropdown-container) {
        flex: 1;
        min-width: 200px;
    }
    .apply-to-add-btn-wrap {
        flex-shrink: 0;
    }
    .apply-to-manual {
        flex-shrink: 0;
    }
    .apply-to-selected-label {
        font-weight: 500;
        font-size: var(--ds-text-sm);
        color: var(--ds-color-neutral-true-700);
        margin: 0 0 var(--ds-space-2) 0;
    }
    .apply-to-loading {
        margin: 0;
        font-size: var(--ds-text-sm);
        color: var(--ds-color-gray-500);
    }
    .apply-to-selected-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        max-height: 240px;
        overflow-y: auto;
    }
    .apply-to-selected-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) var(--ds-space-3);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-md);
    }
    .apply-to-device-info {
        display: flex;
        flex-direction: column;
        gap: 0;
        min-width: 0;
    }
    .apply-to-device-name {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
    }
    .apply-to-device-id {
        font-size: var(--ds-text-xs);
        color: var(--ds-text-secondary);
    }
    .apply-to-empty {
        margin: 0;
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        padding: var(--ds-space-3);
    }
</style>
