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
    export let label: string = 'Label';
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
            case 'failed': return '#EE2D2D';
            case 'success': return '#3EAC57';
            default: return '#2771E7';
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
                <!-- Browse Button - dùng Button component từ design-system -->
                <Button
                    variant="text"
                    size="md"
                    color="primary"
                    disabled={disabled}
                    on:click={handleBrowseButtonClick}
                    class="browse-link"
                >
                    Browse files
                </Button>
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
                    <!-- File Info -->
                    <div class="file-info">
                        {#if file.state === 'download'}
                            <!-- Download link style - dùng Button component từ design-system -->
                            <Button
                                variant="text"
                                size="sm"
                                color="primary"
                                on:click={() => handleDownload(file)}
                                class="file-name-link"
                            >
                                {file.name}
                            </Button>
                        {:else}
                            <span class="file-name">{file.name}</span>
                            {#if file.size && file.state !== 'failed'}
                                <span class="file-size">{formatFileSize(file.size)}</span>
                            {/if}
                        {/if}
                    </div>

                    <!-- Actions - dùng Button component từ design-system -->
                    <div class="file-actions">
                        {#if file.state === 'download'}
                            <Button
                                variant="ghost"
                                size="sm"
                                iconOnly={true}
                                icon={Download}
                                iconSize={20}
                                on:click={() => handleDownload(file)}
                                title="Download"
                                class="action-btn-download"
                            />
                        {:else if file.state === 'failed' || file.state === 'disabled'}
                            <Button
                                variant="ghost"
                                size="sm"
                                iconOnly={true}
                                icon={RefreshCw}
                                iconSize={20}
                                on:click={() => handleRetry(file)}
                                title="Retry"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                iconOnly={true}
                                icon={X}
                                iconSize={20}
                                on:click={() => handleRemove(file)}
                                title="Remove"
                            />
                        {:else if file.state === 'view'}
                            <Button
                                variant="ghost"
                                size="sm"
                                iconOnly={true}
                                icon={Trash2}
                                iconSize={20}
                                color="danger"
                                on:click={() => handleRemove(file)}
                                title="Delete"
                                class="action-btn-delete"
                            />
                        {:else}
                            <Button
                                variant="ghost"
                                size="sm"
                                iconOnly={true}
                                icon={X}
                                iconSize={20}
                                on:click={() => handleRemove(file)}
                                title="Cancel"
                            />
                        {/if}
                    </div>

                    <!-- Progress Bar -->
                    {#if file.state === 'ongoing' || file.state === 'failed' || file.state === 'success'}
                        <div class="progress-bar">
                            <div class="progress-track">
                                <div 
                                    class="progress-fill"
                                    style="width: {file.progress ?? 0}%; background-color: {getProgressBarColor(file.state)};"
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
        gap: 4px;
        font-family: var(--ds-font-family-primary);
        width: 100%;
    }

    /* Label */
    .file-upload-label {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 2px;
        gap: 2px;
    }

    .label-text {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }

    .label-required {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #D92D20;
    }

    /* Drop Zone */
    .drop-zone {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 16px;
        gap: 8px;
        width: 100%;
        min-width: 128px;
        height: 100px;
        background: #FFFFFF;
        border: 1px dashed #0086C9;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .drop-zone:hover {
        background: #F0F9FF;
    }

    .drop-zone-dragging {
        background: #F0F9FF;
        border-color: #026AA2;
        border-width: 2px;
    }

    .drop-zone-error {
        border-color: #E51F23;
    }

    .drop-zone-disabled {
        background: #F5F5F5;
        border-color: #D6D6D6;
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
        padding: 8px;
        width: 40px;
        height: 40px;
        background: #F0F9FF;
        border-radius: 100px;
        color: #0086C9;
    }

    .drop-zone-disabled .upload-icon {
        background: #E5E5E5;
        color: #A3A3A3;
    }

    /* Content */
    .drop-zone-content {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 4px;
    }

    .drop-zone-text {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: #424242;
    }

    .drop-zone-disabled .drop-zone-text {
        color: #A3A3A3;
    }

    .browse-link {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-blue-light-600);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        margin: 0;
    }

    .browse-link:hover {
        color: #026AA2;
        text-decoration: underline;
    }

    .browse-link:disabled {
        color: #A3A3A3;
        cursor: not-allowed;
    }

    /* Helper Text */
    .helper-text {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        padding: 2px;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #737373;
    }

    .helper-text-error {
        color: #D92D20;
    }

    /* File List */
    .file-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        margin-top: 8px;
    }

    /* File Item */
    .file-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        gap: 4px;
        width: 100%;
    }

    .file-item-disabled {
        opacity: 0.6;
    }

    .file-info {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        width: 100%;
    }

    .file-name {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #292929;
    }

    .file-item-disabled .file-name {
        color: #A3A3A3;
    }

    .file-name-link {
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-regular);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-blue-600);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        margin: 0;
    }

    .file-name-link:hover {
        text-decoration: underline;
    }

    .file-size {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #737373;
        flex-grow: 1;
    }

    /* File Actions */
    .file-actions {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 8px;
        margin-left: auto;
    }

    .action-btn {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 8px;
        width: 36px;
        height: 36px;
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        color: #026AA2;
        transition: background-color 0.15s ease;
    }

    .action-btn:hover {
        background: #F0F9FF;
    }

    .action-btn-delete {
        color: #B42318;
    }

    .action-btn-delete:hover {
        background: #FEF3F2;
    }

    .action-btn-download {
        padding: 4px;
        width: 28px;
        height: 28px;
    }

    /* Progress Bar */
    .progress-bar {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 8px;
        width: 100%;
        height: 4px;
    }

    .progress-track {
        width: 100%;
        height: 4px;
        background: #EDEFF1;
        border-radius: 4px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    /* File Error Message */
    .file-error-message {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #EE2D2D;
        width: 100%;
    }
</style>
