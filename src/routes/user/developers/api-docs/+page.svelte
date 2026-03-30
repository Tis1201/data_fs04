<script lang="ts">
	import { page } from '$app/stores';
	import { Copy, Check, ChevronDown, Lock, Globe, BookOpen, Shield, Key, AlertTriangle, FileJson, FileText } from 'lucide-svelte';

	/** Same host as this app (e.g. http://localhost:5173). Curl examples substitute this for {{ORIGIN}}. */
	$: apiOrigin = $page.url?.origin ?? '';

	function apiBaseUrl(): string {
		return apiOrigin || 'https://app.datarealities.com';
	}

	function expandDocUrls(s: string): string {
		return s.replace(/\{\{ORIGIN\}\}/g, apiBaseUrl());
	}

	function tryItUrl(epId: string, path: string): string {
		const v = tryValues[epId];
		const q = new URLSearchParams();
		q.set('mac_address', v['mac_address'] || '');
		q.set('start_time', v['start_time'] || '');
		q.set('end_time', v['end_time'] || '');
		if (v['type']) q.set('type', v['type']);
		if (epId === 'get-paths' && v['target_id']) q.set('target_id', v['target_id']);
		return `${apiBaseUrl()}${path}?${q.toString()}`;
	}

	let openSections: Record<string, boolean> = {
		'get-sessions': true,
		'get-paths': false
	};
	let openSchemas: Record<string, boolean> = {
		'base-schema': true,
		'sessions-schema': false,
		'paths-schema': false
	};
	let tryItOpen: Record<string, boolean> = {};
	let copiedId: string | null = null;

	let tryValues: Record<string, Record<string, string>> = {
		'get-sessions': {
			mac_address: '00:1A:2B:3C:4D:5E',
			start_time: '2025-12-31T00:00:00',
			end_time: '2025-12-31T23:59:59',
			type: 'csv'
		},
		'get-paths': {
			mac_address: '00:1A:2B:3C:4D:5E',
			start_time: '2025-12-31T00:00:00',
			end_time: '2025-12-31T23:59:59',
			target_id: '',
			type: 'csv'
		}
	};

	let tryResponse: Record<string, { status: number; body: string } | null> = {};

	function toggle(id: string, map: Record<string, boolean>) {
		map[id] = !map[id];
		return { ...map };
	}

	async function copy(text: string, id: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => (copiedId = null), 2000);
	}

	function executeTryIt(endpointId: string, path: string) {
		const vals = tryValues[endpointId];
		const params = new URLSearchParams();
		Object.entries(vals).forEach(([k, v]) => { if (v) params.append(k, v); });
		tryResponse[endpointId] = {
			status: 200,
			body: vals['type'] === 'json'
				? `[\n  {\n    "processed_at": "2026-03-21 12:41:59",\n    "account_id": "cmk19sonc001070u7354l9fq5",\n    "device_id": "cmmz9c5ll0062fiap05pjjv4d",\n    "mac_address": "8C:2A:85:7F:FF:9D",\n    "target_id": "d7eb0b9c-0048-44bd-8cf0-157c7a672f57"\n    ... (additional fields)\n  }\n]`
				: `processed_at,account_id,device_id,log_creation_time,timezone_offset,...\n2026-03-21 12:41:59,cmk19sonc001070u7354l9fq5,cmmz9c5ll0062,...`
		};
		tryResponse = { ...tryResponse };
	}

	const baseSchema = [
		{ col: '1',  name: 'processed_at',      type: 'datetime',  example: '2026-03-21 12:41:59',                    description: 'Date and time the API request was made and the data set was created.' },
		{ col: '2',  name: 'account_id',         type: 'string',    example: 'cmk19sonc001070u7354l9fq5',              description: 'The ID of the account the specific sensor is associated with.' },
		{ col: '3',  name: 'device_id',          type: 'string',    example: 'cmmz9c5ll0062fiap05pjjv4d',             description: 'The ID of the edge device the sensor is associated with.' },
		{ col: '4',  name: 'log_creation_time',  type: 'datetime',  example: '2026-03-21 07:37:59',                   description: 'Timestamp associated with the specific data point.' },
		{ col: '5',  name: 'timezone_offset',    type: 'integer',   example: '-300',                                  description: 'Numeric timezone offset (in minutes).' },
		{ col: '6',  name: 'timezone_label',     type: 'string',    example: 'America/New_York',                      description: 'Name of the timezone.' },
		{ col: '7',  name: 'sensor_id',          type: 'string',    example: 'org_abc123',                            description: 'ID of the sensor the data is associated with.' },
		{ col: '8',  name: 'sensor_name',        type: 'string',    example: 'radar-001',                             description: 'User-defined name of the sensor.' },
		{ col: '9',  name: 'mac_address',        type: 'string',    example: '8C:2A:85:7F:FF:9D',                    description: 'MAC address of the edge device the sensor is associated with.' },
		{ col: '10', name: 'target_id',          type: 'uuid',      example: 'd7eb0b9c-0048-44bd-8cf0-157c7a672f57',  description: 'Unique ID for the target (person) in the field of view. Remains consistent for the duration they are tracked.' }
	];

	const sessionsExtended = [
		{ col: '11', name: 'dwell_tracking_area_sec', type: 'float',   example: '56.7',                                              description: 'Time (in seconds) the target spent within the sensor\'s defined Field of View (Tracking Area).' },
		{ col: '12', name: 'zone_dwell_times_json',   type: 'string',  example: '{"zone 1","3.2";"zone 2","0.0","zone 3","28.3"}',   description: 'String containing each zone name and the target\'s dwell time in that specific zone.' },
		{ col: '13', name: 'proximity_m',             type: 'float',   example: '5.1',                                               description: 'The closest distance (in metres) the target reached to the sensor.' }
	];

	const pathsExtended = [
		{ col: '11', name: 'x_m', type: 'float', example: '-2.7', description: 'X coordinate (metres) of the target\'s position. Relative to the sensor: 0 is in front, negative is to its left, positive is to its right.' },
		{ col: '12', name: 'y_m', type: 'float', example: '4.2',  description: 'Y coordinate (metres) of the target\'s position. Relative to the sensor: 0 is in front, positive is moving away from the sensor.' }
	];

	const endpoints = [
		{
			id: 'get-sessions',
			method: 'GET' as const,
			path: '/api/sensor-logs/sessions',
			summary: 'Get Session Logs',
			description: 'Returns session-level records — one row per person per visit. Each row reports how long a target was present in the tracking area and in each configured zone, plus the closest proximity reached.',
			required: [
				{ name: 'mac_address', type: 'string',   example: '00:1A:2B:3C:4D:5E',    description: 'MAC address of the edge device. Found in the platform under Sensors.' },
				{ name: 'start_time',  type: 'ISO 8601', example: '2025-12-31T00:00:00',   description: 'Start of the query time range.' },
				{ name: 'end_time',    type: 'ISO 8601', example: '2025-12-31T23:59:59',   description: 'End of the query time range.' }
			],
			optional: [
				{ name: 'type', type: 'string', example: 'csv', description: 'Response format. `csv` (default) or `json`.' }
			],
			examples: [
				{
					label: 'CSV (default)',
					lang: 'bash',
					code: `curl -H "x-api-key: your-api-key" \\\n  "{{ORIGIN}}/api/sensor-logs/sessions?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59"`
				},
				{
					label: 'JSON format',
					lang: 'bash',
					code: `curl -H "x-api-key: your-api-key" \\\n  "{{ORIGIN}}/api/sensor-logs/sessions?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59&type=json"`
				},
				{
					label: 'Save to file',
					lang: 'bash',
					code: `curl -H "x-api-key: your-api-key" \\\n  "{{ORIGIN}}/api/sensor-logs/sessions?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59" \\\n  -O -J`
				}
			],
			jsonResponse: `[\n  {\n    "processed_at": "2026-03-21 12:41:59",\n    "account_id": "cmk19sonc001070u7354l9fq5",\n    "device_id": "cmmz9c5ll0062fiap05pjjv4d",\n    "log_creation_time": "2026-03-21 07:37:59",\n    "timezone_offset": -300,\n    "timezone_label": "America/New_York",\n    "sensor_id": "org_abc123",\n    "sensor_name": "radar-001",\n    "mac_address": "8C:2A:85:7F:FF:9D",\n    "target_id": "d7eb0b9c-0048-44bd-8cf0-157c7a672f57",\n    "dwell_tracking_area_sec": 56.7,\n    "zone_dwell_times_json": "{\\"zone 1\\",\\"3.2\\";\\"zone 2\\",\\"0.0\\",\\"zone 3\\",\\"28.3\\"}",\n    "proximity_m": 5.1\n  }\n]`,
			csvResponse: `processed_at,account_id,device_id,log_creation_time,timezone_offset,timezone_label,sensor_id,sensor_name,mac_address,target_id,dwell_tracking_area_sec,zone_dwell_times_json,proximity_m\n2026-03-21 12:41:59,cmk19sonc001070u7354l9fq5,cmmz9c5ll0062fiap05pjjv4d,2026-03-21 07:37:59,-300,America/New_York,org_abc123,radar-001,8C:2A:85:7F:FF:9D,d7eb0b9c-0048-44bd-8cf0-157c7a672f57,56.7,"{""zone 1"",""3.2"";""zone 2"",""0.0""}",5.1`,
			schemaTag: 'sessions'
		},
		{
			id: 'get-paths',
			method: 'GET' as const,
			path: '/api/sensor-logs/paths',
			summary: 'Get Path Tracking Logs',
			description: 'Returns X/Y coordinate tracking logs, typically at 1-second intervals. Each row represents one positional snapshot of a target within the sensor\'s field of view. Use `target_id` to filter tracking data for a specific individual.',
			required: [
				{ name: 'mac_address', type: 'string',   example: '00:1A:2B:3C:4D:5E',  description: 'MAC address of the edge device. Found in the platform under Sensors.' },
				{ name: 'start_time',  type: 'ISO 8601', example: '2025-12-31T00:00:00', description: 'Start of the query time range.' },
				{ name: 'end_time',    type: 'ISO 8601', example: '2025-12-31T23:59:59', description: 'End of the query time range.' }
			],
			optional: [
				{ name: 'target_id', type: 'string', example: 'd7eb0b9c-0048-44bd-8cf0-157c7a672f57', description: 'Filter to one target (same `target_id` as in API responses). Omit to return all targets in range.' },
				{ name: 'type',      type: 'string', example: 'csv',         description: 'Response format. `csv` (default) or `json`.' }
			],
			examples: [
				{
					label: 'All targets',
					lang: 'bash',
					code: `curl -H "x-api-key: your-api-key" \\\n  "{{ORIGIN}}/api/sensor-logs/paths?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59"`
				},
				{
					label: 'Specific target',
					lang: 'bash',
					code: `curl -H "x-api-key: your-api-key" \\\n  "{{ORIGIN}}/api/sensor-logs/paths?mac_address=00:1A:2B:3C:4D:5E&target_id=d7eb0b9c-0048-44bd-8cf0-157c7a672f57&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59"`
				},
				{
					label: 'JSON format',
					lang: 'bash',
					code: `curl -H "x-api-key: your-api-key" \\\n  "{{ORIGIN}}/api/sensor-logs/paths?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59&type=json"`
				}
			],
			jsonResponse: `[\n  {\n    "processed_at": "2026-03-21 12:41:59",\n    "account_id": "cmk19sonc001070u7354l9fq5",\n    "device_id": "cmmz9c5ll0062fiap05pjjv4d",\n    "log_creation_time": "2026-03-21 07:38:05",\n    "timezone_offset": -300,\n    "timezone_label": "America/New_York",\n    "sensor_id": "org_abc123",\n    "sensor_name": "radar-001",\n    "mac_address": "8C:2A:85:7F:FF:9D",\n    "target_id": "d7eb0b9c-0048-44bd-8cf0-157c7a672f57",\n    "x_m": -2.7,\n    "y_m": 4.2\n  }\n]`,
			csvResponse: `processed_at,account_id,device_id,log_creation_time,timezone_offset,timezone_label,sensor_id,sensor_name,mac_address,target_id,x_m,y_m\n2026-03-21 12:41:59,cmk19sonc001070u7354l9fq5,cmmz9c5ll0062fiap05pjjv4d,2026-03-21 07:38:05,-300,America/New_York,org_abc123,radar-001,8C:2A:85:7F:FF:9D,d7eb0b9c-0048-44bd-8cf0-157c7a672f57,-2.7,4.2`,
			schemaTag: 'paths'
		}
	] as const;

	type EndpointId = typeof endpoints[number]['id'];
	let activeExample: Record<EndpointId, number> = { 'get-sessions': 0, 'get-paths': 0 };
	let activeResponseTab: Record<EndpointId, 'json' | 'csv'> = { 'get-sessions': 'json', 'get-paths': 'json' };
</script>

<div class="min-h-full bg-[#F9FAFB]">
	<div class="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">

		<!-- API hero + metadata (matches Web App: solid blue bar + white stats row) -->
		<div class="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
			<div
				class="border-b border-blue-900/20 px-5 py-5 sm:px-6 sm:py-5"
				style="background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%);"
			>
				<div class="flex flex-wrap items-start gap-3 sm:items-center">
					<div class="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
							<BookOpen size={20} strokeWidth={2} class="opacity-95" />
						</div>
						<div class="min-w-0">
							<h1 class="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">
								Radar Data API
							</h1>
							<p class="mt-1 text-[13px] leading-snug text-blue-100 sm:text-[13.5px]">
								Simple endpoints to retrieve radar sensor logs from the Data Lake
							</p>
						</div>
					</div>
					<span
						class="shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
					>
						V1.0
					</span>
				</div>
			</div>
			<div class="grid grid-cols-1 divide-y divide-gray-100 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
				<div class="flex items-center gap-3 px-5 py-3.5">
					<Globe size={15} class="shrink-0 text-gray-400" strokeWidth={2} />
					<div class="min-w-0">
						<p class="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">API host</p>
						<code class="block truncate font-mono text-[12px] text-gray-800">{apiBaseUrl()}</code>
						<p class="mt-1 text-[10px] leading-snug text-gray-400">
							Routes: <code class="font-mono">GET /api/sensor-logs/sessions</code>,
							<code class="font-mono">GET /api/sensor-logs/paths</code>
						</p>
					</div>
				</div>
				<div class="flex items-center gap-3 px-5 py-3.5">
					<Key size={15} class="shrink-0 text-gray-400" strokeWidth={2} />
					<div class="min-w-0">
						<p class="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Auth Header</p>
						<code class="block break-all font-mono text-[12px] text-gray-800">x-api-key: your-api-key</code>
					</div>
				</div>
				<div class="flex items-center gap-3 px-5 py-3.5">
					<Shield size={15} class="shrink-0 text-gray-400" strokeWidth={2} />
					<div class="min-w-0">
						<p class="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Default Format</p>
						<span class="text-[12px] text-gray-700">
							CSV (add <code class="rounded bg-gray-100 px-1 font-mono text-[11.5px]">?type=json</code> for JSON)
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Authentication Note -->
		<div class="mb-5 flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3.5">
			<Lock size={14} class="mt-0.5 shrink-0 text-amber-600" strokeWidth={2} />
			<div class="text-[12.5px] leading-relaxed text-amber-900">
				<strong>Authentication required on all requests.</strong>
				Add the <code class="rounded bg-amber-100 px-1 font-mono">x-api-key</code> header to every request.
				Find your API key in the platform under
				<a href="/user/developers/api-keys" class="underline hover:text-amber-900">API Keys</a>.
				Your device MAC address is found under
				<a href="/user/controllers/radar" class="underline hover:text-amber-900">Sensors</a>.
			</div>
		</div>

		<!-- Endpoints -->
		{#each endpoints as ep}
			{@const isOpen = !!openSections[ep.id]}

			<div class="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
				<button
					type="button"
					on:click={() => { openSections = toggle(ep.id, openSections); }}
					class="flex w-full items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 sm:gap-3 sm:px-5
						{isOpen ? 'border-b border-green-100 bg-green-50/50' : ''}"
				>
					<span class="w-[48px] shrink-0 rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white shadow-sm sm:w-[52px] sm:text-[10.5px] bg-[#16a34a]">
						GET
					</span>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
						<code class="truncate font-mono text-[12px] font-semibold text-gray-900 sm:text-[13px]">{ep.path}</code>
						<span class="truncate text-[11px] text-gray-500 sm:text-[12px]">{ep.summary}</span>
					</div>
					<ChevronDown
						size={15}
						class="ml-2 shrink-0 text-gray-400 transition-transform duration-200 {isOpen ? '' : '-rotate-90'}"
					/>
				</button>

				{#if isOpen}
					<div class="px-5 pb-6 pt-4">
						<p class="mb-5 text-[13px] leading-relaxed text-gray-600">{ep.description}</p>

						<!-- Required Parameters -->
						<div class="mb-5">
							<h4 class="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
								Required Parameters
								<span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">required</span>
							</h4>
							<div class="overflow-hidden rounded-lg border border-gray-200">
								<table class="w-full text-[12px]">
									<thead>
										<tr class="border-b border-gray-100 bg-gray-50">
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Parameter</th>
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Type</th>
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Example</th>
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Description</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-100">
										{#each ep.required as param}
											<tr class="hover:bg-gray-50/60">
												<td class="px-3 py-2.5"><code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800">{param.name}</code></td>
												<td class="px-3 py-2.5"><code class="font-mono text-[11px] text-gray-500">{param.type}</code></td>
												<td class="px-3 py-2.5"><code class="font-mono text-[11px] text-blue-600">{param.example}</code></td>
												<td class="px-3 py-2.5 leading-relaxed text-gray-500">{param.description}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- Optional Parameters -->
						<div class="mb-5">
							<h4 class="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
								Optional Parameters
								<span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">optional</span>
							</h4>
							<div class="overflow-hidden rounded-lg border border-gray-200">
								<table class="w-full text-[12px]">
									<thead>
										<tr class="border-b border-gray-100 bg-gray-50">
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Parameter</th>
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Type</th>
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Default</th>
											<th class="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Description</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-100">
										{#each ep.optional as param}
											<tr class="hover:bg-gray-50/60">
												<td class="px-3 py-2.5"><code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800">{param.name}</code></td>
												<td class="px-3 py-2.5"><code class="font-mono text-[11px] text-gray-500">{param.type}</code></td>
												<td class="px-3 py-2.5"><code class="font-mono text-[11px] text-blue-600">{param.example}</code></td>
												<td class="px-3 py-2.5 leading-relaxed text-gray-500">{param.description}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>

						<!-- cURL Examples -->
						<div class="mb-5">
							<h4 class="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Examples</h4>
							<div class="mb-0 flex gap-0 border-b border-gray-200">
								{#each ep.examples as ex, i}
									<button
										on:click={() => { activeExample = { ...activeExample, [ep.id]: i }; }}
										class="border-b-2 px-3.5 py-2 text-[12px] font-medium transition-colors
											{activeExample[ep.id] === i ? 'border-[#1e3a8a] text-[#1e3a8a]' : 'border-transparent text-gray-500 hover:text-gray-700'}"
									>
										{ex.label}
									</button>
								{/each}
							</div>
							<div class="relative overflow-hidden rounded-b-lg rounded-tr-lg border border-t-0 border-gray-200 bg-[#1a1a2e]">
								<button
									type="button"
									on:click={() => copy(expandDocUrls(ep.examples[activeExample[ep.id]].code), ep.id + '-ex')}
									class="absolute right-3 top-3 flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300"
								>
									{#if copiedId === ep.id + '-ex'}
										<Check size={11} class="text-green-400" />
										<span class="text-green-400">Copied</span>
									{:else}
										<Copy size={11} />
										Copy
									{/if}
								</button>
								<pre class="overflow-x-auto p-4 pt-3 font-mono text-[12px] leading-relaxed text-gray-300">{expandDocUrls(ep.examples[activeExample[ep.id]].code)}</pre>
							</div>
						</div>

						<!-- Response -->
						<div class="mb-5">
							<h4 class="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Response</h4>
							<div class="mb-0 flex overflow-hidden rounded-t-lg border border-b-0 border-gray-200 bg-gray-50">
								<button
									on:click={() => { activeResponseTab = { ...activeResponseTab, [ep.id]: 'json' }; }}
									class="flex items-center gap-1.5 border-r border-gray-200 px-4 py-2 text-[12px] font-medium transition-colors
										{activeResponseTab[ep.id] === 'json' ? 'bg-[#1a1a2e] text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}"
								>
									<FileJson size={13} />
									JSON
								</button>
								<button
									on:click={() => { activeResponseTab = { ...activeResponseTab, [ep.id]: 'csv' }; }}
									class="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors
										{activeResponseTab[ep.id] === 'csv' ? 'bg-[#1a1a2e] text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}"
								>
									<FileText size={13} />
									CSV
								</button>
								<div class="ml-auto flex items-center gap-2 px-3">
									<span class="rounded border border-green-200 bg-green-100 px-2 py-0.5 font-mono text-[11px] font-bold text-green-700">200</span>
									<button
										on:click={() => copy(activeResponseTab[ep.id] === 'json' ? ep.jsonResponse : ep.csvResponse, ep.id + '-res')}
										class="flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
									>
										{#if copiedId === ep.id + '-res'}
											<Check size={11} class="text-green-500" />
										{:else}
											<Copy size={11} />
										{/if}
									</button>
								</div>
							</div>
							<div class="overflow-hidden rounded-b-lg border border-gray-200 bg-[#1a1a2e]">
								<pre class="overflow-x-auto p-4 font-mono text-[11.5px] leading-relaxed text-gray-300">{activeResponseTab[ep.id] === 'json' ? ep.jsonResponse : ep.csvResponse}</pre>
							</div>
						</div>

						<!-- Try it out -->
						<div class="border-t border-gray-100 pt-4">
							<button
								on:click={() => { tryItOpen = toggle(ep.id, tryItOpen); }}
								class="rounded-lg border px-4 py-1.5 text-[12px] font-semibold transition-colors
									{tryItOpen[ep.id] ? 'border-transparent bg-[#1e3a8a] text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
							>
								{tryItOpen[ep.id] ? 'Close' : 'Try it out'}
							</button>

							{#if tryItOpen[ep.id]}
								<div class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
									<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
										{#each [...ep.required, ...ep.optional] as param}
											<div>
												<label for="{ep.id}-{param.name}" class="mb-1 block text-[11.5px] font-medium text-gray-700">
													<code class="font-mono">{param.name}</code>
													{#if ep.required.some((r) => r.name === param.name)}
														<span class="ml-1 text-red-500">*</span>
													{/if}
												</label>
												<input
													id="{ep.id}-{param.name}"
													type="text"
													bind:value={tryValues[ep.id][param.name]}
													placeholder={param.example}
													class="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-[12px] text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
												/>
											</div>
										{/each}
									</div>
									<div class="mt-3">
										<p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Generated URL</p>
										<div class="flex items-center gap-2 overflow-hidden rounded-md border border-gray-200 bg-white px-3 py-2">
											<code class="flex-1 truncate font-mono text-[11px] text-gray-600">{tryItUrl(ep.id, ep.path)}</code>
										</div>
									</div>
									<div class="mt-3">
										<button
											on:click={() => executeTryIt(ep.id, ep.path)}
											class="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1a3475]"
										>
											Execute
										</button>
										{#if tryResponse[ep.id]}
											<div class="mt-3">
												<div class="mb-1.5 flex items-center gap-2">
													<span class="text-[12px] font-semibold text-gray-600">Response</span>
													<span class="rounded border border-green-200 bg-green-100 px-2 py-0.5 font-mono text-[11px] font-bold text-green-700">{tryResponse[ep.id]?.status}</span>
													<span class="text-[11px] italic text-gray-400">(simulated)</span>
												</div>
												<pre class="overflow-x-auto rounded-lg bg-[#1a1a2e] p-3 font-mono text-[11px] leading-relaxed text-gray-300">{tryResponse[ep.id]?.body}</pre>
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/each}

		<!-- Response Schema Reference -->
		<div class="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
			<button
				on:click={() => { openSchemas = toggle('base-schema', openSchemas); }}
				class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
			>
				<ChevronDown size={15} class="shrink-0 text-gray-400 transition-transform duration-200 {openSchemas['base-schema'] ? '' : '-rotate-90'}" />
				<span class="text-[13px] font-semibold text-gray-900">Response Schema — Base Fields (Columns 1–10)</span>
				<span class="ml-auto text-[11px] text-gray-400">Shared by both endpoints</span>
			</button>
			{#if openSchemas['base-schema']}
				<div class="border-t border-gray-100">
					<p class="px-5 py-3 text-[12.5px] text-gray-500">
						Both <code class="font-mono">sessions</code> and <code class="font-mono">paths</code> reports share
						these 10 base columns. Additional columns depend on the endpoint used.
					</p>
					<div class="overflow-x-auto">
						<table class="w-full text-[12px]">
							<thead>
								<tr class="border-b border-gray-100 bg-gray-50">
									<th class="w-8 px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Col</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Field</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Type</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Example</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Description</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each baseSchema as field}
									<tr class="hover:bg-gray-50/60">
										<td class="px-4 py-2.5 font-mono text-[11px] text-gray-400">{field.col}</td>
										<td class="px-4 py-2.5"><code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800">{field.name}</code></td>
										<td class="px-4 py-2.5"><code class="font-mono text-[11px] text-gray-500">{field.type}</code></td>
										<td class="px-4 py-2.5"><code class="break-all font-mono text-[11px] text-blue-600">{field.example}</code></td>
										<td class="px-4 py-3 text-[12px] leading-relaxed text-gray-500">{field.description}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>

		<div class="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
			<button
				on:click={() => { openSchemas = toggle('sessions-schema', openSchemas); }}
				class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
			>
				<ChevronDown size={15} class="shrink-0 text-gray-400 transition-transform duration-200 {openSchemas['sessions-schema'] ? '' : '-rotate-90'}" />
				<span class="text-[13px] font-semibold text-gray-900">Sessions Report — Extended Fields (Columns 11–13)</span>
				<code class="ml-auto rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">/sensor-logs/sessions</code>
			</button>
			{#if openSchemas['sessions-schema']}
				<div class="border-t border-gray-100">
					<p class="px-5 py-3 text-[12.5px] text-gray-500">
						These columns extend the base schema for the <code class="font-mono">sessions</code> endpoint.
						One row is generated per target's complete time in the sensor's field of view.
					</p>
					<div class="overflow-x-auto">
						<table class="w-full text-[12px]">
							<thead>
								<tr class="border-b border-gray-100 bg-gray-50">
									<th class="w-8 px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Col</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Field</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Type</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Example</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Description</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each sessionsExtended as field}
									<tr class="hover:bg-gray-50/60">
										<td class="px-4 py-2.5 font-mono text-[11px] text-gray-400">{field.col}</td>
										<td class="px-4 py-2.5"><code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800">{field.name}</code></td>
										<td class="px-4 py-2.5"><code class="font-mono text-[11px] text-gray-500">{field.type}</code></td>
										<td class="px-4 py-2.5"><code class="block max-w-[160px] break-all font-mono text-[11px] text-blue-600">{field.example}</code></td>
										<td class="px-4 py-3 text-[12px] leading-relaxed text-gray-500">{field.description}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>

		<div class="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
			<button
				on:click={() => { openSchemas = toggle('paths-schema', openSchemas); }}
				class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
			>
				<ChevronDown size={15} class="shrink-0 text-gray-400 transition-transform duration-200 {openSchemas['paths-schema'] ? '' : '-rotate-90'}" />
				<span class="text-[13px] font-semibold text-gray-900">Paths Report — Extended Fields (Columns 11–12)</span>
				<code class="ml-auto rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">/sensor-logs/paths</code>
			</button>
			{#if openSchemas['paths-schema']}
				<div class="border-t border-gray-100">
					<p class="px-5 py-3 text-[12.5px] text-gray-500">
						These columns extend the base schema for the <code class="font-mono">paths</code> endpoint.
						One row is generated per target position update (typically every 1 second).
					</p>
					<div class="overflow-x-auto">
						<table class="w-full text-[12px]">
							<thead>
								<tr class="border-b border-gray-100 bg-gray-50">
									<th class="w-8 px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Col</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Field</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Type</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Example</th>
									<th class="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Description</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each pathsExtended as field}
									<tr class="hover:bg-gray-50/60">
										<td class="px-4 py-2.5 font-mono text-[11px] text-gray-400">{field.col}</td>
										<td class="px-4 py-2.5"><code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-800">{field.name}</code></td>
										<td class="px-4 py-2.5"><code class="font-mono text-[11px] text-gray-500">{field.type}</code></td>
										<td class="px-4 py-2.5"><code class="font-mono text-[11px] text-blue-600">{field.example}</code></td>
										<td class="px-4 py-3 text-[12px] leading-relaxed text-gray-500">{field.description}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>

		<!-- Error Codes -->
		<div class="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
			<div class="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5">
				<AlertTriangle size={15} class="shrink-0 text-gray-400" />
				<span class="text-[13px] font-semibold text-gray-900">Error Codes</span>
			</div>
			<div class="divide-y divide-gray-100">
				{#each [
					{ code: 400, label: 'Bad Request',           color: 'bg-yellow-100 text-yellow-700 border-yellow-200', desc: 'Missing or invalid required parameters (e.g. missing mac_address, malformed time format, or type not csv/json).' },
					{ code: 401, label: 'Unauthorized',          color: 'bg-red-100 text-red-700 border-red-200',          desc: 'Invalid or missing x-api-key header. Verify your key under API Keys.' },
					{ code: 403, label: 'Forbidden',             color: 'bg-orange-100 text-orange-800 border-orange-200', desc: 'mac_address is not registered to your account (or not authorized for this API key).' },
					{ code: 500, label: 'Internal Server Error', color: 'bg-red-100 text-red-700 border-red-200',          desc: 'An unexpected server-side error occurred. Contact support.' }
				] as err}
					<div class="flex items-start gap-4 px-5 py-3.5">
						<span class="shrink-0 rounded border px-2.5 py-0.5 font-mono text-[12px] font-bold {err.color}">{err.code}</span>
						<div>
							<p class="text-[12.5px] font-semibold text-gray-800">{err.label}</p>
							<p class="text-[12px] text-gray-500">{err.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Quick Reference -->
		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
			<div class="border-b border-gray-100 px-5 py-3.5">
				<span class="text-[13px] font-semibold text-gray-900">Quick Reference</span>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-[12.5px]">
					<thead>
						<tr class="border-b border-gray-100 bg-gray-50">
							<th class="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Endpoint</th>
							<th class="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Purpose</th>
							<th class="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Key Difference</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						<tr class="hover:bg-gray-50/60">
							<td class="px-5 py-3"><code class="font-mono text-[12px] text-blue-700">/api/sensor-logs/sessions</code></td>
							<td class="px-5 py-3 text-gray-600">Session-level events</td>
							<td class="px-5 py-3 text-gray-500">Dwell times, zone info, proximity — one row per visit</td>
						</tr>
						<tr class="hover:bg-gray-50/60">
							<td class="px-5 py-3"><code class="font-mono text-[12px] text-blue-700">/api/sensor-logs/paths</code></td>
							<td class="px-5 py-3 text-gray-600">Coordinate tracking</td>
							<td class="px-5 py-3 text-gray-500">X/Y positions per timestamp (~1 sec interval)</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 sm:grid-cols-4">
				<div class="px-5 py-3">
					<p class="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Path prefix</p>
					<code class="break-all font-mono text-[11px] text-gray-700">/api/sensor-logs</code>
				</div>
				{#each [
					{ label: 'Auth Header',    value: 'x-api-key: your-api-key' },
					{ label: 'Default Format', value: 'CSV (streaming attachment)' },
					{ label: 'Time params',    value: 'ISO-8601 or Date-parsable' }
				] as item}
					<div class="px-5 py-3">
						<p class="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</p>
						<code class="font-mono text-[11px] text-gray-700">{item.value}</code>
					</div>
				{/each}
			</div>
		</div>

	</div>
</div>
