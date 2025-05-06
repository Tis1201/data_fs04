<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ArrowLeft, Terminal as TerminalIcon } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	export let data;
	
	let terminal: Terminal;
	let terminalReady = false;
	let mounted = false;
	let deviceId = $page.params.id;
	let connectionStatus = 'disconnected';
	
	// Terminal options following documentation
	let options: ITerminalOptions & ITerminalInitOnlyOptions = {
		cursorBlink: true,
		fontFamily: 'monospace',
		fontSize: 14,
		lineHeight: 1.2,
		theme: {
			background: '#1e1e1e',
			foreground: '#f8f8f8',
			cursor: '#ffffff'
		}
	};

	async function onLoad() {
		if (!browser) return;
		
		console.log('Terminal component loaded');
		
		// Load FitAddon to make terminal responsive
		const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		terminal.loadAddon(fitAddon);
		
		// Initial fit
		setTimeout(() => {
			fitAddon.fit();
		}, 100);
		
		terminalReady = true;
		
		// Initial welcome message
		terminal.write('\r\n\x1b[1;34m=== Device Terminal ===\x1b[0m\r\n');
		terminal.write(`\r\nConnecting to device: ${deviceId}...\r\n`);
		
		// Setup connection to device
		setupDeviceConnection();
		
		// Set up window resize handler
		if (browser) {
			window.addEventListener('resize', () => {
				fitAddon.fit();
			});
		}
	}

	function onData(data: string) {
		// Send data to device
		if (connectionStatus === 'connected') {
			sendCommandToDevice(data);
		}
	}
	
	function onKey(data: { key: string; domEvent: KeyboardEvent }) {
		// Optional: Handle special key combinations
		console.log('Key pressed:', data.key);
	}

	function setupDeviceConnection() {
		// This would be replaced with actual device connection logic
		// For now, we'll simulate a connection
		
		setTimeout(() => {
			connectionStatus = 'connected';
			terminal.write('\r\n\x1b[1;32mConnection established!\x1b[0m\r\n\r\n');
		}, 1500);
	}

	function sendCommandToDevice(command: string) {
		// This would be replaced with actual command sending logic
		// For now, we'll just echo the command
		
		// Simulate device response
		setTimeout(() => {
			if (command.trim() === 'help') {
				terminal.write('\r\nAvailable commands:\r\n');
				terminal.write('  help     - Show this help message\r\n');
				terminal.write('  info     - Show device information\r\n');
				terminal.write('  status   - Show device status\r\n');
				terminal.write('  clear    - Clear the terminal\r\n');
				terminal.write('  exit     - Disconnect from device\r\n');
			} else if (command.trim() === 'info') {
				terminal.write('\r\nDevice Information:\r\n');
				terminal.write(`  ID: ${deviceId}\r\n`);
				terminal.write('  Type: IoT Device\r\n');
				terminal.write('  Firmware: v1.0.0\r\n');
			} else if (command.trim() === 'status') {
				terminal.write('\r\nDevice Status:\r\n');
				terminal.write('  Status: Online\r\n');
				terminal.write('  Uptime: 3d 5h 12m\r\n');
				terminal.write('  CPU: 12%\r\n');
				terminal.write('  Memory: 34%\r\n');
			} else if (command.trim() === 'clear') {
				terminal.clear();
			} else if (command.trim() === 'exit') {
				connectionStatus = 'disconnected';
				terminal.write('\r\n\x1b[1;31mDisconnected from device.\x1b[0m\r\n');
			} else {
				terminal.write(`\r\nUnknown command: ${command.trim()}\r\n`);
				terminal.write('Type "help" for available commands\r\n');
			}
		}, 300);
	}

	// Resize handling is now done in the onLoad function

	function goBack() {
		goto(`/admin/iot/devices/${deviceId}`);
	}

	onMount(() => {
		if (browser) {
			mounted = true;
		}
	});

	onDestroy(() => {
		// Clean up any connections if needed
		if (connectionStatus === 'connected') {
			// Change connection status to disconnected
			connectionStatus = 'disconnected';
			
			// Clean up any event listeners
			if (browser) {
				window.removeEventListener('resize', () => {});
			}
		}
	});
</script>

<svelte:head>
	<title>Device Terminal - {deviceId}</title>
</svelte:head>

<div class="container mx-auto py-4 space-y-4">
	<!-- Breadcrumb Navigation -->
	<div class="flex items-center gap-2 mb-2">
		<a href="/admin" class="text-muted-foreground hover:text-foreground">Admin</a>
		<span class="text-muted-foreground">/</span>
		<a href="/admin/iot" class="text-muted-foreground hover:text-foreground">IoT</a>
		<span class="text-muted-foreground">/</span>
		<a href="/admin/iot/devices" class="text-muted-foreground hover:text-foreground">Devices</a>
		<span class="text-muted-foreground">/</span>
		<a href="/admin/iot/devices/{deviceId}" class="text-muted-foreground hover:text-foreground">{data?.device?.name || deviceId}</a>
	</div>

	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button variant="outline" size="icon" on:click={goBack}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<TerminalIcon class="h-5 w-5" />
				Device Terminal
			</h1>
		</div>
		
		<div class="flex items-center gap-2">
			<Badge variant="outline" class="{connectionStatus === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
				{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
			</Badge>
		</div>
	</div>

	<!-- Terminal Card -->
	<div class="border rounded-lg p-4">
		<div class="mb-4">
			<h2 class="text-lg font-semibold mb-1">Terminal Session</h2>
			<p class="text-sm text-muted-foreground">Connected to device: {data?.device?.name || deviceId}</p>
		</div>
		
		{#if !terminalReady}
			<div class="space-y-4">
				<Skeleton class="h-8 w-full" />
				<Skeleton class="h-4 w-3/4" />
				<Skeleton class="h-4 w-1/2" />
			</div>
		{:else}
			<div class="terminal-container h-[500px] w-full border rounded-md overflow-hidden">
				{#if browser && mounted}
					<Xterm 
						bind:terminal={terminal} 
						options={options} 
						onLoad={onLoad} 
						onData={onData}
						onKey={onKey} 
					/>
				{:else}
					<div class="flex items-center justify-center h-full bg-muted">
						<p class="text-muted-foreground">Terminal loading...</p>
					</div>
				{/if}
			</div>
		{/if}
		
		<div class="flex justify-between mt-4 text-sm text-muted-foreground">
			<div>
				Type "help" for available commands
			</div>
			<div>
				Device ID: {deviceId}
			</div>
		</div>
	</div>
</div>

<style>
	:global(.terminal-container .xterm) {
		height: 100%;
		width: 100%;
		padding: 0.5rem;
	}
</style>
