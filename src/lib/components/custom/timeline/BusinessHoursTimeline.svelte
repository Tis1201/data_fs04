<!-- A visual timeline component for business hours -->
<script lang="ts">
    import { Card } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { cn } from "$lib/utils";

    export let businessHours: Record<string, { open: string; close: string }>;

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const HOURS = Array.from({ length: 24 }, (_, i) => i);

    function timeToPixels(time: string): number {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return (hours + minutes / 60) * (100 / 24); // Convert to percentage
    }

    function formatHour(hour: number): string {
        return hour === 0 ? '12am' : 
               hour === 12 ? '12pm' : 
               hour < 12 ? `${hour}am` : 
               `${hour - 12}pm`;
    }

    function isOpen(hours: { open: string; close: string }): boolean {
        return hours && hours.open && hours.close;
    }

    function is24Hours(hours: { open: string; close: string }): boolean {
        return hours && hours.open === '00:00' && hours.close === '24:00';
    }

    function getBarStyles(hours: { open: string; close: string }) {
        return {
            background: 'var(--success-light)',
            borderColor: 'var(--success)',
        };
    }
</script>

<div class="space-y-6">
    <!-- Time markers -->
    <div class="relative h-8 border-b border-border">
        {#each HOURS as hour}
            <div 
                class="absolute -ml-3 text-xs text-muted-foreground"
                style="left: {(hour * 100 / 24)}%"
            >
                {formatHour(hour)}
            </div>
        {/each}
    </div>

    <!-- Timeline for each day -->
    {#each DAYS as day}
        <div class="relative h-16 group hover:bg-muted/50 rounded-lg transition-colors">
            <!-- Day label -->
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-32 pr-4">
                <span class="text-sm font-medium">{day}</span>
            </div>

            <!-- Timeline background -->
            <div class="absolute left-32 right-4 h-full flex items-center">
                <!-- Hour markers -->
                <div class="absolute inset-0 flex">
                    {#each HOURS as hour}
                        <div 
                            class={cn(
                                "flex-1 border-l",
                                hour % 6 === 0 ? "border-border" : "border-border/30"
                            )}
                        />
                    {/each}
                </div>

                <!-- Business hours bar -->
                {#if isOpen(businessHours[day])}
                    <div 
                        class="absolute h-8 rounded-lg border transition-all duration-200 group-hover:h-10"
                        style={`
                            left: ${timeToPixels(businessHours[day].open)}%; 
                            width: ${timeToPixels(businessHours[day].close) - timeToPixels(businessHours[day].open)}%;
                            ${Object.entries(getBarStyles(businessHours[day])).map(([key, value]) => `${key}: ${value}`).join(';')}
                        `}
                    >
                        <!-- Opening time label -->
                        <div class="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-full">
                            <Badge variant="outline" class="bg-background text-xs">
                                {businessHours[day].open}
                            </Badge>
                        </div>

                        <!-- Closing time label -->
                        <div class="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full">
                            <Badge variant="outline" class="bg-background text-xs">
                                {businessHours[day].close}
                            </Badge>
                        </div>

                        <!-- Hours range on hover -->
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Badge variant="secondary" class="bg-background/95">
                                {is24Hours(businessHours[day]) ? '24 Hours' : `${businessHours[day].open} - ${businessHours[day].close}`}
                            </Badge>
                        </div>
                    </div>
                {:else}
                    <div class="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2">
                        <Badge variant="outline" class="bg-background text-muted-foreground">
                            Closed
                        </Badge>
                    </div>
                {/if}
            </div>
        </div>
    {/each}

    <!-- Legend -->
    <div class="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
        <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded" style="background: var(--success-light); border: 1px solid var(--success)" />
            <span>Operating Hours</span>
        </div>
        <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-background border border-border" />
            <span>Closed</span>
        </div>
    </div>
</div>
