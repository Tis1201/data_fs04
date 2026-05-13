<script lang="ts">
    import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    import { Badge } from '$lib/components/ui/badge';
    import { BarChart3, Copy, AlertCircle, Loader2 } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';
    import { onMount, tick } from 'svelte';
    import { browser } from '$app/environment';

    export let data;

    const title = 'Superset Dashboard Embed';
    const pageCrumbs = [
        ['Admin', '/admin/dashboard'],
        ['Debug'],
        ['Dashboard'],
        ['Superset']
    ] as [string, string][];

    let error: string | null = null;
    let loading = false;
    let supersetContainer: HTMLDivElement | null = null;
    let embedInstance: { unmount?: () => void } | null = null;
    let initialTokenFetched = false;
    let iframeObserver: MutationObserver | null = null;

    const fetchGuestToken = async () => {
        const isInitial = !initialTokenFetched;
        if (isInitial) {
            loading = true;
        }

        try {
            const resp = await fetch('/admin/debug/dashboard/superset');
            const result = await resp.json();

            if (!resp.ok) {
                const message = result?.error ?? 'Failed to generate token';
                error = message;
                throw new Error(message);
            }

            data.guestToken = result.token;
            data.iframeUrl = result.iframeUrl;
            error = null;

            if (isInitial) {
                toast.success('Token generated successfully');
                initialTokenFetched = true;
            }

            return result.token as string;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            error = message;
            toast.error('Failed to generate token');
            throw err;
        } finally {
            if (isInitial) {
                loading = false;
            }
        }
    };

    function copyToClipboard(text: string, label: string) {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    }

    onMount(() => {
        if (!browser) {
            return;
        }
        let cancelled = false;

        const initialize = async () => {
            try {
                await fetchGuestToken();

                if (!supersetContainer) {
                    await tick();
                }

                const mountPoint = supersetContainer;

                if (!mountPoint) {
                    throw new Error('Superset container not ready');
                }

                mountPoint.style.width = '100%';
                mountPoint.style.minHeight = '80vh';
                mountPoint.style.height = '80vh';

                const applyIframeSizing = () => {
                    const iframe = mountPoint.querySelector('iframe');
                    if (iframe) {
                        iframe.style.width = '100%';
                        iframe.style.height = '100%';
                        iframe.style.border = '0';
                    }
                };

                applyIframeSizing();

                iframeObserver?.disconnect();
                iframeObserver = new MutationObserver(applyIframeSizing);
                iframeObserver.observe(mountPoint, { childList: true, subtree: true });

                const { embedDashboard } = await import('@superset-ui/embedded-sdk');

                embedInstance = await embedDashboard({
                    id: data.dashboardId,
                    supersetDomain: data.supersetUrl,
                    mountPoint,
                    fetchGuestToken,
                    dashboardUiConfig: {
                        hideTitle: true
                    },
                    iframeSandboxExtras: ['allow-popups-to-escape-sandbox'],
                    debug: true
                });

                if (!cancelled) {
                    toast.success('Dashboard loaded');
                }
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : 'Failed to load dashboard';
                error = message;
                toast.error(message);
            }
        };

        initialize();

        return () => {
            cancelled = true;
            embedInstance?.unmount?.();
            iframeObserver?.disconnect();
            iframeObserver = null;
        };
    });
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <AdminCard
        title="Embedded Dashboard"
        description="Superset dashboard embedded via guest token"
        icon={BarChart3}
        compact={true}
    >
        <div class="space-y-6">
            {#if loading}
                <div class="flex items-center justify-center py-8">
                    <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
                    <span class="ml-2 text-sm text-muted-foreground">Generating token...</span>
                </div>
            {/if}

            {#if error && !loading}
                <Alert variant="destructive">
                    <AlertCircle class="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            {/if}

            {#if data.guestToken && !loading}
                <!-- Token Info -->
                <Card class="w-full bg-muted/50">
                    <CardHeader>
                        <CardTitle class="text-base">Guest Token</CardTitle>
                        <CardDescription>Auto-generated for this session</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <code class="text-xs bg-background p-2 rounded flex-1 overflow-x-auto break-all">
                                {data.guestToken.substring(0, 50)}...
                            </code>
                            <button
                                on:click={() => copyToClipboard(data.guestToken, 'Token')}
                                class="p-2 hover:bg-background rounded transition"
                                title="Copy token"
                            >
                                <Copy class="h-4 w-4" />
                            </button>
                        </div>
                        <div class="text-xs text-muted-foreground">
                            <Badge variant="outline">Expires in ~5 minutes</Badge>
                        </div>
                    </CardContent>
                </Card>

                <!-- Iframe URL Info -->
                <Card class="w-full bg-muted/50">
                    <CardHeader>
                        <CardTitle class="text-base">Iframe URL</CardTitle>
                        <CardDescription>Direct link to embedded dashboard</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <code class="text-xs bg-background p-2 rounded flex-1 overflow-x-auto break-all">
                                {data.iframeUrl.substring(0, 80)}...
                            </code>
                            <button
                                on:click={() => copyToClipboard(data.iframeUrl, 'URL')}
                                class="p-2 hover:bg-background rounded transition"
                                title="Copy URL"
                            >
                                <Copy class="h-4 w-4" />
                            </button>
                        </div>
                    </CardContent>
                </Card>

                <!-- Alert -->
                <Alert>
                    <AlertDescription>
                        The embedded dashboard loads below. If you see a blank iframe, check that the guest token is valid and the dashboard ID is correct.
                    </AlertDescription>
                </Alert>

                <!-- Embedded Dashboard -->
                <div class="border rounded-lg overflow-hidden bg-white">
                    <div
                        bind:this={supersetContainer}
                        class="w-full h-screen border-0"
                    />
                </div>
            {/if}
        </div>
    </AdminCard>
</AdminPageLayout>
