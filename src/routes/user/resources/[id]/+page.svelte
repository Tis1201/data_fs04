<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Download, Trash2, FileText, File } from 'lucide-svelte';
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

    // Handle download
    function downloadFile() {
        window.open(resource.path, '_blank');
    }

    // Handle delete
    async function deleteResource() {
        if (confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
            try {
                const response = await fetch(`/user/resources?/deleteResource`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `id=${resource.id}`
                });

                if (response.ok) {
                    toast.success('Resource deleted successfully');
                    goto('/user/resources');
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to delete resource');
                }
            } catch (error) {
                console.error('Error deleting resource:', error);
                toast.error(error.message || 'Failed to delete resource');
            }
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
            <div class="grid grid-cols-2 gap-6 p-2">
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
