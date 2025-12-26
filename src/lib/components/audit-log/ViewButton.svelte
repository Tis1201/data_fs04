<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    
    export let record: any;
    export let onView: (() => void) | undefined = undefined;
    
    function handleClick() {
        if (onView) {
            onView();
        }
    }
</script>

<Button variant="ghost" size="sm" on:click={handleClick}>
    View
</Button>

