<script lang="ts">
	import AdminPageLayout from '$lib/components/admin/layout/AdminPageLayout.svelte';
	import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { BarChart3, Copy, AlertCircle, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

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

	async function loadToken() {
		loading = true;
		try {
			const resp = await fetch('/admin/debug/dashboard/superset');
			const result = await resp.json();

			if (!resp.ok) {
				error = result.error;
				toast.error('Failed to generate token');
			} else {
				data.guestToken = result.token;
				data.iframeUrl = result.iframeUrl;
				error = null;
				toast.success('Token generated successfully');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			toast.error('Failed to generate token');
		} finally {
			loading = false;
		}
	}

	function copyToClipboard(text: string, label: string) {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	}

	// Auto-load token on mount
	import { onMount } from 'svelte';
	onMount(() => {
		loadToken();
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
					<iframe
						src={data.iframeUrl}
						title="Superset Dashboard"
						class="w-full h-screen border-0"
						allow="fullscreen"
						sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
					/>
				</div>
			{/if}
		</div>
	</AdminCard>
</AdminPageLayout>
