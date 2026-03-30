<script lang="ts">
	import { Copy, Check } from 'lucide-svelte';

	export let code: string;
	export let language: string = 'javascript';

	let highlighted = '';
	let copied = false;

	async function loadLanguage(Prism: typeof import('prismjs'), lang: string) {
		if (lang === 'cpp' || lang === 'c') {
			await import(/* @vite-ignore */ 'prismjs/components/prism-c');
			await import(/* @vite-ignore */ 'prismjs/components/prism-cpp');
		} else if (lang === 'python') {
			await import(/* @vite-ignore */ 'prismjs/components/prism-python');
		} else if (lang === 'bash' || lang === 'shell') {
			await import(/* @vite-ignore */ 'prismjs/components/prism-bash');
		} else if (lang === 'java') {
			await import(/* @vite-ignore */ 'prismjs/components/prism-java');
		} else if (lang === 'kotlin') {
			await import(/* @vite-ignore */ 'prismjs/components/prism-kotlin');
		} else if (lang === 'json') {
			await import(/* @vite-ignore */ 'prismjs/components/prism-json');
		}
	}

	async function runHighlight() {
		const Prism = (await import('prismjs')).default;
		await loadLanguage(Prism, language);
		const grammar = Prism.languages[language] ?? Prism.languages.javascript;
		highlighted = Prism.highlight(code, grammar, language);
	}

	$: code, language, void runHighlight();

	async function copyCode() {
		await navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"
	/>
</svelte:head>

<div class="relative overflow-hidden rounded-lg border border-gray-800 bg-[#2d2d2d]">
	<div
		class="flex items-center justify-between border-b border-gray-700 bg-[#1e1e1e] px-4 py-2.5"
	>
		<div class="flex items-center gap-1.5">
			<div class="h-3 w-3 rounded-full bg-red-500/70"></div>
			<div class="h-3 w-3 rounded-full bg-yellow-500/70"></div>
			<div class="h-3 w-3 rounded-full bg-green-500/70"></div>
		</div>
		<span class="text-[11px] font-medium uppercase tracking-wider text-gray-400">{language}</span>
		<button
			type="button"
			on:click={copyCode}
			class="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
		>
			{#if copied}
				<Check size={12} class="text-green-400" />
				<span class="text-green-400">Copied!</span>
			{:else}
				<Copy size={12} />
				<span>Copy</span>
			{/if}
		</button>
	</div>

	<div class="overflow-x-auto">
		<pre class="m-0 bg-transparent p-4 text-[0.8125rem] leading-relaxed"><code
				class="language-{language} font-mono text-[0.8125rem] text-gray-300"
				>{#if highlighted}{@html highlighted}{:else}{code}{/if}</code
			></pre>
	</div>
</div>
