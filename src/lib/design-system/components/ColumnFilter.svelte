<script context="module" lang="ts">
	export interface FilterOption {
		value: string;
		label: string;
		count?: number;
	}
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { ChevronDown, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-svelte';
	import Checkbox from './Checkbox.svelte';
	import { Button } from '$lib/design-system/components';
	
	export let label: string;
	export let options: FilterOption[] = [];
	export let selectedValues: string[] = [];
	export let sortable: boolean = false;
	export let sortDirection: 'asc' | 'desc' | null = null;
	
	let isOpen = false;
	let menuRef: HTMLDivElement;
	let triggerWrapperRef: HTMLDivElement;
	
	const dispatch = createEventDispatcher<{
		change: string[];
		sort: 'asc' | 'desc' | null;
	}>();
	
	function toggle() {
		isOpen = !isOpen;
	}
	
	function close() {
		isOpen = false;
	}
	
	function handleOptionChange(value: string, checked: boolean) {
		if (checked) {
			selectedValues = [...selectedValues, value];
		} else {
			selectedValues = selectedValues.filter(v => v !== value);
		}
		dispatch('change', selectedValues);
	}
	
	function handleSort() {
		if (!sortable) return;
		
		if (sortDirection === null) {
			sortDirection = 'desc';
		} else if (sortDirection === 'desc') {
			sortDirection = 'asc';
		} else {
			sortDirection = null;
		}
		dispatch('sort', sortDirection);
	}
	
	function handleClickOutside(event: MouseEvent) {
		if (menuRef && !menuRef.contains(event.target as Node) && 
			triggerWrapperRef && !triggerWrapperRef.contains(event.target as Node)) {
			close();
		}
	}
	
	function handleToggleClick() {
		toggle();
	}
	
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
	
	$: hasSelection = selectedValues.length > 0;
</script>

<div class="relative inline-block">
	<!-- Trigger Button - uses Button component from design-system -->
	<div bind:this={triggerWrapperRef} class="inline-block">
		<Button
			variant="text"
			size="md"
			color={hasSelection ? 'primary' : 'gray'}
			on:click={handleToggleClick}
			iconRight={true}
			class="column-filter-trigger"
		>
			<span>{label}</span>
			
			{#if sortable && sortDirection}
				{#if sortDirection === 'desc'}
					<ArrowDown size={16} strokeWidth={1.67} slot="icon-right" />
				{:else}
					<ArrowUp size={16} strokeWidth={1.67} slot="icon-right" />
				{/if}
			{:else}
				<ChevronsUpDown size={16} strokeWidth={1.67} color="#98A2B3" slot="icon-right" />
			{/if}
		</Button>
	</div>
	
	<!-- Dropdown Menu -->
	{#if isOpen}
		<div
			bind:this={menuRef}
			class="absolute z-50 mt-1 min-w-[200px] py-2 bg-white rounded-lg shadow-lg border border-[#EAECF0]"
			style="box-shadow: 0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03);"
		>
			{#each options as option}
				<label
					class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F9FAFB] transition-colors"
				>
					<Checkbox
						checked={selectedValues.includes(option.value)}
						size="md"
						on:change={(e) => handleOptionChange(option.value, e.detail.checked)}
					/>
					<span class="text-[14px] font-normal leading-[20px] text-[#344054] flex-1">
						{option.label}
					</span>
					{#if option.count !== undefined}
						<span class="text-[12px] font-normal text-[#98A2B3]">
							({option.count})
						</span>
					{/if}
				</label>
			{/each}
			
			{#if selectedValues.length > 0}
				<div class="border-t border-[#EAECF0] mt-2 pt-2">
					<!-- Clear Button - uses Button component from design-system -->
					<Button
						variant="text"
						size="md"
						color="primary"
						fullWidth={true}
						on:click={() => { selectedValues = []; dispatch('change', []); }}
						class="text-left justify-start"
					>
						Clear selection
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	div {
		font-family: var(--ds-font-family-primary);
	}
</style>
