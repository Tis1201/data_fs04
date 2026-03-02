<script context="module" lang="ts">
    // Types - must be in module context for export
    export type FileUploadState = 'default' | 'error';
    export type FileItemState = 'ongoing' | 'failed' | 'success' | 'disabled' | 'view' | 'download';

    export interface UploadedFile {
        id: string;
        name: string;
        size?: number;
        progress?: number;
        state: FileItemState;
        errorMessage?: string;
        url?: string;
    }
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Upload, X, RefreshCw, Trash2, Download } from 'lucide-svelte';
    import { Button } from '$lib/design-system/components';

    // Props
    export let label: string = ''; // Optional label - empty string means no label
    export let required: boolean = false;
    export let state: FileUploadState = 'default';
    export let errorMessage: string = 'This field is required';
    export let helperText: string = '';
    export let accept: string = '*';
    export let multiple: boolean = true;
    export let maxFiles: number = 100;
    export let maxFileSize: number = 500; // MB
    export let acceptedTypes: string = 'png, jpg, jpeg, webp, pdf, docx, xlsx, csv, pptx, mp4';
    export let disabled: boolean = false;
    export let files: UploadedFile[] = [];
    export let showDropZone: boolean = true;

    const dispatch = createEventDispatcher<{
        browse: void;
        drop: FileList;
        remove: UploadedFile;
        retry: UploadedFile;
        download: UploadedFile;
    }>();

    let isDragging = false;
    let fileInput: HTMLInputElement;

    function formatFileSize(bytes?: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    function handleDragEnter(e: DragEvent) {
        e.preventDefault();
        if (!disabled) isDragging = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (disabled) return;
        
        const droppedFiles = e.dataTransfer?.files;
        if (droppedFiles) {
            dispatch('drop', droppedFiles);
        }
    }

    function handleBrowseClick() {
        if (!disabled) {
            fileInput?.click();
            dispatch('browse');
        }
    }
    
    function handleBrowseButtonClick() {
        // Both button click and drop zone click call handleBrowseClick()
        // No need to stopPropagation as both actions are the same
        handleBrowseClick();
    }

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files) {
            dispatch('drop', input.files);
        }
        // Reset input so the same file can be selected again
        input.value = '';
    }

    function handleRemove(file: UploadedFile) {
        dispatch('remove', file);
    }

    function handleRetry(file: UploadedFile) {
        dispatch('retry', file);
    }

    function handleDownload(file: UploadedFile) {
        dispatch('download', file);
    }

    function getProgressBarColor(fileState: FileItemState): string {
        switch (fileState) {
            case 'failed': return 'var(--ds-color-progress-failed)'; // #EE2D2D
            case 'success': return 'var(--ds-color-progress-success)'; // #3EAC57
            default: return 'var(--ds-color-progress-ongoing)'; // #2771E7
        }
    }
</script>

<div class="file-upload">
    <!-- Label -->
    {#if label}
        <div class="file-upload-label">
            <span class="label-text">{label}</span>
            {#if required}
                <span class="label-required">*</span>
            {/if}
        </div>
    {/if}

    <!-- Drop Zone -->
    {#if showDropZone}
        <div 
            class="drop-zone"
            class:drop-zone-dragging={isDragging}
            class:drop-zone-error={state === 'error'}
            class:drop-zone-disabled={disabled}
            on:dragenter={handleDragEnter}
            on:dragleave={handleDragLeave}
            on:dragover={handleDragOver}
            on:drop={handleDrop}
            on:click={handleBrowseClick}
            role="button"
            tabindex={disabled ? -1 : 0}
            on:keydown={(e) => e.key === 'Enter' && handleBrowseClick()}
        >
            <!-- Hidden file input -->
            <input
                bind:this={fileInput}
                type="file"
                {accept}
                {multiple}
                {disabled}
                class="file-input"
                on:change={handleFileSelect}
            />

            <!-- Upload Icon -->
            <div class="upload-icon">
                <Upload size={24} strokeWidth={2} />
            </div>

            <!-- Content -->
            <div class="drop-zone-content">
                <span class="drop-zone-text">Drag and drop your file here or</span>
                <!-- Browse Button - uses Button component from design-system -->
                <!-- Wrapper span stops propagation so drop-zone's on:click is not triggered (prevents file picker opening twice) -->
                <span role="presentation" on:click|stopPropagation={() => {}}>
                    <Button
                        type="button"
                        variant="text"
                        size="md"
                        color="primary"
                        disabled={disabled}
                        on:click={handleBrowseButtonClick}
                    >
                        Browse files
                    </Button>
                </span>
            </div>
        </div>
    {/if}

    <!-- Helper Text / Error Message -->
    {#if state === 'error' && errorMessage}
        <div class="helper-text helper-text-error">
            {errorMessage}
        </div>
    {:else if helperText}
        <div class="helper-text">
            {helperText}
        </div>
    {:else if showDropZone && (maxFiles || maxFileSize || acceptedTypes)}
        <div class="helper-text">
            Upload up to {maxFiles} files, maximum file size {maxFileSize}MB, 
            acceptable file types: {acceptedTypes}.
        </div>
    {/if}

    <!-- File List -->
    {#if files.length > 0}
        <div class="file-list">
            {#each files as file (file.id)}
                <div 
                    class="file-item"
                    class:file-item-disabled={file.state === 'disabled'}
                >
                    <!-- File Info and Actions - same row as in design -->
                    <div class="file-info-row">
                        <!-- File Info -->
                        <div class="file-info">
                            {#if file.state === 'download'}
                                <!-- Download link style - use <a> tag instead of button, icon after file name per design -->
                                <!-- Figma: Download filename color #155EEF (primary-600) -->
                                <a
                                    href={file.url || '#'}
                                    class="file-download-link"
                                    on:click|preventDefault={() => handleDownload(file)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <span class="file-download-text">{file.name}</span>
                                    <Download size={14} strokeWidth={2} class="file-download-icon" />
                                </a>
                            {:else}
                                <span class="file-name">{file.name}</span>
                                {#if file.size && file.state !== 'failed'}
                                    <span class="file-size">{formatFileSize(file.size)}</span>
                                {/if}
                            {/if}
                        </div>

                        <!-- Actions - use Button component from design-system -->
                        <!-- Figma: Buttons have background only on hover, default is transparent -->
                        <!-- Download state has no separate action buttons because icon is already after file name -->
                        {#if file.state !== 'download'}
                            <div class="file-actions">
                                {#if file.state === 'failed' || file.state === 'disabled'}
                                    <div class="file-action-btn-wrapper">
                                        <Button
                                            variant="text"
                                            size="sm"
                                            icon={RefreshCw}
                                            iconPosition="only"
                                            iconSize={20}
                                            disabled={file.state === 'disabled'}
                                            on:click={() => handleRetry(file)}
                                            aria-label="Retry"
                                        />
                                    </div>
                                    <div class="file-action-btn-wrapper">
                                        <Button
                                            variant="text"
                                            size="sm"
                                            icon={X}
                                            iconPosition="only"
                                            iconSize={20}
                                            disabled={file.state === 'disabled'}
                                            on:click={() => handleRemove(file)}
                                            aria-label="Remove"
                                        />
                                    </div>
                                {:else if file.state === 'view'}
                                    <div class="file-action-btn-wrapper file-action-btn-danger-wrapper">
                                        <Button
                                            variant="text"
                                            size="sm"
                                            icon={Trash2}
                                            iconPosition="only"
                                            iconSize={20}
                                            color="danger"
                                            on:click={() => handleRemove(file)}
                                            aria-label="Delete"
                                        />
                                    </div>
                                {:else if file.state === 'ongoing' || file.state === 'success'}
                                    <!-- Ongoing and Success: have close button (X) -->
                                    <div class="file-action-btn-wrapper">
                                        <Button
                                            variant="text"
                                            size="sm"
                                            icon={X}
                                            iconPosition="only"
                                            iconSize={20}
                                            on:click={() => handleRemove(file)}
                                            aria-label="Cancel"
                                        />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <!-- Progress Bar -->
                    {#if file.state === 'ongoing' || file.state === 'failed' || file.state === 'success' || file.state === 'disabled'}
                        <div class="progress-bar">
                            <div class="progress-track">
                                <div 
                                    class="progress-fill"
                                    class:progress-fill-hidden={file.state === 'disabled'}
                                    style="width: {file.progress ?? 0}%; background-color: {file.state === 'disabled' ? 'transparent' : (file.state === 'ongoing' || file.state === 'failed' || file.state === 'success' ? getProgressBarColor(file.state) : 'transparent')};"
                                />
                            </div>
                        </div>
                    {/if}

                    <!-- Error Message -->
                    {#if file.state === 'failed' && file.errorMessage}
                        <div class="file-error-message">
                            {file.errorMessage}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .file-upload {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: var(--ds-space-1);
        font-family: var(--ds-font-family-primary);
        width: 100%;
    }

    /* Label */
    .file-upload-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-space-0-5);
        gap: var(--ds-space-0-5);
    }

    .label-text {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-600);
    }

    .label-required {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        letter-spacing: 0.01em;
        color: var(--ds-color-error-600);
    }

    /* Drop Zone */
    .drop-zone {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: var(--ds-space-4); /* 16px - per design */
        gap: var(--ds-space-2); /* 8px - spacing between icon and content */
        width: 100%;
        min-width: 128px;
        min-height: 100px; /* Min height instead of fixed height so content can adjust */
        background: var(--ds-color-white);
        border: 1px dashed var(--ds-color-blue-light-600);
        border-radius: var(--ds-radius-lg);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .drop-zone:hover {
        background: var(--ds-color-blue-light-50);
    }

    .drop-zone-dragging {
        background: var(--ds-color-blue-light-50);
        border-color: var(--ds-color-blue-light-700);
        border-width: 2px;
    }

    .drop-zone-error {
        border-color: var(--ds-color-error-600);
    }

    .drop-zone-disabled {
        background: var(--ds-input-bg-disabled);
        border-color: var(--ds-color-neutral-true-300);
        cursor: not-allowed;
    }

    .file-input {
        display: none;
    }

    /* Upload Icon */
    .upload-icon {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-2);
        width: 40px;
        height: 40px;
        background: var(--ds-color-blue-light-50);
        border-radius: 100px;
        color: var(--ds-color-blue-light-600);
    }

    .drop-zone-disabled .upload-icon {
        background: var(--ds-color-neutral-true-200);
        color: var(--ds-color-neutral-true-400);
    }

    /* Content */
    .drop-zone-content {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: var(--ds-space-1);
    }

    .drop-zone-text {
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-700);
    }

    .drop-zone-disabled .drop-zone-text {
        color: var(--ds-color-neutral-true-400);
    }

    /* Helper Text */
    .helper-text {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: var(--ds-space-0-5);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-500);
    }

    .helper-text-error {
        color: var(--ds-color-error-600);
    }

    /* File List */
    .file-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        width: 100%;
        margin-top: var(--ds-space-2);
    }

    /* File Item */
    .file-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: var(--ds-space-1);
        width: 100%;
    }

    .file-item-disabled {
        opacity: 0.6;
    }

    /* File Info and Actions - same row as in design */
    .file-info-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: var(--ds-space-2);
    }

    .file-info {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        flex: 1;
        min-width: 0; /* Allow text truncation */
    }

    .file-name {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-800);
    }

    .file-item-disabled .file-name {
        color: var(--ds-color-neutral-true-400);
    }

    /* Download link - use <a> tag instead of button, Figma: #155EEF (primary-600) */
    .file-download-link {
        display: inline-flex;
        align-items: center;
        gap: var(--ds-space-2); /* 8px - gap between text and icon */
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-primary-600); /* #155EEF */
        text-decoration: none;
        cursor: pointer;
        transition: color 0.15s ease;
    }

    .file-download-link:hover {
        color: var(--ds-color-primary-600); /* Keep same color on hover */
        text-decoration: underline;
    }

    .file-download-text {
        color: inherit;
    }

    .file-download-icon {
        color: inherit;
        flex-shrink: 0;
    }

    .file-size {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-neutral-true-500);
        flex-grow: 1;
    }

    /* File Actions */
    .file-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
        flex-shrink: 0; /* Prevent actions from shrinking */
    }

    /* Action Buttons - Figma: Transparent default, background only on hover */
    .file-action-btn-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--ds-radius-lg);
        /* Default: transparent background */
        background: transparent;
        transition: background-color 0.15s ease;
    }

    /* Hover: Background #FAFAFA (Neutral - True/50) */
    .file-action-btn-wrapper:hover {
        background: var(--ds-color-neutral-true-50);
    }

    /* Style Button inside wrapper */
    .file-action-btn-wrapper :global(button) {
        /* Override Button component styles to match Figma */
        background: transparent !important;
        border: none !important;
        padding: var(--ds-space-2) !important;
        width: 36px !important;
        height: 36px !important;
        /* Icon color: Blue light/700 (#026AA2) */
        color: var(--ds-color-blue-light-700) !important;
    }

    /* Hover: Text/Icon color: #141414 (Neutral - True/900) on hover */
    .file-action-btn-wrapper:hover :global(button) {
        color: var(--ds-color-neutral-true-900) !important;
    }

    /* Danger button (Trash) - Red color */
    .file-action-btn-danger-wrapper :global(button) {
        color: var(--ds-color-error-700) !important;
    }

    .file-action-btn-danger-wrapper:hover :global(button) {
        color: var(--ds-color-error-700) !important;
    }

    /* Progress Bar */
    .progress-bar {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: var(--ds-space-2);
        width: 100%;
        height: 4px;
    }

    .progress-track {
        width: 100%;
        height: 4px;
        background: var(--ds-color-progress-bg); /* #EDEFF1 */
        border-radius: var(--ds-radius-sm);
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    /* Disabled state: hide progress fill */
    .progress-fill-hidden {
        visibility: hidden;
    }

    /* File Error Message */
    .file-error-message {
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-error-600);
        width: 100%;
    }
</style>
