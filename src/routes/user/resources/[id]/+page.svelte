<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Download, Trash2, FileText, File, Image, Video, Archive, FileSpreadsheet, Code, Music } from 'lucide-svelte';
    import { format } from 'date-fns';
    import { toast } from 'svelte-sonner';
    
    // Import the correct layout components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    
    export let data;
    const { resource } = data;
    const title = resource.name;
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Home", "/"],
        ["Resources", "/user/resources"],
        resource.name
    ];
    
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
    
    // Get the appropriate icon component
    const ResourceIcon = getResourceIcon(resource.type);

    // Handle download
    function downloadFile() {
        // Show loading indicator or feedback
        toast.loading('Preparing download...');
        
        // Attempt to download the file
        fetch(`/api/resources/${resource.id}`, { method: 'HEAD' })
            .then(response => {
                toast.dismiss();
                if (response.ok) {
                    // If the file exists, open it in a new tab
                    window.open(`/api/resources/${resource.id}`, '_blank');
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

    import { enhance } from '$app/forms';
    
    // Handle delete
    function deleteResource() {
        if (confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
            // The actual deletion will be handled by the form submission with enhance
            document.getElementById('deleteForm').submit();
        }
    }
    
    // Determine if the current user can edit this resource
    const canEdit = resource.createdBy === data.userId;
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
      },
      canEdit ? {
        label: "Delete",
        icon: Trash2,
        onClick: deleteResource,
        variant: "destructive",
        class: "h-9" // Fixed height for consistency
      } : null
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
                                        src={`/api/resources/${resource.id}`} 
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
                                    <a href={`/api/resources/${resource.id}`} target="_blank" class="text-primary hover:underline">View full size</a>
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
    </div>
</AdminPageLayout>

<!-- Hidden form for resource deletion -->
<form 
    id="deleteForm" 
    method="POST" 
    action="?/deleteResource" 
    use:enhance={{
        onSubmit: () => {
            // Show loading state
            return ({ result }) => {
                // Handle the result
                if (result.type === 'success') {
                    toast.success('Resource deleted successfully');
                    goto('/user/resources');
                } else if (result.type === 'failure') {
                    toast.error(result.data?.message || 'Failed to delete resource');
                }
            };
        }
    }}
    class="hidden"
>
    <!-- No additional form fields needed since we're using the ID from the URL params -->
</form>
