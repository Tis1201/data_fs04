<script lang="ts">
    import { getContext } from 'svelte';
    import { cn } from '$lib/utils';
    import { CheckCircle } from 'lucide-svelte';
    
    export let value: number;
    
    const { activeStep, size } = getContext('steps');
    
    $: isActive = $activeStep === value;
    $: isCompleted = $activeStep > value;
    $: isSmall = size === 'sm';
</script>

<div class={cn(
    "flex items-center gap-2 border-b-2 transition-colors",
    isActive ? "border-primary text-primary font-medium" : 
    isCompleted ? "border-primary/50 text-primary/70" : "border-muted text-muted-foreground",
    "flex-1 pb-2"
)}>
    <div class={cn(
        "flex items-center justify-center rounded-full border transition-colors",
        isActive ? "border-primary bg-primary text-primary-foreground" : 
        isCompleted ? "border-primary/50 bg-primary/50 text-primary-foreground" : "border-muted bg-background",
        isSmall ? "h-5 w-5 text-xs" : "h-8 w-8 text-sm"
    )}>
        {#if isCompleted}
            <CheckCircle class={isSmall ? "h-3 w-3" : "h-4 w-4"} />
        {:else}
            {value}
        {/if}
    </div>
    <span class={cn(
        isSmall ? "text-xs" : "text-sm"
    )}>
        <slot />
    </span>
</div>
