<!--
  Role-Aware Device Detail Component
  
  This component demonstrates how to create a single component that adapts
  its UI based on the user's role and available features.
  
  Usage:
  <RoleAwareDeviceDetail 
    device={data.device}
    context={data.context}
    basePath={data.context.basePath}
  />
-->

<script lang="ts">
	import type { UnifiedRouteContext } from '$lib/server/routes/unifiedLoader';

	export let device: any;
	export let context: UnifiedRouteContext;
	export let basePath: string = '/user';

	// Derived properties based on context
	$: isAdmin = context.isAdmin;
	$: uiConfig = {
		showAccountInfo: context.features.includes('ui.includeAccountInfo'),
		showSimulator: context.features.includes('device.simulator'),
		showDebugPanel: context.features.includes('system.debugPanel'),
		showAdvancedDebug: context.features.includes('device.advancedDebug'),
		canManage: isAdmin || device.accountId === context.account?.id
	};
	
	// API paths based on version preference
	$: apiBasePath = '/api/v2';
	
	// Navigation paths
	$: deviceListPath = `${basePath}/iot/devices`;
	$: editPath = `${basePath}/iot/devices/${device.id}/edit`;
</script>

<div class="device-detail" class:admin-view={isAdmin}>
	<!-- Breadcrumb Navigation -->
	<nav class="breadcrumb">
		<a href={basePath}>
			{isAdmin ? 'Admin' : 'Dashboard'}
		</a>
		<span>/</span>
		<a href={deviceListPath}>Devices</a>
		<span>/</span>
		<span>{device.name || device.serialNumber}</span>
	</nav>

	<!-- Header with role-specific actions -->
	<header class="device-header">
		<div class="device-info">
			<h1>{device.name || 'Unnamed Device'}</h1>
			<p class="serial-number">{device.serialNumber}</p>
			
			{#if uiConfig.showAccountInfo && device.account}
				<p class="account-info">
					<span class="label">Account:</span>
					<span class="value">{device.account.name}</span>
				</p>
			{/if}
		</div>

		<div class="device-actions">
			<!-- Status indicator -->
			<div class="status" class:online={device.online}>
				{device.online ? 'Online' : 'Offline'}
			</div>

			<!-- Edit button (if user can manage) -->
			{#if uiConfig.canManage}
				<a href={editPath} class="btn btn-primary">
					Edit Device
				</a>
			{/if}

			<!-- Admin-only simulator -->
			{#if uiConfig.showSimulator}
				<a href={`${basePath}/iot/devices/${device.id}/simulator`} class="btn btn-secondary">
					🔧 Simulator
				</a>
			{/if}
		</div>
	</header>

	<!-- Main content -->
	<div class="device-content">
		<!-- Basic Information -->
		<section class="card">
			<h2>Basic Information</h2>
			<dl class="info-grid">
				<dt>Device ID:</dt>
				<dd><code>{device.id}</code></dd>
				
				<dt>Serial Number:</dt>
				<dd>{device.serialNumber}</dd>
				
				<dt>Model:</dt>
				<dd>{device.model || 'N/A'}</dd>
				
				<dt>OS Version:</dt>
				<dd>{device.osVersion || 'Unknown'}</dd>
				
				<dt>Last Seen:</dt>
				<dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}</dd>
			</dl>
		</section>

		<!-- Advanced Debug Panel (Admin only) -->
		{#if uiConfig.showDebugPanel}
			<section class="card debug-panel">
				<h2>🔍 Debug Information</h2>
				<details>
					<summary>Show Debug Data</summary>
					<pre><code>{JSON.stringify(device, null, 2)}</code></pre>
				</details>
				
				{#if uiConfig.showAdvancedDebug}
					<div class="debug-actions">
						<button class="btn btn-sm" on:click={() => console.log('Force sync device')}>
							Force Sync
						</button>
						<button class="btn btn-sm" on:click={() => console.log('Clear device cache')}>
							Clear Cache
						</button>
					</div>
				{/if}
			</section>
		{/if}

		<!-- Device Apps -->
		<section class="card">
			<h2>Installed Applications</h2>
			<div class="apps-list">
				{#if device.apps && device.apps.length > 0}
					{#each device.apps as app}
						<div class="app-item">
							<span class="app-name">{app.name}</span>
							<span class="app-version">{app.version}</span>
						</div>
					{/each}
				{:else}
					<p class="empty-state">No applications installed</p>
				{/if}
			</div>
		</section>

		<!-- Remote Access (if features enabled) -->
		<section class="card">
			<h2>Remote Access</h2>
			<div class="remote-access-actions">
				{#if context.features.includes('device.remoteTerminal')}
					<a href={`${basePath}/iot/devices/${device.id}/terminal`} class="btn btn-secondary">
						💻 Terminal
					</a>
				{/if}
				
				{#if context.features.includes('device.remoteDesktop')}
					<a href={`${basePath}/iot/devices/${device.id}/rdp`} class="btn btn-secondary">
						🖥️ Remote Desktop
					</a>
				{/if}
			</div>
		</section>
	</div>

	<!-- Footer with metadata -->
	<footer class="device-footer">
		<p class="metadata">
			Created: {new Date(device.createdAt).toLocaleString()}
			{#if device.updatedAt}
				• Updated: {new Date(device.updatedAt).toLocaleString()}
			{/if}
		</p>
		
		{#if isAdmin}
			<p class="admin-metadata">
				Request ID: <code>{context.requestId}</code>
			</p>
		{/if}
	</footer>
</div>

<style>
	.device-detail {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.admin-view {
		border-left: 4px solid #ff6b6b;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.breadcrumb a {
		color: #4a90e2;
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.device-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #e0e0e0;
	}

	.device-info h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
	}

	.serial-number {
		color: #666;
		font-family: monospace;
	}

	.account-info {
		margin-top: 0.5rem;
		font-size: 0.9rem;
	}

	.account-info .label {
		font-weight: 600;
		color: #666;
	}

	.device-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.status {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-weight: 600;
		background: #ff6b6b;
		color: white;
	}

	.status.online {
		background: #51cf66;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	.btn-primary {
		background: #4a90e2;
		color: white;
	}

	.btn-primary:hover {
		background: #357abd;
	}

	.btn-secondary {
		background: #f0f0f0;
		color: #333;
	}

	.btn-secondary:hover {
		background: #e0e0e0;
	}

	.btn-sm {
		padding: 0.25rem 0.75rem;
		font-size: 0.875rem;
	}

	.device-content {
		display: grid;
		gap: 1.5rem;
	}

	.card {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 150px 1fr;
		gap: 0.75rem;
		margin: 0;
	}

	.info-grid dt {
		font-weight: 600;
		color: #666;
	}

	.info-grid dd {
		margin: 0;
	}

	code {
		background: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.9em;
	}

	.debug-panel {
		background: #fff9e6;
		border-left: 4px solid #ffd43b;
	}

	.debug-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	pre {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 0.85rem;
	}

	.apps-list {
		display: grid;
		gap: 0.5rem;
	}

	.app-item {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.app-name {
		font-weight: 500;
	}

	.app-version {
		color: #666;
		font-size: 0.9rem;
	}

	.empty-state {
		color: #999;
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	.remote-access-actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.device-footer {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
		font-size: 0.85rem;
		color: #666;
	}

	.admin-metadata {
		margin-top: 0.5rem;
		color: #ff6b6b;
		font-family: monospace;
	}
</style>

