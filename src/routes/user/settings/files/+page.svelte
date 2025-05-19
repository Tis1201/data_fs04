<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Folder, File, Upload, Download, Trash2, MoreVertical, Plus, Search } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { formatBytes } from "$lib/utils/format";
    
    // Define page metadata
    const pageTitle = "File Manager";
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", "/user/settings"],
        ["Files", ""]
    ] as [string, string][];
    
    // Mock data for files and folders
    let files = [
        { id: 1, name: 'Project Proposal.pdf', size: 2456789, type: 'pdf', uploaded: '2025-05-18T10:30:00' },
        { id: 2, name: 'Budget.xlsx', size: 124567, type: 'xlsx', uploaded: '2025-05-17T14:20:00' },
        { id: 3, name: 'Profile Picture.jpg', size: 345678, type: 'jpg', uploaded: '2025-05-16T09:15:00' },
        { id: 4, name: 'Meeting Notes.docx', size: 56789, type: 'docx', uploaded: '2025-05-15T16:45:00' },
        { id: 5, name: 'Screenshot.png', size: 1234567, type: 'png', uploaded: '2025-05-14T11:20:00' },
    ];
    
    let folders = [
        { id: 1, name: 'Documents', fileCount: 12, updated: '2025-05-18T10:30:00' },
        { id: 2, name: 'Images', fileCount: 8, updated: '2025-05-17T14:20:00' },
        { id: 3, name: 'Work', fileCount: 5, updated: '2025-05-16T09:15:00' },
    ];
    
    let selectedFiles = [];
    let searchQuery = '';
    let currentPath = [];
    
    function toggleFileSelection(fileId: number) {
        selectedFiles = selectedFiles.includes(fileId)
            ? selectedFiles.filter(id => id !== fileId)
            : [...selectedFiles, fileId];
    }
    
    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    function getFileIcon(type: string) {
        const icons = {
            pdf: 'text-red-500',
            xlsx: 'text-green-500',
            xls: 'text-green-500',
            docx: 'text-blue-500',
            doc: 'text-blue-500',
            jpg: 'text-purple-500',
            jpeg: 'text-purple-500',
            png: 'text-purple-500',
            gif: 'text-purple-500',
            default: 'text-gray-500'
        };
        
        return icons[type] || icons.default;
    }
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    class="space-y-6"
>
    <!-- Header with actions -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="relative w-full sm:max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                type="search" 
                placeholder="Search files..." 
                bind:value={searchQuery}
                class="pl-10 w-full"
            />
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
            <div class="relative">
                <Button variant="outline" size="sm" class="gap-2 relative">
                    <Upload class="h-4 w-4" />
                    Upload
                </Button>
                <input 
                    type="file" 
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    multiple
                />
            </div>
            <Button size="sm" class="gap-2">
                <Plus class="h-4 w-4" />
                New Folder
            </Button>
        </div>
    </div>
    
    <!-- Breadcrumb -->
    {#if currentPath.length > 0}
        <div class="flex items-center text-sm text-muted-foreground">
            <button 
                on:click={() => currentPath = []} 
                class="hover:text-foreground hover:underline"
            >
                Home
            </button>
            {#each currentPath as path, i}
                <span class="mx-2">/</span>
                <button 
                    on:click={() => currentPath = currentPath.slice(0, i + 1)} 
                    class="hover:text-foreground hover:underline"
                >
                    {path}
                </button>
            {/each}
        </div>
    {/if}
    
    <!-- Folders Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {#each folders as folder}
            <div 
                class="group relative p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                on:click={() => currentPath = [...currentPath, folder.name]}
            >
                <div class="flex flex-col items-center text-center">
                    <div class="p-3 bg-primary/10 rounded-full mb-2">
                        <Folder class="h-8 w-8 text-primary" />
                    </div>
                    <h3 class="font-medium text-sm truncate w-full">{folder.name}</h3>
                    <p class="text-xs text-muted-foreground">{folder.fileCount} items</p>
                </div>
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="p-1 rounded-full hover:bg-accent">
                        <MoreVertical class="h-4 w-4" />
                    </button>
                </div>
            </div>
        {/each}
    </div>
    
    <!-- Files Table -->
    <div class="rounded-md border">
        <div class="relative w-full overflow-auto">
            <table class="w-full caption-bottom text-sm">
                <thead class="[&_tr]:border-b">
                    <tr class="border-b transition-colors hover:bg-muted/50">
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-12">
                            <Checkbox />
                        </th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Size</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">Uploaded</th>
                        <th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                    </tr>
                </thead>
                <tbody class="[&_tr:last-child]:border-0">
                    {#each files.filter(file => 
                        !searchQuery || 
                        file.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    as file (file.id)}
                        <tr class="border-b transition-colors hover:bg-muted/50">
                            <td class="p-4 align-middle">
                                <Checkbox 
                                    checked={selectedFiles.includes(file.id)}
                                    on:change={() => toggleFileSelection(file.id)}
                                />
                            </td>
                            <td class="p-4 align-middle font-medium">
                                <div class="flex items-center gap-3">
                                    <File class={`h-5 w-5 ${getFileIcon(file.type)}`} />
                                    <span class="truncate max-w-[200px]">{file.name}</span>
                                </div>
                            </td>
                            <td class="p-4 align-middle text-muted-foreground hidden md:table-cell">
                                {formatBytes(file.size)}
                            </td>
                            <td class="p-4 align-middle text-muted-foreground hidden lg:table-cell">
                                {formatDate(file.uploaded)}
                            </td>
                            <td class="p-4 align-middle text-right">
                                <div class="flex justify-end gap-2">
                                    <button class="p-1.5 rounded-md hover:bg-accent" title="Download">
                                        <Download class="h-4 w-4" />
                                    </button>
                                    <button class="p-1.5 rounded-md hover:bg-accent text-destructive" title="Delete">
                                        <Trash2 class="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Empty State -->
    {#if files.length === 0 && folders.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <Folder class="h-12 w-12 text-muted-foreground mb-4" />
            <h3 class="text-lg font-medium mb-1">No files yet</h3>
            <p class="text-sm text-muted-foreground mb-4">
                Upload your first file or create a new folder to get started
            </p>
            <Button class="gap-2">
                <Upload class="h-4 w-4" />
                Upload Files
            </Button>
        </div>
    {/if}
</UserPageLayout>
