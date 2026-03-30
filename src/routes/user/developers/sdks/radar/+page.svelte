<script lang="ts">
	import {
		ArrowLeft,
		Download,
		ExternalLink,
		CheckCircle2,
		Radio,
		AlertCircle,
		ChevronDown,
		ChevronUp,
		Package,
		Loader2
	} from 'lucide-svelte';
	import DevBadge from '$lib/components/developers/DevBadge.svelte';
	import DevCodeBlock from '$lib/components/developers/DevCodeBlock.svelte';
	import {
		radarRequirements,
		radarCapabilities,
		radarCodeExamples,
		radarDetectionEventJson,
		radarSessionEventJson,
		type RadarTabId,
		type CppSubTab
	} from '$lib/content/developers/radarSdkDoc';
	import type { PageData } from './$types';
	import { downloadResource } from '$lib/utils/download';
	import { toast } from '$lib/stores/alertToast';

	export let data: PageData;

	let showConfigRef = false;
	let showEventsRef = false;
	let activeTab: RadarTabId = 'cpp';
	let cppSub: CppSubTab = 'quickstart';
	/** Row currently fetching signed URL + blob (only that button shows loading). */
	let downloadingResourceId: string | null = null;

	const mainTabs: { id: RadarTabId; label: string }[] = [
		{ id: 'cpp', label: 'C++' },
		{ id: 'nodejs', label: 'Node.js' },
		{ id: 'android', label: 'Android (Java)' }
	];

	const cppSubTabs: { id: CppSubTab; label: string }[] = [
		{ id: 'structure', label: 'SDK Structure' },
		{ id: 'quickstart', label: 'Quick Start' },
		{ id: 'compile', label: 'Compile' }
	];

	const quickSetupLang: Record<Exclude<RadarTabId, 'cpp'>, string> = {
		nodejs: 'bash',
		android: 'java'
	};

	const quickCodeLang: Record<Exclude<RadarTabId, 'cpp'>, string> = {
		nodejs: 'javascript',
		android: 'java'
	};

	async function downloadCatalogSdk(resourceId: string, fileName: string) {
		downloadingResourceId = resourceId;
		try {
			await downloadResource(resourceId, fileName);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Download failed');
		} finally {
			downloadingResourceId = null;
		}
	}

	function cppPanelBlock(): { code: string; language: string } {
		const ex = radarCodeExamples.cpp;
		if (cppSub === 'structure') return { code: ex.setup, language: 'bash' };
		if (cppSub === 'compile') return { code: ex.compile ?? '', language: 'bash' };
		return { code: ex.code, language: 'cpp' };
	}

	$: cppBlock = activeTab === 'cpp' ? cppPanelBlock() : { code: '', language: 'javascript' };
</script>

<div class="min-h-full bg-[#F9FAFB]">
	<div class="mx-auto max-w-5xl p-6">
		<a
			href="/user/developers/sdks"
			class="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
		>
			<ArrowLeft size={14} />
			Back to SDKs
		</a>

		<!-- Hero -->
		<div
			class="mb-6 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-6 shadow-card"
		>
			<div class="flex items-start gap-4">
				<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
					<Radio size={26} />
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-3">
						<h1 class="text-xl font-bold text-gray-900">Radar SDK</h1>
						<DevBadge variant="blue">v1.0.0</DevBadge>
						<DevBadge variant="green">Stable</DevBadge>
					</div>
					<p class="mt-0.5 text-sm font-medium text-gray-500">Real-Time Edge Integration</p>
					<p class="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
						The Data Realities Radar SDK enables direct integration of radar-based presence detection, motion
						tracking, and dwell analytics into your application. Designed for low-latency edge processing, the SDK
						provides an event-driven API for real-time object tracking, session logging, and path analytics — all
						processed on-device with no cloud dependency.
					</p>
				</div>
			</div>
		</div>

		<!-- System Requirements -->
		<div class="mb-6">
			<h2 class="mb-3 text-sm font-semibold text-gray-900">System Requirements</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{#each radarRequirements as req}
					{#if req.comingSoon}
						<div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 opacity-70">
							<div class="mb-3 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="flex h-7 w-7 items-center justify-center rounded-lg {req.bg} opacity-60">
										<svelte:component this={req.icon} size={14} class={req.color} />
									</div>
									<h3 class="text-xs font-semibold text-gray-500">{req.lang}</h3>
								</div>
								<span
									class="inline-block rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
								>
									Coming Soon
								</span>
							</div>
							<dl class="space-y-1.5">
								{#each req.items as item}
									<div class="flex flex-col gap-0.5">
										<dt class="text-[10px] font-semibold uppercase tracking-wide text-gray-300">{item.label}</dt>
										<dd class="text-[11.5px] text-gray-400">{item.value}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{:else}
						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-card">
							<div class="mb-3 flex items-center gap-2">
								<div class="flex h-7 w-7 items-center justify-center rounded-lg {req.bg}">
									<svelte:component this={req.icon} size={14} class={req.color} />
								</div>
								<h3 class="text-xs font-semibold text-gray-700">{req.lang}</h3>
							</div>
							<dl class="space-y-1.5">
								{#each req.items as item}
									<div class="flex flex-col gap-0.5">
										<dt class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</dt>
										<dd class="text-[11.5px] leading-snug text-gray-600">{item.value}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Capabilities -->
		<div class="mb-6 rounded-lg border border-gray-200 bg-white shadow-card">
			<div class="border-b border-gray-100 px-5 py-3.5">
				<h3 class="text-sm font-semibold text-gray-900">Capabilities</h3>
			</div>
			<div class="divide-y divide-gray-50">
				{#each radarCapabilities as cap}
					<div class="flex items-start gap-3 px-5 py-3.5">
						<CheckCircle2 size={15} class="mt-0.5 shrink-0 text-green-500" />
						<div>
							<span class="text-sm font-medium text-gray-800">{cap.label}</span>
							<p class="mt-0.5 text-xs text-gray-500">{cap.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Quick Start -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
			<div class="border-b border-gray-100 px-5 py-3.5">
				<h3 class="text-sm font-semibold text-gray-900">Quick Start</h3>
				<p class="mt-0.5 text-xs text-gray-500">Install, sample project layout, and minimal running example</p>
			</div>
			<div class="border-b border-gray-200 px-3 sm:px-5">
				<div class="flex flex-wrap gap-0">
					{#each mainTabs as t}
						<button
							type="button"
							class="border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors sm:px-4
								{activeTab === t.id
								? 'border-[#1e3a8a] text-[#1e3a8a]'
								: 'border-transparent text-gray-500 hover:text-gray-700'}"
							on:click={() => {
								activeTab = t.id;
								if (t.id !== 'cpp') cppSub = 'quickstart';
							}}
						>
							{t.label}
						</button>
					{/each}
				</div>
			</div>

			{#if activeTab === 'cpp'}
				<div class="flex flex-wrap gap-0 border-b border-gray-100 bg-gray-50/80 px-3 sm:px-5">
					{#each cppSubTabs as st}
						<button
							type="button"
							class="border-b-2 px-3 py-2 text-[11px] font-medium transition-colors sm:text-[12px]
								{cppSub === st.id
								? 'border-[#1e3a8a] text-[#1e3a8a]'
								: 'border-transparent text-gray-500 hover:text-gray-700'}"
							on:click={() => (cppSub = st.id)}
						>
							{st.label}
						</button>
					{/each}
				</div>
				<div class="p-4 sm:p-5">
					{#key cppSub}
						<DevCodeBlock code={cppBlock.code} language={cppBlock.language} />
					{/key}
				</div>
			{:else}
				{@const ex = radarCodeExamples[activeTab]}
				{@const setupLang = quickSetupLang[activeTab]}
				{@const codeLang = quickCodeLang[activeTab]}
				<div class="space-y-4 p-4 sm:p-5">
					<div>
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Setup</p>
						<DevCodeBlock code={ex.setup} language={setupLang} />
					</div>
					<div>
						<p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Example</p>
						<DevCodeBlock code={ex.code} language={codeLang} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Configuration Reference -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
			<button
				type="button"
				class="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
				on:click={() => (showConfigRef = !showConfigRef)}
			>
				<div>
					<h3 class="text-sm font-semibold text-gray-900">Configuration Reference</h3>
					<p class="mt-0.5 text-xs text-gray-500">Tracking area, dwell time, path tracking and metadata options</p>
				</div>
				{#if showConfigRef}
					<ChevronUp size={16} class="shrink-0 text-gray-400" />
				{:else}
					<ChevronDown size={16} class="shrink-0 text-gray-400" />
				{/if}
			</button>

			{#if showConfigRef}
				<div class="border-t border-gray-100 px-5 py-4">
					<div class="mb-4">
						<span class="mb-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600"
							>Required</span
						>
						<div class="mt-2 overflow-hidden rounded-lg border border-gray-200">
							<table class="w-full text-sm">
								<thead class="border-b border-gray-200 bg-gray-50">
									<tr>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Field</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Type</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Description</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Constraints</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td class="px-4 py-2.5">
											<code class="rounded bg-blue-50 px-1.5 py-0.5 text-[12px] text-blue-700">tracking_area</code>
										</td>
										<td class="px-4 py-2.5 text-xs text-gray-500">object</td>
										<td class="px-4 py-2.5 text-xs text-gray-600">Detection zone boundaries in meters</td>
										<td class="px-4 py-2.5 text-xs text-gray-500">x: [-4, 4], y: [0, 7]</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
					<div>
						<span class="mb-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600"
							>Optional</span
						>
						<div class="mt-2 overflow-hidden rounded-lg border border-gray-200">
							<table class="w-full text-sm">
								<thead class="border-b border-gray-200 bg-gray-50">
									<tr>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Field</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Type</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Default</th>
										<th class="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Description</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100">
									{#each [
										{ field: 'min_dwell_sec', type: 'double', def: '0.0', desc: 'Minimum dwell time (seconds) to emit a session log' },
										{ field: 'filter_proximity_m', type: 'double', def: 'none', desc: 'Exclude targets farther than this distance (meters) from sensor' },
										{ field: 'path_tracking', type: 'bool', def: 'false', desc: 'Store all detection paths in session logs' },
										{ field: 'timezone', type: 'string', def: 'none', desc: 'Timezone identifier (e.g. "America/New_York")' },
										{ field: 'sensor_id', type: 'string', def: 'none', desc: 'Sensor identifier included in session logs' },
										{ field: 'mac_address', type: 'string', def: 'none', desc: 'MAC address included in session logs' },
										{ field: 'organization_id', type: 'string', def: 'none', desc: 'Organization identifier included in session logs' }
									] as row}
										<tr class="hover:bg-gray-50/50">
											<td class="px-4 py-2.5">
												<code class="rounded bg-blue-50 px-1.5 py-0.5 text-[12px] text-blue-700">{row.field}</code>
											</td>
											<td class="px-4 py-2.5 font-mono text-xs text-gray-500">{row.type}</td>
											<td class="px-4 py-2.5 text-xs text-gray-400">{row.def}</td>
											<td class="px-4 py-2.5 text-xs text-gray-600">{row.desc}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
					<div class="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
						<AlertCircle size={14} class="mt-0.5 shrink-0 text-amber-500" />
						<p class="text-xs text-amber-700">
							Both <code class="rounded bg-amber-100 px-1 font-mono">snake_case</code> and
							<code class="rounded bg-amber-100 px-1 font-mono">camelCase</code> field names are accepted. Detections
							outside <code class="rounded bg-amber-100 px-1 font-mono">tracking_area</code> are automatically filtered out.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Events Reference -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
			<button
				type="button"
				class="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
				on:click={() => (showEventsRef = !showEventsRef)}
			>
				<div>
					<h3 class="text-sm font-semibold text-gray-900">Events Reference</h3>
					<p class="mt-0.5 text-xs text-gray-500">Detection events (~200ms), session logs, and connection status</p>
				</div>
				{#if showEventsRef}
					<ChevronUp size={16} class="shrink-0 text-gray-400" />
				{:else}
					<ChevronDown size={16} class="shrink-0 text-gray-400" />
				{/if}
			</button>

			{#if showEventsRef}
				<div class="divide-y divide-gray-100 border-t border-gray-100">
					<div class="px-5 py-4">
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<span class="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700"
								>Detection Event</span
							>
							<span class="text-xs text-gray-400">Fires every ~200ms</span>
						</div>
						<DevCodeBlock code={radarDetectionEventJson} language="json" />
					</div>
					<div class="px-5 py-4">
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700"
								>Session Log</span
							>
							<span class="text-xs text-gray-400">Fires when target leaves and dwell ≥ min_dwell_sec</span>
						</div>
						<DevCodeBlock code={radarSessionEventJson} language="json" />
						<p class="mt-2 text-xs text-gray-500">
							<code class="rounded bg-gray-100 px-1 font-mono">path_tracking</code> is only included when
							<code class="rounded bg-gray-100 px-1 font-mono">path_tracking: true</code> is set in configuration.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Downloads -->
		<div class="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
			<div class="border-b border-gray-100 px-5 py-3.5">
				<h3 class="text-sm font-semibold text-gray-900">Downloads</h3>
				<p class="mt-0.5 text-xs text-gray-500">
					Latest published builds (signed download). C++, Node.js, and Android each match the catalog base id in
					<code class="rounded bg-gray-100 px-1 font-mono text-[11px]">packageName</code>
					(exact or versioned, e.g.
					<code class="rounded bg-gray-100 px-1 font-mono text-[11px]">radar-android-sdk-3.0.1</code>) with
					Developer SDK catalog sharing.
				</p>
			</div>
			<div class="divide-y divide-gray-100">
				{#each data.radarPackages as pkg}
					<div class="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
								<Package size={15} class="text-gray-500" />
							</div>
							<div class="min-w-0">
								<p class="text-sm font-medium text-gray-800">{pkg.name}</p>
								<p class="text-xs text-gray-400">{pkg.platforms} · {pkg.sizeLabel}</p>
								{#if !pkg.resourceId}
									<p class="mt-1.5 text-[11px] leading-snug text-amber-900/90">
										<span class="font-medium">No matching catalog file.</span>
										Admin: set
										<code class="rounded bg-amber-100/80 px-1 font-mono text-[10px] text-amber-950"
											>packageName</code
										>
										to
										<code class="rounded bg-amber-100/80 px-1 font-mono text-[10px] text-amber-950"
											>{pkg.catalogPackageName}</code
										>
										(or a versioned name such as
										<code class="rounded bg-amber-100/80 px-1 font-mono text-[10px] text-amber-950"
											>{pkg.catalogPackageName}-1.0.0</code
										>) and sharing
										<span class="font-medium">Developer SDK catalog</span>.
									</p>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-3 sm:shrink-0">
							<DevBadge variant="gray" size="sm">{pkg.version}</DevBadge>
							<button
								type="button"
								disabled={!pkg.resourceId || downloadingResourceId === pkg.resourceId}
								class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
								on:click={() =>
									pkg.resourceId && downloadCatalogSdk(pkg.resourceId, pkg.downloadFileName)}
							>
								{#if downloadingResourceId === pkg.resourceId}
									<Loader2 size={13} class="animate-spin" />
									Downloading…
								{:else}
									<Download size={13} />
									Download
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<a href="/user/developers/api-docs" class="text-sm text-blue-700 hover:underline">View full API reference →</a>
			<a
				href="/user/developers/api-docs"
				class="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
			>
				<ExternalLink size={14} />
				API Reference
			</a>
		</div>
	</div>
</div>
