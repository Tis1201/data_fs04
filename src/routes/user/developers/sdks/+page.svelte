<script lang="ts">
	import DevBadge from '$lib/components/developers/DevBadge.svelte';
	import { Radio, Monitor, ArrowRight, Code2 } from 'lucide-svelte';

	const sdks = [
		{
			id: 'radar',
			title: 'Radar SDK',
			subtitle: 'Presence Detection & Motion Analytics',
			description:
				'Real-time presence detection and motion analytics using edge radar sensors. Provides a high-performance, event-driven API for object tracking, dwell analytics, and session logging — designed for low-latency edge processing.',
			icon: Radio,
			href: '/user/developers/sdks/radar',
			platforms: ['C++ 17+', 'Python 3.x', 'Node.js 18+', 'Android (Java)'],
			systems: ['Linux (AMD64/AArch64)', 'Windows', 'macOS', 'Android OS'],
			version: 'v1.0.0',
			comingSoon: false,
			tags: [
				{ label: 'Edge Processing', variant: 'blue' as const },
				{ label: 'Real-Time', variant: 'green' as const }
			],
			accentColor: 'from-blue-50 to-indigo-50',
			iconBg: 'bg-blue-100 text-blue-600'
		},
		{
			id: 'rdm',
			title: 'Remote Device Manager SDK',
			subtitle: 'Device Control & Monitoring',
			description:
				'Device control, monitoring, and remote management APIs for IoT and signage devices. Manage firmware, configurations, and real-time status across your entire device fleet.',
			icon: Monitor,
			href: null as string | null,
			platforms: ['Node.js', 'Python', 'REST API'],
			systems: ['Windows', 'Linux', 'Android OS'],
			version: 'Coming Soon',
			comingSoon: true,
			tags: [
				{ label: 'IoT', variant: 'purple' as const },
				{ label: 'Fleet Management', variant: 'orange' as const }
			],
			accentColor: 'from-purple-50 to-pink-50',
			iconBg: 'bg-purple-100 text-purple-600'
		}
	];
</script>

<div class="min-h-full bg-[#F9FAFB]">
	<main class="mx-auto max-w-5xl overflow-y-auto p-6">
		<!-- Header row (matches Web App /developers/sdks) -->
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h2 class="text-base font-semibold text-gray-900">Available SDKs</h2>
				<p class="mt-0.5 text-sm text-gray-500">
					Download and integrate Data Realities SDKs into your application
				</p>
			</div>
			<span class="text-xs text-gray-400">{sdks.length} SDKs available</span>
		</div>

		<!-- SDK Cards -->
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
			{#each sdks as sdk}
				<div
					class="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-card transition-all duration-200 {sdk.comingSoon
						? 'border-gray-200 opacity-75'
						: 'border-gray-200 hover:border-gray-300 hover:shadow-card-md'}"
				>
					<!-- Card accent header -->
					<div class="bg-gradient-to-br px-5 pb-4 pt-5 {sdk.accentColor}">
						<div class="flex items-start justify-between">
							<div
								class="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm {sdk.iconBg} {sdk.comingSoon
									? 'opacity-60'
									: ''}"
							>
								<svelte:component this={sdk.icon} size={22} />
							</div>
							<div class="flex flex-col items-end gap-1.5">
								{#if sdk.comingSoon}
									<DevBadge variant="gray" size="sm">Coming Soon</DevBadge>
								{:else}
									<DevBadge variant="green" size="sm">{sdk.version}</DevBadge>
								{/if}
							</div>
						</div>
						<div class="mt-3">
							<h3 class="text-base font-semibold {sdk.comingSoon ? 'text-gray-500' : 'text-gray-900'}">{sdk.title}</h3>
							<p class="mt-0.5 text-xs font-medium text-gray-500">{sdk.subtitle}</p>
						</div>
					</div>

					<!-- Card body -->
					<div class="flex flex-1 flex-col p-5">
						<p class="text-sm leading-relaxed {sdk.comingSoon ? 'text-gray-400' : 'text-gray-600'}">{sdk.description}</p>

						<!-- Tags -->
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each sdk.tags as tag}
								<DevBadge variant={sdk.comingSoon ? 'gray' : tag.variant} size="sm">{tag.label}</DevBadge>
							{/each}
						</div>

						<!-- Languages & Platforms -->
						<div class="mt-4 grid grid-cols-2 gap-3">
							<div>
								<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Languages</p>
								<div class="flex flex-wrap gap-1">
									{#each sdk.platforms as lang}
										<span
											class="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium {sdk.comingSoon
												? 'bg-gray-50 text-gray-400'
												: 'bg-gray-100 text-gray-500'}"
										>
											{lang}
										</span>
									{/each}
								</div>
							</div>
							<div>
								<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Platforms</p>
								<div class="flex flex-wrap gap-1">
									{#each sdk.systems as os}
										<span
											class="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium {sdk.comingSoon
												? 'bg-gray-50 text-gray-400'
												: 'bg-gray-100 text-gray-500'}"
										>
											{os}
										</span>
									{/each}
								</div>
							</div>
						</div>

						<!-- Actions -->
						<div class="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
							{#if sdk.comingSoon}
								<span
									class="inline-flex flex-1 cursor-not-allowed select-none items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
								>
									Coming Soon
								</span>
							{:else if sdk.href}
								<a href={sdk.href} class="btn-primary flex-1 justify-center text-center">
									View Details
									<ArrowRight size={14} />
								</a>
							{:else}
								<span
									class="inline-flex flex-1 cursor-not-allowed select-none items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
								>
									Documentation coming soon
								</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Getting started note -->
		<div class="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-5">
			<div class="flex items-start gap-3">
				<Code2 size={18} class="mt-0.5 shrink-0 text-gray-400" />
				<div>
					<h4 class="text-sm font-semibold text-gray-700">Need help getting started?</h4>
					<p class="mt-1 text-xs text-gray-500">
						Check the
						<a href="/user/developers/api-docs" class="text-[#1e3a8a] hover:underline">API Documentation</a>
						for authentication setup and endpoint reference. Create your API key under
						<a href="/user/developers/api-keys" class="text-[#1e3a8a] hover:underline">API Keys</a>
						to start making requests.
					</p>
				</div>
			</div>
		</div>
	</main>
</div>
