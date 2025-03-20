<script lang="ts">
    export let status: 'disconnected' | 'connecting' | 'connected' | 'authenticated' = 'disconnected';
</script>

<div class="flex items-center justify-between px-4 py-2 bg-muted rounded-lg">
    <span class="text-sm font-medium">Connection Status:</span>
    <div class="flex items-center gap-2">
        <div class={`w-2 h-2 rounded-full ${
            status === 'authenticated' ? "bg-green-500" : 
            status === 'connected' ? "bg-blue-500" :
            status === 'connecting' ? "bg-yellow-500" : "bg-red-500"
        } animate-pulse`}></div>
        <span class="text-sm">
            {#if status === 'authenticated'}
                Authenticated
            {:else if status === 'connected'}
                Connected
            {:else if status === 'connecting'}
                Connecting...
            {:else}
                Disconnected
            {/if}
        </span>
    </div>
</div>
