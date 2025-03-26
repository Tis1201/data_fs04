<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import RecordDetailsSheet from "$lib/components/ui_components_sveltekit/sheet/RecordDetailsSheet.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import type { Session } from "@prisma/client";

    // Define a type for Session with included User data
    type SessionWithUser = Session & {
        user: {
            id: string;
            email: string;
            name: string | null;
            status: string;
            systemRole: string;
        };
    };

    export let isOpen: Writable<boolean> = writable(false);
    export let session: Writable<SessionWithUser | null> = writable(null);
</script>

<RecordDetailsSheet 
    open={isOpen} 
    record={$session} 
    title="Session Details" 
    description="Detailed information about the selected session"
    size="md"
>
    <svelte:fragment slot="content" let:record>
        <div class="py-4 space-y-6">
            <!-- Session ID Section -->
            <div class="border rounded-md p-4 bg-muted/30">
                <h3 class="text-sm text-muted-foreground mb-1">Session Identifier</h3>
                <div class="font-mono text-xs bg-background p-2 rounded border overflow-x-auto">
                    {record.id}
                </div>
            </div>
            
            <!-- User Information -->
            <div class="border rounded-md p-4">
                <h3 class="text-sm font-medium mb-3">User Information</h3>
                <div class="grid gap-3">
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">Email</div>
                        <div class="font-medium">{record.user?.email || 'N/A'}</div>
                    </div>
                    
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">Name</div>
                        <div>{record.user?.name || 'N/A'}</div>
                    </div>
                    
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">Role</div>
                        <div>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {record.user?.systemRole || 'N/A'}
                            </span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">Status</div>
                        <div>
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400">
                                {record.user?.status || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Session Timing -->
            <div class="border rounded-md p-4">
                <h3 class="text-sm font-medium mb-3">Session Timing</h3>
                <div class="grid gap-3">
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">Created</div>
                        <div>
                            <RelativeDate 
                                date={record.createdAt} 
                                format="relative" 
                                showTooltip={true} 
                                useHoverCard={false} 
                            />
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">Expires</div>
                        <div>
                            <RelativeDate 
                                date={record.expiresAt} 
                                format="relative" 
                                showTooltip={true} 
                                useHoverCard={false} 
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Connection Details -->
            <!-- <div class="border rounded-md p-4">
                <h3 class="text-sm font-medium mb-3">Connection Details</h3>
                <div class="grid gap-3">
                    <div class="grid grid-cols-[120px_1fr] items-center gap-2">
                        <div class="text-sm text-muted-foreground">IP Address</div>
                        <div class="font-mono text-xs">{record.ipAddress || 'N/A'}</div>
                    </div>
                    
                    <div class="grid grid-cols-[120px_1fr] gap-2">
                        <div class="text-sm text-muted-foreground">User Agent</div>
                        <div class="text-xs break-all">{record.userAgent || 'N/A'}</div>
                    </div>
                </div>
            </div> -->
        </div>
    </svelte:fragment>
</RecordDetailsSheet>
