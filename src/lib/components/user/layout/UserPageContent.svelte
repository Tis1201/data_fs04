<script lang="ts">
    // Props for the content layout
    export let spacing: string = "space-y-4";
    export let className: string = "";
</script>

<div class="flex flex-col {spacing} {className}">
    <slot />
</div>
