<script lang="ts">
    import { Badge, Tooltip } from "$lib/design-system/components";
    import type { BadgeColor } from "$lib/design-system/components";

    export let cpuUsage: number | null = null;
    export let memUsage: number | null = null;
    export let diskUsage: number | null = null;

    // Get badge color based on usage value
    // Aligned with dashboard: Green (<60%), Warning (60-79%), Error (>=80%)
    // When no data available, show green (assumed healthy)
    function getUsageColor(value: number | null): BadgeColor {
        if (value === null || value === undefined) {
            return "success"; // Default to green when no data (assumed healthy)
        }
        if (value < 60) {
            return "success"; // green - healthy
        }
        if (value < 80) {
            return "warning"; // yellow/orange - warning
        }
        return "error"; // red - critical
    }

    function formatPercent(value: number | null): string {
        if (value === null || value === undefined) return "N/A";
        return `${Math.round(value)}%`;
    }

    $: cpuColor = getUsageColor(cpuUsage);
    $: memColor = getUsageColor(memUsage);
    $: diskColor = getUsageColor(diskUsage);
</script>

<div class="flex items-center gap-2">
    <!-- CPU Badge -->
    <Tooltip text="CPU: {formatPercent(cpuUsage)}" theme="dark" position="top">
        <Badge label="CPU" color={cpuColor} size="sm" showDot />
    </Tooltip>

    <!-- MEM Badge -->
    <Tooltip text="MEM: {formatPercent(memUsage)}" theme="dark" position="top">
        <Badge label="MEM" color={memColor} size="sm" showDot />
    </Tooltip>

    <!-- DSK Badge -->
    <Tooltip text="DSK: {formatPercent(diskUsage)}" theme="dark" position="top">
        <Badge label="DSK" color={diskColor} size="sm" showDot />
    </Tooltip>
</div>
