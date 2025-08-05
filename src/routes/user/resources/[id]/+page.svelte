<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Download, Trash, Trash2, FileText, File, Image, Video, Archive, FileSpreadsheet, Code, Music } from 'lucide-svelte';
    import { format } from 'date-fns';
    import { toast } from 'svelte-sonner';
    
    // Import the correct layout components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import RecordDeleteDialog from '$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte';
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    export let data;
    const { resource, form } = data;
    const title = resource.name;
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Home", "/"],
        ["Resources", "/user/resources"],
        resource.name
    ];

    const { form: formStore, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(form, {
        successRedirect: '/user/resources',
        validateOnInput: true
    });
    
    // Format file size to human readable format
    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Get appropriate icon based on resource type
    function getResourceIcon(type: string) {
        switch (type.toLowerCase()) {
            case 'image':
                return Image;
            case 'video':
                return Video;
            case 'document':
                return FileText;
            case 'audio':
                return Music;
            case 'archive':
                return Archive;
            case 'code':
                return Code;
            case 'spreadsheet':
                return FileSpreadsheet;
            default:
                return File;
        }
    }
    
    // Determine if resource is an image that can be previewed
    const isImage = resource.type.toLowerCase() === 'image';
    const filePath = resource.path.startsWith('http') ? resource.path : `/api/resources/${resource.id}`;
    
    // Get the appropriate icon component
    const ResourceIcon = getResourceIcon(resource.type);

    // Handle download
    function downloadFile() {
        // Show loading indicator or feedback
        toast.loading('Preparing download...');
        
        // Attempt to download the file
        fetch(filePath, { method: 'HEAD' })
            .then(response => {
                toast.dismiss();
                if (response.ok) {
                    // If the file exists, open it in a new tab
                    window.open(filePath, '_blank');
                } else {
                    // If the file doesn't exist, show an error
                    toast.error('File not found or inaccessible');
                }
            })
            .catch(error => {
                toast.dismiss();
                toast.error('Error accessing file');
                console.error('Download error:', error);
            });
    }
    
    // Determine if the current user can edit this resource
    const canEdit = resource.createdBy === data.userId;

    let deleteState = {
        selectedRecord: resource,
        confirmationOpen: false
    };
    function openDeleteDialog() {
        deleteState.selectedRecord = resource;
        deleteState.confirmationOpen = true;
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto('/user/resources'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
      {
        label: "Download",
        icon: Download,
        onClick: downloadFile,
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      }
    ].filter(Boolean)}
    compact={true}
    contentSpacing="space-y-6"
>
    <div class="w-full space-y-6">
        <AdminCard
            title="Resource Details"
            description="Information about this resource"
            icon={File}
            compact={true}
        >
            <!-- Combined Resource Preview and Details Section -->            
            <div class="flex flex-col md:flex-row gap-6 p-2">
                <!-- Resource Details Section -->
                <div class="flex-1 space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Name</p>
                    <p class="text-base">{resource.name}</p>
                </div>
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Type</p>
                    <p class="text-base capitalize">{resource.type}</p>
                </div>
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Size</p>
                    <p class="text-base">{resource.size ? formatFileSize(resource.size) : 'N/A'}</p>
                </div>
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Created On</p>
                    <p class="text-base">{format(new Date(resource.createdAt), 'MMM d, yyyy')}</p>
                </div>
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Uploaded By</p>
                    <p class="text-base">
                        {resource.creator?.name || resource.creator?.email || 'System'}
                    </p>
                </div>
                <div>
                    <p class="text-sm font-medium text-muted-foreground">Account</p>
                    <p class="text-base">{resource.account?.name || 'N/A'}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-sm font-medium text-muted-foreground">Description</p>
                    <p class="text-base">{resource.description || 'No description provided'}</p>
                </div>
                    </div>
                </div>
                
                <!-- Resource Preview Section -->
                <div class="w-full md:w-80 lg:w-96 flex-shrink-0">
                    <div class="relative overflow-hidden rounded-lg border border-border shadow-sm w-full h-64 flex items-center justify-center bg-muted">
                        {#if isImage}
                            <!-- Image Preview with Fallback -->
                            <div class="relative w-full h-full flex items-center justify-center">
                                {#if resource.path && resource.path.endsWith('.png') || resource.path.endsWith('.jpg') || resource.path.endsWith('.jpeg') || resource.path.endsWith('.gif')}
                                    <img 
                                        src={filePath} 
                                        alt={resource.name} 
                                        class="max-h-full max-w-full object-contain" 
                                        on:error={(e) => {
                                            // Hide the image on error
                                            e.target.style.display = 'none';
                                            // Show the fallback
                                            document.getElementById('image-fallback-' + resource.id).style.display = 'flex';
                                        }}
                                    />
                                    <!-- Fallback for image loading errors -->
                                    <div id={`image-fallback-${resource.id}`} class="hidden absolute inset-0 flex-col items-center justify-center">
                                        <svelte:component this={Image} class="w-16 h-16 text-muted-foreground mb-2" />
                                        <p class="text-sm text-muted-foreground">Image preview not available</p>
                                        <p class="text-xs text-muted-foreground mt-1">The image file may be missing or inaccessible</p>
                                    </div>
                                {:else}
                                    <!-- Show a placeholder for non-image files or when path is missing -->
                                    <div class="flex flex-col items-center justify-center">
                                        <svelte:component this={Image} class="w-16 h-16 text-muted-foreground mb-2" />
                                        <p class="text-sm text-muted-foreground">Preview not available</p>
                                        <p class="text-xs text-muted-foreground mt-1">This resource may not be an image or the file is missing</p>
                                    </div>
                                {/if}
                                <div class="absolute bottom-2 right-2 bg-background/80 text-xs px-2 py-1 rounded shadow-sm">
                                    <a href={filePath} target="_blank" class="text-primary hover:underline">View full size</a>
                                </div>
                            </div>
                        {:else}
                            <!-- Non-Image Resource Preview -->
                            <div class="flex flex-col items-center justify-center p-4 w-full h-full">
                                <div class="w-20 h-20 flex items-center justify-center rounded-full bg-muted mb-4">
                                    <svelte:component this={ResourceIcon} class="w-10 h-10 text-muted-foreground" />
                                </div>
                                <p class="text-lg font-medium text-center">{resource.name}</p>
                                <p class="text-sm text-muted-foreground capitalize text-center">{resource.type} • {resource.size ? formatFileSize(resource.size) : 'N/A'}</p>
                                <button 
                                    class="mt-4 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                                    on:click={downloadFile}
                                >
                                    <Download class="w-4 h-4 mr-2" />
                                    Download File
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
            
            <svelte:fragment slot="footer">
                <MetadataFooter
                    items={[
                        { label: "Created", date: resource.createdAt, icon: 'calendar' },
                        { label: "Last Updated", date: resource.updatedAt, icon: 'clock' },
                        { label: "Created By", value: resource.creator?.name || resource.creator?.email || 'System', icon: 'user' }
                    ]}
                />
            </svelte:fragment>
        </AdminCard>

        {#if resource.metadata}
            <AdminCard
                title="Metadata"
                description="Additional information about this resource"
                icon={FileText}
                compact={true}
            >
                <pre class="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(resource.metadata, null, 2)}
                </pre>
            </AdminCard>
        {/if}

        <AdminCard title="Danger Zone" description="Permanent actions for this resource" icon={Trash} compact={true}>
            <div class="space-y-4">
                <div>
                    <h4 class="text-sm font-medium text-destructive">Delete Resource</h4>
                    <p class="text-sm text-muted-foreground mt-1">
                        Once you delete a resource, there is no going back. Please be certain.
                    </p>
                </div>

                <div>
                    <button
                            type="button"
                            class="inline-flex items-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white"
                            disabled={$submitting}
                            on:click={openDeleteDialog}
                    >
                        <Trash class="h-4 w-4 mr-2" />
                        Delete Resource
                    </button>
                </div>
            </div>
        </AdminCard>

        <!-- RecordDeleteDialog (kept as requested) -->
        <RecordDeleteDialog
            state={deleteState}
            action="?/deleteResource"
            actionName="deleteResource"
            onConfirm={() => {goto('/user/resources')}}
        />
    </div>
</AdminPageLayout>