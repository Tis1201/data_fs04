<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { 
		initWebRTCClient, 
		createPeerConnection, 
		createDataChannel,
		createAndSendOffer,
		sendDataChannelMessage,
		webrtcStatus, 
		webrtcEvents,
		clearEvents
	} from '$lib/utils/webrtc/webrtc-client';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Textarea } from '$lib/components/ui/textarea';
	import { socketStore } from '$lib/stores/socket-store';
	import { get } from 'svelte/store';

	let message = '';
	let cleanup: (() => void) | undefined;
	let connectionStatus = '';
	let dataChannelStatus = '';
	let socketStatus = '';

	// Subscribe to the WebRTC status
	$: {
		connectionStatus = $webrtcStatus.peerConnection 
			? `Peer Connection: ${$webrtcStatus.peerConnection.connectionState || 'unknown'}`
			: 'No Peer Connection';
		
		dataChannelStatus = $webrtcStatus.dataChannel 
			? `Data Channel (${$webrtcStatus.dataChannel.label}): ${$webrtcStatus.dataChannelState}`
			: 'No Data Channel';
		
		socketStatus = $socketStore.status === 'OPEN' 
			? 'Socket: Connected' 
			: `Socket: ${$socketStore.status}`;
	}

	// Get a filtered list of the latest events
	$: filteredEvents = $webrtcEvents
		.filter(event => event.type === 'data-channel-message' || event.type === 'data-channel-open' || event.type === 'data-channel-close')
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, 20);

	// Initialize the WebRTC client on mount
	onMount(() => {
		cleanup = initWebRTCClient();
		return cleanup;
	});

	onDestroy(() => {
		if (cleanup) cleanup();
	});

	// Connect to WebRTC
	async function connect() {
		// Create a peer connection
		const peerConnection = createPeerConnection();
		if (!peerConnection) {
			console.error('Failed to create peer connection');
			return;
		}

		// Create and send an offer
		const success = await createAndSendOffer();
		if (!success) {
			console.error('Failed to create and send offer');
		}
	}

	// Send a message through the data channel
	function sendMessage() {
		if (!message.trim()) return;

		const success = sendDataChannelMessage({
			text: message,
			timestamp: new Date().toISOString()
		});

		if (success) {
			message = '';
		}
	}

	// Format timestamp
	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}

	// Format message data for display
	function formatMessageData(data: any): string {
		if (!data) return 'No data';
		
		if (typeof data === 'string') {
			return data;
		}
		
		if (data.text) {
			return data.text;
		}
		
		return JSON.stringify(data, null, 2);
	}
</script>

<svelte:head>
	<title>WebRTC Data Channel Test</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-4xl">
	<h1 class="text-2xl font-bold mb-4">WebRTC Data Channel Test</h1>
	
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
		<Card>
			<CardHeader>
				<CardTitle>Connection Status</CardTitle>
				<CardDescription>WebRTC and WebSocket connection status</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-2">
					<div>
						<Badge variant={$socketStore.status === 'OPEN' ? 'default' : 'destructive'}>
							{socketStatus}
						</Badge>
					</div>
					<div>
						<Badge variant={$webrtcStatus.peerConnection ? 'default' : 'outline'}>
							{connectionStatus}
						</Badge>
					</div>
					<div>
						<Badge variant={$webrtcStatus.dataChannelState === 'open' ? 'default' : 'secondary'}>
							{dataChannelStatus}
						</Badge>
					</div>
				</div>
			</CardContent>
			<CardFooter class="flex justify-between">
				<Button on:click={connect} disabled={!$socketStore.connected}>
					Connect
				</Button>
				<Button variant="outline" on:click={() => clearEvents()}>
					Clear Events
				</Button>
			</CardFooter>
		</Card>
		
		<Card>
			<CardHeader>
				<CardTitle>Send Message</CardTitle>
				<CardDescription>Send a message through the data channel</CardDescription>
			</CardHeader>
			<CardContent>
				<form on:submit|preventDefault={sendMessage} class="space-y-2">
					<Textarea 
						bind:value={message} 
						placeholder="Type your message here..." 
						rows="3"
						disabled={$webrtcStatus.dataChannelState !== 'open'} 
					/>
				</form>
			</CardContent>
			<CardFooter>
				<Button 
					on:click={sendMessage} 
					disabled={$webrtcStatus.dataChannelState !== 'open' || !message.trim()}
					class="w-full"
				>
					Send Message
				</Button>
			</CardFooter>
		</Card>
	</div>
	
	<Card>
		<CardHeader>
			<CardTitle>Data Channel Events</CardTitle>
			<CardDescription>Latest data channel events</CardDescription>
		</CardHeader>
		<CardContent>
			{#if filteredEvents.length === 0}
				<Alert>
					<AlertDescription>No data channel events yet. Connect and send a message to see events here.</AlertDescription>
				</Alert>
			{:else}
				<div class="space-y-2">
					{#each filteredEvents as event}
						<div class="border p-2 rounded-md">
							<div class="flex justify-between items-start">
								<Badge variant={event.source === 'local' ? 'outline' : 'default'}>
									{event.type}
								</Badge>
								<span class="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
							</div>
							<Separator class="my-2" />
							{#if event.type === 'data-channel-message'}
								<div class="whitespace-pre-wrap text-sm">
									{formatMessageData(event.data.data)}
								</div>
							{:else}
								<div class="text-sm">
									{event.type === 'data-channel-open' ? 'Channel opened' : 'Channel closed'}
									{#if event.data.label}
										: {event.data.label}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
