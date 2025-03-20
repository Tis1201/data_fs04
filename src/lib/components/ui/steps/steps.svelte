<script lang="ts">
    import { setContext } from 'svelte';
    import { writable } from 'svelte/store';
    import { cn } from '$lib/utils';
    
    export let value: number = 1;
    export let size: 'sm' | 'default' = 'default';
    
    const activeStep = writable(value);
    
    // Update active step when value changes
    $: activeStep.set(value);
    
    // Set context for child Step components
    setContext('steps', {
        activeStep,
        size
    });
</script>

<div class={cn(
    "flex w-full gap-2",
    size === 'sm' ? 'pb-2' : 'pb-4'
)}>
    <slot />
</div>
