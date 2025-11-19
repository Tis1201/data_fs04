<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { Download, Upload, FileText, AlertCircle } from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    // Props
    export let context: 'admin' | 'user' = 'admin';
    export let selectedProfiles: any[] = [];

    // State
    let importFile: File | null = null;
    let importLoading = false;
    let exportLoading = false;

    // Handle file selection for import
    function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (file) {
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                importFile = file;
                toast.success(`Selected file: ${file.name}`);
            } else {
                toast.error('Please select a valid JSON file');
                target.value = '';
            }
        }
    }

    // Handle profile import
    async function handleImport() {
        if (!importFile) {
            toast.error('Please select a file to import');
            return;
        }

        importLoading = true;
        try {
            const text = await importFile.text();
            const profiles = JSON.parse(text);

            if (!Array.isArray(profiles)) {
                throw new Error('Invalid file format. Expected an array of profiles.');
            }

            // Validate profiles structure
            for (const profile of profiles) {
                if (!profile.name || !profile.settings) {
                    throw new Error('Invalid profile structure. Missing required fields.');
                }
            }

            // Import profiles via API
            let successCount = 0;
            let errorCount = 0;

            for (const profile of profiles) {
                try {
                    const response = await fetch(`/api/v2/device-profiles`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: profile.name,
                            description: profile.description,
                            settings: profile.settings
                        })
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Successfully imported ${successCount} profile(s)`);
                dispatch('profilesImported');
            }
            
            if (errorCount > 0) {
                toast.error(`Failed to import ${errorCount} profile(s)`);
            }

        } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to import profiles. Please check the file format.');
        } finally {
            importLoading = false;
            importFile = null;
            // Reset file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        }
    }

    // Handle profile export
    async function handleExport() {
        if (selectedProfiles.length === 0) {
            toast.error('Please select profiles to export');
            return;
        }

        exportLoading = true;
        try {
            const profilesData = [];

            // Get detailed data for selected profiles
            for (const profile of selectedProfiles) {
                const response = await fetch(`/api/v2/device-profiles/${profile.id}`);
                if (response.ok) {
                    const result = await response.json();
                    profilesData.push(result.profile);
                }
            }

            // Create and download JSON file
            const dataStr = JSON.stringify(profilesData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `device-profiles-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success(`Exported ${profilesData.length} profile(s)`);

        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export profiles');
        } finally {
            exportLoading = false;
        }
    }

    // Handle template export
    function handleTemplateExport() {
        const templates = [
            {
                name: 'Retail Kiosk Template',
                description: 'Standard configuration for retail kiosk devices',
                settings: [
                    { key: 'kiosk_lock_mode', value: 'enabled', dataType: 'boolean', label: 'Kiosk Lock Mode', category: 'Security', order: 0 },
                    { key: 'display_resolution', value: '1920x1080', dataType: 'select', label: 'Display Resolution', category: 'Display', order: 1 },
                    { key: 'enable_audio', value: 'enabled', dataType: 'boolean', label: 'Enable Audio', category: 'Audio', order: 2 }
                ]
            },
            {
                name: 'Digital Signage Template',
                description: 'Configuration for digital signage displays',
                settings: [
                    { key: 'display_resolution', value: '1920x1080', dataType: 'select', label: 'Display Resolution', category: 'Display', order: 0 },
                    { key: 'screen_orientation', value: 'landscape', dataType: 'select', label: 'Screen Orientation', category: 'Display', order: 1 },
                    { key: 'auto_rotate_content', value: 'enabled', dataType: 'boolean', label: 'Auto Rotate Content', category: 'Display', order: 2 }
                ]
            }
        ];

        const dataStr = JSON.stringify(templates, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `device-profile-templates-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Template file downloaded');
    }
</script>

<div class="space-y-6">
    <!-- Import Section -->
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <Upload class="h-5 w-5" />
                Import Profiles
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <div class="space-y-2">
                <Label htmlFor="import-file">Select JSON file to import</Label>
                <Input
                    id="import-file"
                    type="file"
                    accept=".json"
                    on:change={handleFileSelect}
                    class="cursor-pointer"
                />
                <p class="text-sm text-muted-foreground">
                    Select a JSON file containing device profiles to import.
                </p>
            </div>
            
            {#if importFile}
                <div class="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <FileText class="h-4 w-4 text-blue-600" />
                    <span class="text-sm text-blue-800">{importFile.name}</span>
                    <Badge variant="secondary" class="ml-auto">
                        {(importFile.size / 1024).toFixed(1)} KB
                    </Badge>
                </div>
            {/if}

            <Button 
                on:click={handleImport}
                disabled={!importFile || importLoading}
                class="w-full"
            >
                {#if importLoading}
                    Importing...
                {:else}
                    <Upload class="mr-2 h-4 w-4" />
                    Import Profiles
                {/if}
            </Button>
        </CardContent>
    </Card>

    <!-- Export Section -->
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <Download class="h-5 w-5" />
                Export Profiles
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <div class="space-y-3">
                <Button 
                    on:click={handleExport}
                    disabled={selectedProfiles.length === 0 || exportLoading}
                    variant="outline"
                    class="w-full"
                >
                    {#if exportLoading}
                        Exporting...
                    {:else}
                        <Download class="mr-2 h-4 w-4" />
                        Export Selected Profiles ({selectedProfiles.length})
                    {/if}
                </Button>

                <Button 
                    on:click={handleTemplateExport}
                    variant="outline"
                    class="w-full"
                >
                    <FileText class="mr-2 h-4 w-4" />
                    Download Template File
                </Button>
            </div>

            <div class="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle class="h-4 w-4 text-yellow-600 mt-0.5" />
                <div class="text-sm text-yellow-800">
                    <p class="font-medium">Export Format</p>
                    <p>Profiles are exported as JSON files that can be imported into other instances or used as backups.</p>
                </div>
            </div>
        </CardContent>
    </Card>
</div>
