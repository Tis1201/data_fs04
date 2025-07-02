<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "$lib/utils/ui-utils.js";
	import { Eye, EyeOff } from "lucide-svelte";
	import { Button } from "$lib/components/ui/button";

	type $$Props = HTMLInputAttributes & {
		/**
		 * Show toggle password visibility button
		 * @default true
		 */
		showToggle?: boolean;
	};

	export type PasswordInputEvents = {
		blur: Event;
		change: Event;
		click: MouseEvent;
		focus: FocusEvent;
		focusin: FocusEvent;
		focusout: FocusEvent;
		keydown: KeyboardEvent;
		keypress: KeyboardEvent;
		keyup: KeyboardEvent;
		mouseover: MouseEvent;
		mouseenter: MouseEvent;
		mouseleave: MouseEvent;
		paste: ClipboardEvent;
		input: Event;
	};

	type $$Events = PasswordInputEvents;

	let className: $$Props["class"] = undefined;
	export let value: $$Props["value"] = undefined;
	export let showToggle: $$Props["showToggle"] = true;
	export { className as class };

	// Workaround for https://github.com/sveltejs/svelte/issues/9305
	export let readonly: $$Props["readonly"] = undefined;

	let showPassword = false;

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}
</script>

<div class="relative">
	{#if showPassword}
		<input
			class={cn(
				"border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			type="text"
			autocomplete="off"
			bind:value
			{readonly}
			on:blur
			on:change
			on:click
			on:focus
			on:focusin
			on:focusout
			on:keydown
			on:keypress
			on:keyup
			on:mouseover
			on:mouseenter
			on:mouseleave
			on:paste
			on:input
			{...$$restProps}
		/>
	{:else}
		<input
			class={cn(
				"border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			type="password"
			autocomplete="off"
			bind:value
			{readonly}
			on:blur
			on:change
			on:click
			on:focus
			on:focusin
			on:focusout
			on:keydown
			on:keypress
			on:keyup
			on:mouseover
			on:mouseenter
			on:mouseleave
			on:paste
			on:input
			{...$$restProps}
		/>
	{/if}
	{#if showToggle}
		<Button
			type="button"
			variant="ghost"
			size="icon"
			class="absolute right-0 top-0 h-10 w-10"
			on:click={togglePasswordVisibility}
		>
			{#if showPassword}
				<EyeOff class="h-4 w-4" />
			{:else}
				<Eye class="h-4 w-4" />
			{/if}
		</Button>
	{/if}
</div>
