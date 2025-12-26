<script lang="ts">
    import { onMount } from "svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import { PUBLIC_VANNA_API_URL } from "$env/static/public";

    const vannaApiBase = PUBLIC_VANNA_API_URL || "http://localhost:8000";

    onMount(() => {
        const script = document.createElement("script");
        script.type = "module";
        // Load custom styled component from local Vanna server
        script.src = `${vannaApiBase}/static/vanna-components.js`;
        document.head.appendChild(script);

        return () => {
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
        };
    });
</script>

<UserPageLayout
    crumbs={[
        ["Analytics", "#"],
        ["Ask AI", ""],
    ]}
>
    <div class="chat-wrapper">
        <vanna-chat
            title="FS Analytics"
            subtitle="Ask questions about your sensor data in plain English"
            placeholder="Ask about devices, sensors, or usage patterns..."
            api-base={vannaApiBase}
            sse-endpoint={`${vannaApiBase}/api/vanna/v2/chat_sse`}
            ws-endpoint={`${vannaApiBase}/api/vanna/v2/chat_websocket`}
            poll-endpoint={`${vannaApiBase}/api/vanna/v2/chat_poll`}
        />
    </div>
</UserPageLayout>

<style>
    .chat-wrapper {
        width: 100%;
        height: calc(100vh - 100px);
        min-height: 600px;
    }

    .chat-wrapper :global(vanna-chat) {
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        border: none;
        border-radius: 0.5rem;
        overflow: hidden;
    }
</style>
