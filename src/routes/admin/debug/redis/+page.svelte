<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Database, RefreshCw, Plus, Search, Trash } from "lucide-svelte";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { toast } from "svelte-sonner";

    const title = `Redis Debug`;
    const pageCrumbs = [
        ["Admin", "/admin/dashboard"],
        ["Debug"],
        ["Redis"],
    ] as [string, string][];

    const actionButtons = [
        {
            label: "Back",
            onClick: () => {
                goto("/admin/dashboard");
            },
        },
    ];
    
    // State for Redis operations
    let keyInput = "";
    let valueInput = "";
    let ttlInput = "3600";
    let searchKey = "";
    let searchResult: { key: string; value: string | null; exists: boolean } | null = null;
    let isLoading = false;
    let errorMessage = "";
    let successMessage = "";
    let recentKeys: string[] = [];
    
    // Function to get a value from Redis
    async function getValue() {
        if (!searchKey) {
            errorMessage = "Please enter a key to search";
            return;
        }
        
        isLoading = true;
        errorMessage = "";
        successMessage = "";
        
        try {
            const response = await fetch(`/admin/debug/redis?key=${encodeURIComponent(searchKey)}`);
            const data = await response.json();
            
            if (response.ok) {
                searchResult = data;
                if (!recentKeys.includes(searchKey) && data.exists) {
                    recentKeys = [searchKey, ...recentKeys.slice(0, 4)];
                }
                successMessage = data.exists ? "Key found in Redis" : "Key not found in Redis";
            } else {
                errorMessage = data.error || "Failed to get value from Redis";
                searchResult = null;
            }
        } catch (error) {
            errorMessage = `Error: ${error.message}`;
            searchResult = null;
        } finally {
            isLoading = false;
        }
    }
    
    // Function to set a value in Redis
    async function setValue() {
        if (!keyInput) {
            errorMessage = "Please enter a key";
            return;
        }
        
        if (valueInput === undefined) {
            errorMessage = "Please enter a value";
            return;
        }
        
        isLoading = true;
        errorMessage = "";
        successMessage = "";
        
        try {
            const ttl = ttlInput ? parseInt(ttlInput) : undefined;
            
            const response = await fetch('/admin/debug/redis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: keyInput,
                    value: valueInput,
                    ttl: ttl
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                successMessage = `Successfully set key '${keyInput}' in Redis`;
                if (!recentKeys.includes(keyInput)) {
                    recentKeys = [keyInput, ...recentKeys.slice(0, 4)];
                }
                toast.success("Value set successfully", {
                    description: `Key: ${keyInput}, TTL: ${ttl || 'none'}`
                });
                // Clear inputs
                valueInput = "";
            } else {
                errorMessage = data.error || "Failed to set value in Redis";
                toast.error("Failed to set value", {
                    description: errorMessage
                });
            }
        } catch (error) {
            errorMessage = `Error: ${error.message}`;
            toast.error("Error", {
                description: errorMessage
            });
        } finally {
            isLoading = false;
        }
    }
    
    // Function to delete a key from Redis
    async function deleteKey(key: string) {
        isLoading = true;
        errorMessage = "";
        successMessage = "";
        
        try {
            const response = await fetch('/admin/debug/redis', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                successMessage = `Successfully deleted key '${key}' from Redis`;
                recentKeys = recentKeys.filter(k => k !== key);
                if (searchResult?.key === key) {
                    searchResult = null;
                }
                toast.success("Key deleted successfully", {
                    description: `Key: ${key}`
                });
            } else {
                errorMessage = data.error || "Failed to delete key from Redis";
                toast.error("Failed to delete key", {
                    description: errorMessage
                });
            }
        } catch (error) {
            errorMessage = `Error: ${error.message}`;
            toast.error("Error", {
                description: errorMessage
            });
        } finally {
            isLoading = false;
        }
    }
    
    // Function to select a recent key
    function selectRecentKey(key: string) {
        searchKey = key;
        getValue();
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <AdminCard
      title="Redis Operations"
      description="Interact with Redis for debugging purposes"
      icon={Database}
      compact={true}
    >
        <div class="space-y-6">
            <!-- Set Value Section -->
            <div class="space-y-4">
                <h3 class="text-lg font-medium">Set Value</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label for="key-input">Key</Label>
                        <Input id="key-input" bind:value={keyInput} placeholder="Enter key" />
                    </div>
                    <div>
                        <Label for="value-input">Value</Label>
                        <Input id="value-input" bind:value={valueInput} placeholder="Enter value" />
                    </div>
                    <div>
                        <Label for="ttl-input">TTL (seconds, optional)</Label>
                        <Input id="ttl-input" bind:value={ttlInput} placeholder="e.g. 3600" type="number" />
                    </div>
                </div>
                <Button on:click={setValue} disabled={isLoading}>
                    {#if isLoading}
                        <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                    {:else}
                        <Plus class="mr-2 h-4 w-4" />
                    {/if}
                    Set Value
                </Button>
            </div>
            
            <Separator />
            
            <!-- Get Value Section -->
            <div class="space-y-4">
                <h3 class="text-lg font-medium">Get Value</h3>
                <div class="flex space-x-4">
                    <div class="flex-1">
                        <Label for="search-key">Key</Label>
                        <Input id="search-key" bind:value={searchKey} placeholder="Enter key to search" />
                    </div>
                    <div class="flex items-end">
                        <Button on:click={getValue} disabled={isLoading} variant="outline">
                            {#if isLoading}
                                <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                            {:else}
                                <Search class="mr-2 h-4 w-4" />
                            {/if}
                            Get Value
                        </Button>
                    </div>
                </div>
                
                <!-- Recent Keys -->
                {#if recentKeys.length > 0}
                    <div class="flex flex-wrap gap-2">
                        <span class="text-sm text-muted-foreground">Recent keys:</span>
                        {#each recentKeys as key}
                            <Badge 
                                variant="outline" 
                                class="cursor-pointer hover:bg-muted" 
                                on:click={() => selectRecentKey(key)}
                            >
                                {key}
                            </Badge>
                        {/each}
                    </div>
                {/if}
                
                <!-- Search Result -->
                {#if isLoading}
                    <div class="space-y-2">
                        <Skeleton class="h-8 w-full" />
                        <Skeleton class="h-24 w-full" />
                    </div>
                {:else if searchResult}
                    <div class="p-4 border rounded-md space-y-2">
                        <div class="flex justify-between items-center">
                            <h4 class="font-medium">{searchResult.key}</h4>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                on:click={() => deleteKey(searchResult.key)}
                            >
                                <Trash class="h-4 w-4" />
                            </Button>
                        </div>
                        <div class="bg-muted p-2 rounded-md overflow-x-auto">
                            {#if searchResult.exists}
                                <pre class="text-sm">{searchResult.value}</pre>
                            {:else}
                                <p class="text-sm text-muted-foreground">Key does not exist</p>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
            
            <!-- Messages -->
            {#if errorMessage}
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            {/if}
            
            {#if successMessage}
                <Alert variant="default">
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            {/if}
        </div>
    </AdminCard>
</AdminPageLayout>
